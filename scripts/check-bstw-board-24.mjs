import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import Ajv2020 from "ajv/dist/2020.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { readMainFile } from "../model.mjs";
import { detectSourceFormat, formatSpecTarget } from "../asset-format.mjs";
import { openGameArchive } from "../archive.mjs";
import { board24Fixtures as fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";

const catalog = {};
const synthetic = new JSZip();
synthetic.file("BSTW/Boards/standard.brd", fixtures.standard);
synthetic.file("BSTW/Boards/alternate.brd", fixtures.alternate);
synthetic.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
const { artifacts } = await readArtifacts(synthetic, catalog);
const board = artifacts.get("BSTW/Boards/standard.brd");
assert.equal(board.decodeStatus, "decoded", board.error);
assert.deepEqual([board.width, board.height, board.layers, board.coordinateType], [3, 2, 2, 4]);
assert.equal(board.lookup.length, 3);
assert.equal(board.runs.reduce((n, run) => n + run.length, 0), 12);
assert.deepEqual(board.shadingLayers.map(group => [group.layer, group.runs.length]), [[1, 1], [2, 1]]);
assert.deepEqual(board.shadingLayers[0].runs[0],
  { offset: 0, length: 6, storedLength: 6, shade: [5, -7, 2] });
assert.deepEqual(board.shadingLayers[1].runs[0].shade, [-3, 1, 6]);
const layerOne = board.runs.filter(run => run.offset < 6);
const layerTwo = board.runs.filter(run => run.offset >= 6);
assert.ok(layerOne.every(run => run.shade.join(",") === "5,-7,2"));
assert.ok(layerTwo.every(run => run.shade.join(",") === "-3,1,6"));
assert.equal(board.tileTypes.length, 0, "Native 2.4 tile types live in vector records");
assert.equal(board.lights.length, 1);
assert.deepEqual(board.lights[0], {
  layer: 2, type: 42, points: [{ x: 5, y: 6 }, { x: 7, y: 8 }],
  colors: [[10, 20, 30]],
});
assert.equal(board.vectors.length, 2);
assert.deepEqual(board.vectors[0], {
  slot: 0, points: [{ x: 2, y: 3 }, { x: 68, y: 3 }, { x: 32, y: 45 }],
  attributes: 17, closed: -1, layer: 1, tileType: 1, handle: "wall-A",
});
assert.deepEqual(board.vectors[1], {
  slot: 1, points: [{ x: 33, y: 55 }, { x: 35, y: 68 }],
  attributes: -9, closed: 0, layer: 2, tileType: 2, handle: "portal-B",
});
const alt = artifacts.get("BSTW/Boards/alternate.brd");
assert.equal(alt.decodeStatus, "decoded", alt.error);
assert.deepEqual([alt.width, alt.height, alt.layers, alt.coordinateType], [5, 3, 1, 6]);
assert.deepEqual([alt.vectors.length, alt.lights.length, alt.runs.length], [0, 0, 0]);

const graph = buildReferences(artifacts);
assert.deepEqual(graph.outgoing.get(board.path).filter(edge => edge.index !== undefined)
  .map(edge => [edge.tile, edge.to, edge.status]),
  [[1, "BSTW/Tiles/two-tiles.tst", "Resolved"], [2, "BSTW/Tiles/two-tiles.tst", "Resolved"]]);
const validation = new Ajv2020({ strictTypes: false });
const base = new URL("../docs/specs/", import.meta.url);
validation.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", base), "utf8")),
  "tile-record.schema.json");
const valid = validation.compile(JSON.parse(await readFile(new URL("artifact-record.schema.json", base), "utf8")));
const record = artifactRecord(board, graph);
assert.equal(record.decode.status, "partial");
assert.ok(valid(record), JSON.stringify(valid.errors));
assert.equal(record.data.vectors[0].points.length, 3);
assert.equal(record.data.shadingLayers.length, 2);
assert.deepEqual(detectSourceFormat("brd", fixtures.standard),
  { encoding: "binary", version: "2.4", supported: true });
