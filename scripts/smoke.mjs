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

const { readArtifacts, buildReferences, boardTilesets, tilePixels } = await import("../artifacts.mjs");
const { artifacts, folders } = await readArtifacts(zip, catalog);
assert.equal(artifacts.size, 153);
assert.ok(folders.includes("Demo/Tiles/"));
assert.ok(folders.includes("Demo/StatusE/"));
assert.deepEqual([...artifacts.values()].filter(artifact => artifact.error), []);
assert.equal([...artifacts.values()].filter(artifact => artifact.type === "tst").reduce((sum, set) => sum + set.count, 0), 356);
assert.equal([...artifacts.values()].filter(artifact => artifact.type === "tan").length, 8);

const connections = buildReferences(artifacts, { name: "Demo.gam", bindings: [
  ["Initial character", { path: "Demo/Chrs/frap.tem" }],
] });
const water = "Demo/Tiles/water.tst";
const animation = "Demo/Tiles/water2.tan";
const frames = connections.outgoing.get(animation);
assert.deepEqual(frames.map(edge => [edge.to, edge.tile]), Array.from({ length: 8 }, (_, i) => [water, i + 33]));
assert.ok(connections.incoming.get(water).some(edge => edge.from === animation && edge.tile === 33));
assert.ok(connections.incoming.get(animation).some(edge => edge.from === "Demo/Boards/castle_out.brd"));
const pixels = tilePixels(artifacts.get(water), 33);
assert.equal(pixels.length, 4096);
assert.ok(pixels.some((value, index) => index % 4 === 3 && value === 255));
assert.equal(tilePixels(artifacts.get(water), 41), null);
assert.ok(connections.incoming.get("Demo/Tiles/default.tst").some(edge => edge.from === "Demo/Boards/house1.brd" && edge.tile === 10));
assert.ok(connections.incoming.get("Demo/Chrs/tano.tem").some(edge => edge.from === "Demo/Prg/getTano.prg" && edge.line === 10));
assert.equal(artifacts.get("Demo/Chrs/frap.tem").stats.Level, 1);
assert.ok(connections.incoming.get("Demo/Chrs/frap.tem").some(edge => edge.from === "Demo.gam" && edge.external));

console.log("Artifact smoke passed: folder inventory, tileset counts, animation links, board references, and character uses.");

const openingBoard = "Demo/Boards/house1.brd";
const castle = "Demo/Boards/castle_out.brd";
const board = artifacts.get(openingBoard);
assert.deepEqual([board.width, board.height, board.layers], [19, 11, 8]);
assert.ok(board.runs.some(run => run.length > 1));
assert.ok(board.runs.every(run => run.offset + run.length <= 19 * 11 * 8));
assert.ok(connections.incoming.get(openingBoard).some(edge => edge.from === "Demo/Prg/warp00000002.prg" && edge.line === 2));
assert.ok(connections.outgoing.get(openingBoard).some(edge =>
  edge.to === "Demo/Prg/chest2.prg" && edge.evidence === "Board program (14, 4, layer 1)"));
const castleSets = boardTilesets(connections.outgoing.get(castle), connections, artifacts);
assert.deepEqual([...castleSets.keys()].sort(), ["Demo/Tiles/char.tst", "Demo/Tiles/default.tst", water]);
assert.ok(castleSets.get(water).animations.has(animation));
const withOpeningBoard = buildReferences(artifacts, { name: "Demo.gam", bindings: [
  ["Opening board", { path: openingBoard }],
] });
assert.ok(withOpeningBoard.incoming.get(openingBoard).some(edge => edge.from === "Demo.gam" && edge.external));
const boards = [...artifacts.values()].filter(artifact => artifact.type === "brd");
assert.equal(boards.length, 17);
assert.ok(boards.every(artifact => artifact.runs.length > 0));
console.log("Board smoke passed: 17 tile maps, compressed runs, placed programs, incoming board links, and animation-backed tilesets.");
