import { detailFixtures } from "../../docs/specs/fixtures/detail-fixtures.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { buildReferences, readArtifacts } from "../../artifacts.mjs";
import { fixtures } from "../../docs/specs/fixtures/format-fixtures.mjs";
import { artifactRecord } from "../../records.mjs";
import { projectTileCards } from "./card-scene.mjs";
import JSZip from "../../vendor/jszip.min.js";
import { projectTiles, sha256Text } from "./project.mjs";

const [schemaPath, outputDirectory] = process.argv.slice(2);
assert.ok(schemaPath, "Usage: node experiments/dodge-tiles/check.mjs DODGE_SCHEMA [OUTPUT_DIRECTORY]");
const schema = await readFile(schemaPath);
assert.equal(createHash("sha256").update(schema).digest("hex"),
  "270da57228139022d265082cad4d708aff1ba16a710d641a4f2144c7402a2ca9", "Use the pinned DODGE schema.");
const validate = new Ajv2020({ strict: false }).compile(JSON.parse(schema));

const boardPath = "Boards/room.brd";
const zip = new JSZip();
zip.file(boardPath, fixtures.find(({ path }) => path === boardPath).bytes);
for (const name of ["two-tiles.tst", "standalone-16.gph"]) {
  zip.file(`Tiles/${name}`, await readFile(new URL(`../../docs/specs/fixtures/${name}`, import.meta.url)));
}

const { artifacts } = await readArtifacts(zip, {});
function recordsFor(assets) {
  const graph = buildReferences(assets);
  return [...assets.values()].map(artifact => artifactRecord(artifact, graph));
}

const records = recordsFor(artifacts);
const { dodge, sidecar } = await projectTiles(records);
assert.ok(validate(dodge), JSON.stringify(validate.errors));
assert.deepEqual(dodge.scenes, {});
const [tileset] = Object.values(dodge.objects).filter(({ kind }) => kind === "collection");
assert.equal(tileset.ordering, "declared");
assert.equal(tileset.behaviors, undefined);
assert.equal(tileset.members.length, 2);
const [first, second] = tileset.members.map(({ object_ref }) => object_ref);
assert.notEqual(first, second);
const tilesetRef = "rpgtk:/Tiles/two-tiles.tst";
const standaloneRef = "rpgtk:/Tiles/standalone-16.gph";
assert.deepEqual(sidecar.tileBindings.filter(({ tileNumber }) => tileNumber !== undefined), [
  { objectId: first, toolkitRef: `${tilesetRef}#/data/tiles/0`, tileNumber: 1 },
  { objectId: second, toolkitRef: `${tilesetRef}#/data/tiles/1`, tileNumber: 2 },
]);
const standalone = sidecar.tileBindings.find(({ toolkitRef }) => toolkitRef === standaloneRef);
assert.equal(dodge.objects[standalone.objectId].kind, "token");
assert.ok(tileset.members.every(({ object_ref }) => object_ref !== standalone.objectId));
assert.deepEqual(sidecar.records, Object.fromEntries(records.map(record => [record.$id, record])));
assert.deepEqual((await projectTiles([...records].reverse())).dodge.objects, dodge.objects);
assert.deepEqual(sidecar.boardPlacements, [{
  boardRef: "rpgtk:/Boards/room.brd", offset: 0, length: 1, lookupIndex: 1, shade: [-30, 0, 20],
  value: "two-tiles.tst2", status: "resolved", toolkitRef: `${tilesetRef}#/data/tiles/1`, objectId: second,
}]);

// Extend the decoded board so these cases exercise the existing reference resolver.
const board = artifacts.get(boardPath);
const cases = new Map(artifacts);
cases.set(boardPath, {
  ...board, width: 4,
  lookup: ["", "two-tiles.tst2", "two-tiles.tst3", "missing.gph"],
  refs: [
    { ...board.refs[0], tiles: 2 },
    { value: "two-tiles.tst3", evidence: "Board tile lookup · entry 2 · 1 placed", index: 2, tiles: 1 },
    { value: "missing.gph", evidence: "Board tile lookup · entry 3 · 1 placed", index: 3, tiles: 1 },
  ],
  runs: [
    { ...board.runs[0], length: 2 },
    { offset: 2, length: 1, index: 2, shade: [0, 0, 0] },
    { offset: 3, length: 1, index: 3, shade: [0, 0, 0] },
  ],
});
const variant = await projectTiles(recordsFor(cases));
assert.deepEqual(variant.dodge.objects, dodge.objects);
assert.deepEqual(variant.sidecar.boardPlacements.map(({ length, status, objectId }) => [length, status, objectId]), [
  [2, "resolved", second],
  [1, "tile-index-out-of-range", undefined],
  [1, "missing", undefined],
]);