assert.deepEqual(formatSpecTarget({ type: "brd", sourceFormat: board.sourceFormat }),
  { page: "brd", anchor: "#binary-24" });

for (const [name, bytes] of [
  ["bad tile run", fixtures.badRun], ["bad lookup", fixtures.badLookup],
  ["short header", fixtures.standard.subarray(0, 5)],
  ["short vector terminator", fixtures.standard.subarray(0, -4)],
]) {
  const zip = new JSZip();
  zip.file("Boards/broken.brd", bytes);
  const item = (await readArtifacts(zip, catalog)).artifacts.get("Boards/broken.brd");
  assert.equal(item.decodeStatus, "error", name);
}
const badCount = Buffer.from(fixtures.standard);
const handle = badCount.indexOf(Buffer.from("wall-A\0"));
badCount.writeInt16LE(30000, handle - 34); // count, three i32 point pairs, four i16 attributes
const malformed = new JSZip();
malformed.file("Boards/bad-count.brd", badCount);
assert.equal((await readArtifacts(malformed, catalog)).artifacts.get("Boards/bad-count.brd").decodeStatus, "error");
const unsupported = Buffer.from(fixtures.standard);
unsupported.writeInt16LE(5, Buffer.byteLength("RPGTLKIT BOARD\0") + 2);
assert.equal(detectSourceFormat("brd", unsupported).supported, false);
const invalid = new JSZip();
invalid.file("Boards/unsupported.brd", unsupported);
assert.equal((await readArtifacts(invalid, catalog)).artifacts.get("Boards/unsupported.brd").decodeStatus, "error");

if (process.argv[2]) {
  // Run locally with the owner-supplied archive. Game bytes are NEVER used
  // as committed CI fixtures, and no executable/plugin files are run.
  const bytes = await readFile(process.argv[2]);
  const sha = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha, "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300",
    "Unexpected BSTW Expo Demo sample version");
  const zip = await openGameArchive(bytes, contents => JSZip.loadAsync(contents));
  const files = Object.values(zip.files).filter(file => !file.dir);
  assert.equal(files.length, 285);
  const expected = [
    ["start.brd", 20, 15, 2, 4, 9, 86],
    ["start2.brd", 20, 15, 2, 4, 9, 67],
  ];
  const sample = (await readArtifacts(zip, catalog)).artifacts;
  const root = sample.get("BSTW.gam");
  assert.deepEqual([root.title, root.startup, root.board, root.character],
    ["BSTW", "menuTitle.prg", "start.brd", "bruce.tem"]);
  for (const [filename, width, height, layers, code, count, points] of expected) {
    const path = "BSTW/Boards/" + filename;
    const b = sample.get(path);
    assert.equal(b.decodeStatus, "decoded", path + ": " + b.error);
    assert.deepEqual([b.width, b.height, b.layers, b.coordinateType], [width, height, layers, code]);
    assert.equal(b.vectors.length, count);
    assert.equal(b.vectors.reduce((n, vector) => n + vector.points.length, 0), points);
    assert.equal(b.lights.length, 0);
    assert.equal(b.shadingLayers.length, 1);
    assert.ok(valid(artifactRecord(b, buildReferences(sample))), path + ": " + JSON.stringify(valid.errors));
  }
  const boards = [...sample.values()].filter(asset => asset.type === "brd");
  assert.equal(boards.length, 9);
  assert.ok(boards.every(b => b.decodeStatus === "decoded"),
    boards.filter(b => b.decodeStatus !== "decoded").map(b => b.path + ": " + b.error).join("\n"));
  console.log("Real BSTW archive passed: 285 files, 9 native BRD 2.4 boards; start 9/86 and start2 9/67 vectors/points.");
}
console.log("Native BRD 2.4 synthetic tests passed: tile RLE, independent shading, raw light/vector attributes, graph references, exported schema, unsupported and truncated layouts.");
