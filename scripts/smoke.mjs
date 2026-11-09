import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { decodeProgram, indexProgram, readMainFile, resolveAsset } from "../model.mjs";

const [archivePath, mainPath] = process.argv.slice(2);
if (!archivePath || !mainPath) {
  console.error("Usage: node scripts/smoke.mjs /path/to/Demo.zip /path/to/Demo.gam");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url)));
const zip = await JSZip.loadAsync(await readFile(archivePath));
const paths = Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name);
assert.equal(paths.filter(path => /\.prg$/i.test(path)).length, 51);

const gam = readMainFile(await readFile(mainPath));
assert.equal(gam.title, "The Jewel Of Destiny (millenium)");
const startup = resolveAsset(paths, "Prg", gam.startup);
assert.equal(startup.path, "Demo/Prg/start.prg");
assert.equal(resolveAsset(paths, "Boards", gam.board, "Demo/").path, "Demo/Boards/house1.brd");
assert.equal(resolveAsset(paths, "Chrs", gam.character, "Demo/").path, "Demo/Chrs/frap.tem");

async function index(path) {
  const bytes = await zip.file(path).async("uint8array");
  return indexProgram(decodeProgram(bytes), catalog);
}

const program = await index(startup.path);
assert.equal(program.count, 65);
assert.equal(program.builtins.length, 28);
assert.deepEqual(program.groups.get("builtin:setbutton").lines, [83, 84, 85]);
assert.deepEqual(program.groups.get("builtin:dos").lines, [66]);
assert.deepEqual(program.groups.get("local:drawtitle").lines, [33]);
assert.equal(program.rows[25].tokens[0].kind, "comment");
assert.ok((await index("Demo/Prg/chest1.prg")).groups.has("builtin:giveitem"));
assert.throws(() => readMainFile(Buffer.from("RPGTLKIT MAIN\0")), /truncated/);
await assert.rejects(JSZip.loadAsync("bad"));
assert.equal(resolveAsset(["one/Prg/start.prg", "two/Prg/START.PRG"], "Prg", "start.prg").status, "ambiguous");

console.log("Demo smoke passed: 51 programs, 65 calls across 28 built-ins, and all three Main File bindings.");
