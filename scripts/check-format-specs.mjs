import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { buildReferences, readArtifacts } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { readMainFile } from "../model.mjs";
import { openGameArchive } from "../archive.mjs";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import JSZip from "../vendor/jszip.min.js";

const spec = new URL("../docs/specs/", import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, spec), "utf8"));
const ajv = new Ajv2020({ strictTypes: false });
ajv.addSchema(await json("tile-record.schema.json"), "tile-record.schema.json");
const validate = ajv.compile(await json("artifact-record.schema.json"));
const catalog = await json("../../catalog.json");
const recordFor = (artifact, graph, options) => {
  const record = JSON.parse(JSON.stringify(artifactRecord(artifact, graph, options)));
  assert.ok(validate(record), `${record.path}: ${JSON.stringify(validate.errors)}`);
  return record;
};
const load = async zip => {
  const { artifacts } = await readArtifacts(zip, catalog);
  return { artifacts, graph: buildReferences(artifacts) };
};

const zip = new JSZip();
for (const { path, bytes } of fixtures) zip.file(path, bytes);
for (const name of ["standalone-16.gph", "standalone-32-rle.gph", "two-tiles.tst"]) {
  zip.file(`Tiles/${name}`, await readFile(new URL(`fixtures/${name}`, spec)));
}
zip.file("Bitmap/browser.png", "");
zip.file("unidentified.xyz", "");
zip.file("broken.ste", "truncated");
const character24 = fixtures.find(({ path }) => path === "Chrs/walker.tem").bytes;
zip.file("Chrs/truncated.tem", character24.subarray(0, -1));
const textBoard = fixtures.find(({ path }) => path === "Boards/text-room.brd").bytes;
zip.file("Boards/truncated-text.brd", textBoard.subarray(0, -15));
const fixedBoard = fixtures.find(({ path }) => path === "Boards/fixed-room.brd").bytes;
zip.file("Boards/truncated-fixed-grid.brd", fixedBoard.subarray(0, 100));
const { artifacts, graph } = await load(zip);
for (const { path, expected } of fixtures) {
  const record = recordFor(artifacts.get(path), graph);
  assert.equal(record.decode.status, expected.status, path);
  assert.deepEqual(record.data, expected.data, path);
}
for (const [path, status] of [["Bitmap/browser.png", "media"], ["unidentified.xyz", "unidentified"], ["broken.ste", "error"], ["Chrs/truncated.tem", "error"], ["Boards/truncated-text.brd", "error"], ["Boards/truncated-fixed-grid.brd", "error"]]) {
  assert.equal(recordFor(artifacts.get(path), graph).decode.status, status);
}
assert.ok(recordFor(artifacts.get("Prg/start.prg"), graph).references.outgoing.some(ref => ref.status === "missing"));
assert.equal(recordFor(artifacts.get("Tiles/two-tiles.tst"), graph).references.incoming[0].status, "resolved");
const walker = recordFor(artifacts.get("Chrs/walker.tem"), graph);
const expectedTargets = {
  "Attack sound": "rpgtk:/Media/tone.wav",
  "Level-up program": "rpgtk:/Prg/start.prg",
  "Walk south · frame 1 · top": "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1",
};
for (const [evidence, target] of Object.entries(expectedTargets)) {
  assert.equal(walker.references.outgoing.find(edge => edge.evidence === evidence)?.target?.$ref, target);
}
for (const path of ["Boards/text-room.brd", "Boards/fixed-room.brd"]) {
  const room = recordFor(artifacts.get(path), graph);
  const boardEdge = evidence => room.references.outgoing.find(edge => edge.evidence.startsWith(evidence));
  assert.equal(boardEdge("Board background image").target.$ref, "rpgtk:/Bitmap/face.gif");
  assert.equal(boardEdge("Board music").target.$ref, "rpgtk:/Media/note.mid");
  assert.deepEqual(boardEdge("Board program").position, { x: 2, y: 3, layer: 1 });
  assert.equal(boardEdge("Board program").target.$ref, "rpgtk:/Prg/start.prg");
  assert.equal(boardEdge("Board item").target.$ref, "rpgtk:/Item/token-2.itm");
  assert.equal(boardEdge("Item activation program").target.$ref, "rpgtk:/Prg/start.prg");
  assert.equal(boardEdge("Item multitask program").status, "missing");
}
for (const archivePath of process.argv.slice(2)) {
  if (/\.gam$/i.test(archivePath)) {
    const data = readMainFile(await readFile(archivePath));
    recordFor({ ...data, path: "external.gam", type: "gam", decodeStatus: "decoded" }, graph, { external: true });
    continue;
  }
  const archive = await openGameArchive(await readFile(archivePath), bytes => JSZip.loadAsync(bytes));
  const imported = await load(archive);
  for (const artifact of imported.artifacts.values()) recordFor(artifact, imported.graph);
  console.log(`Validated ${imported.artifacts.size} records from ${archivePath}.`);
}
console.log("Format specs passed: synthetic file layouts, expected data, schema, and reference cases.");
