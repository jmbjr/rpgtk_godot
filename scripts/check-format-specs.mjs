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
const { artifacts, graph } = await load(zip);
for (const { path, expected } of fixtures) {
  const record = recordFor(artifacts.get(path), graph);
  assert.equal(record.decode.status, expected.status, path);
  assert.deepEqual(record.data, expected.data, path);
}
for (const [path, status] of [["Bitmap/browser.png", "media"], ["unidentified.xyz", "unidentified"], ["broken.ste", "error"]]) {
  assert.equal(recordFor(artifacts.get(path), graph).decode.status, status);
}
assert.ok(recordFor(artifacts.get("Prg/start.prg"), graph).references.outgoing.some(ref => ref.status === "missing"));
assert.equal(recordFor(artifacts.get("Tiles/two-tiles.tst"), graph).references.incoming[0].status, "resolved");
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
