import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { buildReferences, readArtifacts, tilePixels } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { standaloneTilePixels } from "../sprites.mjs";
import JSZip from "../vendor/jszip.min.js";

const spec = new URL("../docs/specs/", import.meta.url);
const fixture = name => readFile(new URL(`fixtures/${name}`, spec));
const schema = JSON.parse(await readFile(new URL("tile-record.schema.json", spec)));
const validate = new Ajv2020({ strictTypes: false }).compile(schema);
const names = ["standalone-16.gph", "standalone-32-rle.gph", "two-tiles.tst", "two-tiles-16.tst"];
const zip = new JSZip();
for (const name of names) zip.file(`Tiles/${name}`, await fixture(name));
const { artifacts } = await readArtifacts(zip, {});
const graph = buildReferences(artifacts);

function checkSchema(record) {
  assert.ok(validate(record), JSON.stringify(validate.errors));
}

for (const name of names) {
  const expected = JSON.parse(await fixture(`${name}.expected.json`));
  const record = artifactRecord(artifacts.get(`Tiles/${name}`), graph);
  checkSchema(expected);
  checkSchema(record);
  assert.deepEqual(record, expected, name);
  if (record.format === "tst") {
    assert.equal(record.data.tiles.length, record.data.count);
    const bytesPerTile = record.data.width * record.data.height * 3;
    assert.equal(record.data.byteLength, 6 + record.data.count * bytesPerTile);
    record.data.tiles.forEach(({ number, rgb }, index) => {
      assert.equal(number, index + 1);
      assert.equal(Buffer.from(rgb, "base64").length, bytesPerTile);
    });
  }
}

const rgba = (pixels, x, y) => [...pixels.subarray((y * 32 + x) * 4, (y * 32 + x + 1) * 4)];
const raw = standaloneTilePixels(artifacts.get("Tiles/standalone-16.gph"));
assert.deepEqual(rgba(raw, 0, 0), [0, 0, 0, 0]);
assert.deepEqual(rgba(raw, 0, 2), [255, 0, 0, 255]);
assert.deepEqual(rgba(raw, 2, 0), [0, 255, 0, 255]);
assert.deepEqual(rgba(raw, 2, 2), [0, 0, 255, 255]);
const compressed = standaloneTilePixels(artifacts.get("Tiles/standalone-32-rle.gph"));
assert.deepEqual(rgba(compressed, 1, 0), [255, 0, 0, 255]);
assert.deepEqual(rgba(compressed, 1, 1), [0, 255, 0, 255]);

const set = artifacts.get("Tiles/two-tiles.tst");
const first = tilePixels(set, 1);
const second = tilePixels(set, 2);
assert.deepEqual(rgba(first, 0, 0), [0, 1, 2, 0]);
assert.deepEqual(rgba(first, 0, 1), [255, 0, 0, 255]);
assert.deepEqual(rgba(first, 1, 0), [0, 255, 0, 255]);
assert.deepEqual(rgba(second, 0, 0), [0, 0, 0, 255]);
assert.deepEqual(rgba(second, 0, 1), [0, 0, 255, 255]);
assert.equal(tilePixels(set, 3), null);

const set16 = artifacts.get("Tiles/two-tiles-16.tst");
const first16 = tilePixels(set16, 1);
assert.deepEqual(rgba(first16, 1, 1), [0, 1, 2, 0]);
assert.deepEqual(rgba(first16, 1, 3), [255, 0, 0, 255]);
assert.deepEqual(rgba(first16, 3, 1), [0, 255, 0, 255]);
assert.deepEqual(rgba(first16, 31, 31), [17, 18, 19, 255]);
assert.deepEqual(rgba(tilePixels(set16, 2), 1, 3), [0, 0, 255, 255]);
assert.deepEqual(rgba(tilePixels(set16, 2), 0, 0), [0, 0, 0, 255]);
assert.equal(tilePixels(set16, 3), null);
const record16 = artifactRecord(set16, graph);
assert.equal(validate({ ...record16, data: { ...record16.data, height: 32 } }), false);
assert.equal(validate({ ...record16, data: { ...record16.data, tiles: artifactRecord(set, graph).data.tiles } }), false);

const caller = "Prg/example.prg";
artifacts.set(caller, { path: caller, refs: [
  { value: "two-tiles.tst2", evidence: "Synthetic placement" },
  { value: "two-tiles.tst3", evidence: "Out-of-range placement" },
  { value: "two-tiles-16.tst2", evidence: "Detail 2 placement" },
] });
const indexed = buildReferences(artifacts);
assert.equal(indexed.outgoing.get(caller)[1].status, "Tile index out of range");
const referenced = artifactRecord(set, indexed);
checkSchema(referenced);
assert.deepEqual(referenced.references.incoming[0].target, {
  $ref: "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1",
  tileIndex: 2,
});

assert.deepEqual(artifactRecord(set16, indexed).references.incoming[0].target, {
  $ref: "rpgtk:/Tiles/two-tiles-16.tst#/data/tiles/1",
  tileIndex: 2,
});

const gph = (detail, compression, payload) =>
  ["RPGTLKIT TILE", 2, 0, detail, compression, ...payload].join("\r\n") + "\r\n";
zip.file("raw-32.gph", gph(1, 0, Array(1024).fill(0)));
zip.file("rle-16.gph", gph(2, 1, [256, -1]));
zip.file("truncated.gph", gph(2, 1, [255, -1]));
zip.file("overshoot.gph", gph(2, 1, [257, -1]));
zip.file("bad-color.gph", gph(2, 1, [256, 16777216]));
const bytes = await fixture("two-tiles.tst");
zip.file("truncated.tst", bytes.subarray(0, -1));
zip.file("overlong.tst", Buffer.concat([bytes, Buffer.of(0)]));
zip.file("unsupported.tst", Buffer.concat([Buffer.of(30), bytes.subarray(1)]));
zip.file("truncated-16.tst", set16.bytes.subarray(0, -1));
const cases = (await readArtifacts(zip, {})).artifacts;
for (const name of ["raw-32.gph", "rle-16.gph"]) {
  checkSchema(artifactRecord(cases.get(name), buildReferences(cases)));
}
for (const name of ["truncated.gph", "overshoot.gph", "bad-color.gph", "truncated.tst", "truncated-16.tst", "overlong.tst", "unsupported.tst"]) {
  assert.equal(cases.get(name).decodeStatus, "error", name);
}
console.log("Tile specs passed: decoded JSON schemas, GPH layouts, TST offsets, transparency, and error cases.");