if (outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "dodge.json"), JSON.stringify(dodge, null, 2) + "\n");
  const sourceJson = JSON.stringify(sidecar, null, 2) + "\n";
  const cards = projectTileCards(dodge, "Tiles/two-tiles.tst", await sha256Text(sourceJson));
  assert.ok(validate(cards), JSON.stringify(validate.errors));
  await writeFile(join(outputDirectory, dodge.sources.toolkit.uri), sourceJson);
  await writeFile(join(outputDirectory, "tile-card-scene.json"), JSON.stringify(cards, null, 2) + "\n");
}
console.log("DODGE tile pilot passed: schema, declared order, stable IDs, and board placement cases.");

// Emit indexed-source review bundles through the same DODGE projection.
if (outputDirectory) {
  const paletteArchive = new JSZip();
  for (const detail of [3, 4, 5, 6]) {
    const name = `palette-${detail}.tst`;
    const zip = new JSZip();
    zip.file(`Tiles/${name}`, await readFile(new URL(`../../docs/specs/fixtures/${name}`, import.meta.url)));
    paletteArchive.file(`Tiles/${name}`, await readFile(new URL(`../../docs/specs/fixtures/${name}`, import.meta.url)));
    for (const compressed of [0, 1]) {
      const gph = `palette-${detail}-${compressed}.gph`;
      paletteArchive.file(`Tiles/${gph}`, await readFile(new URL(`../../docs/specs/fixtures/${gph}`, import.meta.url)));
    }
    const originalBoard = Buffer.from(fixtures.find(({ path }) => path === boardPath).bytes);
    const oldReference = Buffer.from("two-tiles.tst2");
    const offset = originalBoard.indexOf(oldReference);
    assert.notEqual(offset, -1);
    const paletteBoard = Buffer.concat([originalBoard.subarray(0, offset), Buffer.from(`${name}2`), originalBoard.subarray(offset + oldReference.length)]);
    zip.file(boardPath, paletteBoard);
    paletteArchive.file(`Boards/palette-${detail}.brd`, paletteBoard);
    const { artifacts } = await readArtifacts(zip, {});
    const { dodge, sidecar } = await projectTiles(recordsFor(artifacts));
    assert.ok(validate(dodge), JSON.stringify(validate.errors));
    const sourceJson = JSON.stringify(sidecar, null, 2) + "\n";
    const cards = projectTileCards(dodge, `Tiles/${name}`, await sha256Text(sourceJson));
    assert.ok(validate(cards), JSON.stringify(validate.errors));
    const directory = join(outputDirectory, `palette-${detail}`);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "dodge.json"), JSON.stringify(dodge, null, 2) + "\n");
    await writeFile(join(directory, dodge.sources.toolkit.uri), sourceJson);
    await writeFile(join(directory, "tile-card-scene.json"), JSON.stringify(cards, null, 2) + "\n");
  }
  await writeFile(join(outputDirectory, "palette-fixtures.zip"), await paletteArchive.generateAsync({ type: "nodebuffer" }));
}

if (outputDirectory) {
  const zip = new JSZip();
  for (const { path, bytes } of fixtures) {
    if (/^Chrs\/text-[01]-[01]\.tem$/.test(path) || ["SpcMove/pulse.spc", "Prg/start.prg", "Media/tone.wav", "Bitmap/face.gif"].includes(path)) zip.file(path, bytes);
  }
  zip.file("Tiles/two-tiles.tst", await readFile(new URL("../../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
  await writeFile(join(outputDirectory, "older-tem-fixtures.zip"), await zip.generateAsync({ type: "nodebuffer" }));
}

if (outputDirectory) {
  const zip = new JSZip();
  for (const { path, bytes } of [...detailFixtures, ...fixtures.filter(f => ["Prg/start.prg", "Bitmap/face.gif", "Media/tone.wav", "Item/token-2.itm"].includes(f.path))]) zip.file(path, bytes);
  zip.remove("Tiles/art-0-1-0-0.gph"); // Deliberately missing quadrant, as in the regression check.
  zip.file("Tiles/two-tiles.tst", await readFile(new URL("../../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
  await writeFile(join(outputDirectory, "character-board-fixtures.zip"), await zip.generateAsync({ type: "nodebuffer" }));
}
