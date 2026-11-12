// Cross-compare the two *separately packaged* historical game variants.
// This is not a desktop acceptance test: text GAM 2.0 only has a partial reader.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readMainFile, mainFileBindings } from "../model.mjs";
import { readArtifacts } from "../artifacts.mjs";

const [legacyPath = "site/tk2-legacy-game.zip", textPath = "site/tk2-text-gam-game.zip"] =
  process.argv.slice(2);
const open = async path => openGameArchive(await readFile(path),
  bytes => JSZip.loadAsync(bytes));
const legacy = await open(legacyPath);
const text = await open(textPath);
const manifest = JSON.parse(await readFile(
  new URL("../experiments/tk2-text-gam-game/manifest.json", import.meta.url)));
const from = "TK2LegacyLab";
const to = manifest.name;
const renamed = path => path.replaceAll(from, to);
const entries = zip => Object.values(zip.files).filter(file => !file.dir)
  .map(file => file.name).sort();
const expected = entries(legacy).map(renamed).sort();
assert.deepEqual(entries(text), expected,
  "Both game variants must include exactly the same renamed asset inventory");
const exceptions = new Set(manifest.comparison.expectedByteIdenticalExcept);
for (const path of entries(legacy)) {
  const target = renamed(path);
  const original = Buffer.from(await legacy.file(path).async("uint8array"));
  const alternate = Buffer.from(await text.file(target).async("uint8array"));
  if (exceptions.has(target)) {
    assert.notDeepEqual(alternate, original, target + ": expected intentional content change");
  } else {
    assert.deepEqual(alternate, original, target + ": shared asset bytes must match");
  }
}
assert.equal(exceptions.size, 3);
const gamPaths = entries(text).filter(path => /\.gam$/i.test(path));
assert.deepEqual(gamPaths, [manifest.files.main], "Exactly one active text 2.0 GAM");
assert.deepEqual(entries(legacy).filter(path => /\.gam$/i.test(path)),
  ["Main/TK2LegacyLab.gam"]);
const originalMain = readMainFile(await legacy.file("Main/TK2LegacyLab.gam").async("uint8array"));
const alternateMain = readMainFile(await text.file(manifest.files.main).async("uint8array"));
assert.deepEqual([originalMain.major, originalMain.minor], [2, 2]);
assert.deepEqual([alternateMain.major, alternateMain.minor], [2, 0]);
const values = ["startup", "board", "character"];
assert.deepEqual(values.map(key => alternateMain[key]), ["start.prg", "room.brd", "player.tem"]);
const bindings = mainFileBindings(alternateMain, entries(text));
assert.deepEqual(bindings.map(([, ref]) => [ref.status, ref.path]),
  [manifest.files.startup, manifest.files.board, manifest.files.player]
    .map(path => ["resolved", path]));
const { artifacts } = await readArtifacts(text, {});
assert.equal(artifacts.get(manifest.files.main).sourceFormat.encoding, "text");
assert.equal(artifacts.get(manifest.files.main).sourceFormat.version, "2.0");
assert.deepEqual(artifacts.get(manifest.files.board).start, { x: 6, y: 5, layer: 1 });
assert.equal(artifacts.get(manifest.files.player).walking.length, 16);
console.log("Alternate GAM check passed: single text 2.0 Main File, all three startup bindings, "
  + expected.length + " matching archive paths and unchanged shared asset bytes.");
