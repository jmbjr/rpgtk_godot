import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import Ajv2020 from "ajv/dist/2020.js";
import { readArtifacts, buildReferences, tilePixels } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { tileBitmapSprite, animationFrames } from "../sprites.mjs";
import { detectSourceFormat, formatSpecTarget } from "../asset-format.mjs";
import { openGameArchive } from "../archive.mjs";
import { testTileset } from "../docs/specs/fixtures/native-character-28-fixtures.mjs";
import { tileBitmap30, closedBitmap, openBitmap, nativeHouseAnimation }
  from "../docs/specs/fixtures/native-tbm-30-fixtures.mjs";

const zip = new JSZip();
zip.file("BSTW/Bitmap/synthetic_closed.tbm", closedBitmap);
zip.file("BSTW/Bitmap/synthetic_open.tbm", openBitmap);
zip.file("BSTW/Misc/synthetic_house.anm", nativeHouseAnimation);
const tileset = Buffer.from(testTileset);
// Transparent RGB sentinel in the first cell of tile 1, to prove that
// shading leaves alpha untouched and the TBM composition stays transparent.
tileset.set([0, 1, 2], 6);
zip.file("BSTW/Tiles/sample.tst", tileset);
const { artifacts } = await readArtifacts(zip, {});
const graph = buildReferences(artifacts);
const closed = artifacts.get("BSTW/Bitmap/synthetic_closed.tbm");
const open = artifacts.get("BSTW/Bitmap/synthetic_open.tbm");
assert.equal(closed.decodeStatus, "decoded", closed.error);
assert.equal(open.decodeStatus, "decoded", open.error);
assert.deepEqual(closed.sourceFormat, { encoding: "binary", version: "3.0", supported: true });
assert.deepEqual(detectSourceFormat("tbm", closedBitmap), closed.sourceFormat);
assert.deepEqual(formatSpecTarget({ type: "tbm", sourceFormat: closed.sourceFormat }),
  { page: "tbm", anchor: "#binary-30" });
for (const bitmap of [closed, open]) {
  assert.deepEqual([bitmap.width, bitmap.height, bitmap.storedColumns, bitmap.storedRows],
    [3, 3, 4, 4]);
  assert.equal(bitmap.tiles.length, 16, "Inclusive source grid is 4×4");
  assert.deepEqual(bitmap.tiles[0], {
    x: 0, y: 0, value: "sample.tst1", shade: [13, -7, 2],
  });
  assert.deepEqual(bitmap.tiles.find(tile => tile.x === 3 && tile.y === 0), {
    x: 3, y: 0, value: "sample.tst12", shade: [0, 0, 0],
  }, "Non-displayed sentinel cell must still be decoded");
  assert.equal(bitmap.tiles.filter(tile => tile.value).length, 10);
  const outgoing = graph.outgoing.get(bitmap.path);
  assert.equal(outgoing.length, 10, "Preserve all stored tile references in the graph");
  assert.deepEqual(outgoing.map(edge => [edge.status, edge.to]),
    Array.from({ length: 10 }, () => ["Resolved", "BSTW/Tiles/sample.tst"]));
  assert.ok(outgoing.every(edge => edge.tile >= 1 && edge.tile <= 18));
}
assert.equal(closed.tiles.find(t => t.x === 1 && t.y === 2).value, "sample.tst8");
assert.equal(open.tiles.find(t => t.x === 1 && t.y === 2).value, "sample.tst11");
const closedSprite = tileBitmapSprite(closed, artifacts, graph);
const openSprite = tileBitmapSprite(open, artifacts, graph);
assert.deepEqual([closedSprite.width, closedSprite.height], [96, 96]);
assert.deepEqual([openSprite.width, openSprite.height], [96, 96]);
assert.deepEqual([closedSprite.parts.length, closedSprite.missing.length], [9, 0]);
assert.deepEqual([openSprite.parts.length, openSprite.missing.length], [9, 0]);
assert.deepEqual([...closedSprite.pixels.slice(0, 4)], [0, 1, 2, 0],
  "Transparency sentinel survives TBM shading");
const firstTile = closedSprite.pixels.slice(4, 8);
const rgb = [...tilePixels(artifacts.get("BSTW/Tiles/sample.tst"), 1).slice(4, 8)];
assert.deepEqual([...firstTile], [rgb[0] + 13, rgb[1] - 7, rgb[2] + 2, 255],
  "The per-tile shades apply once to visible opaque pixels");
// Only the center tile in the bottom row changes; all others match.
let changedPixels = 0;
for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
  const index = (y * 96 + x) * 4;
  const different = closedSprite.pixels.slice(index, index + 4)
    .some((channel, i) => channel !== openSprite.pixels[index + i]);
  if (different) {
    changedPixels++;
    assert.ok(x >= 32 && x < 64 && y >= 64 && y < 96,
      "Only bottom-center tile can differ");
  }
}
assert.ok(changedPixels > 100, "Open and closed houses must be visually different");

const animation = artifacts.get("BSTW/Misc/synthetic_house.anm");
assert.equal(animation.decodeStatus, "decoded", animation.error);
assert.deepEqual([animation.width, animation.height, animation.pauseSeconds], [96, 96, 0.12]);
assert.deepEqual(animationFrames(animation.frames).map(f => f.image),
  ["synthetic_closed.tbm", "synthetic_open.tbm"]);
assert.deepEqual(graph.outgoing.get(animation.path).filter(e => e.evidence.endsWith(" image"))
  .map(e => [e.status, e.to]),
  [["Resolved", closed.path], ["Resolved", open.path]]);

const ajv = new Ajv2020({ strictTypes: false });
const specRoot = new URL("../docs/specs/", import.meta.url);
ajv.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", specRoot), "utf8")),
  "tile-record.schema.json");
const validate = ajv.compile(JSON.parse(await readFile(
  new URL("artifact-record.schema.json", specRoot), "utf8")));
for (const bitmap of [closed, open]) {
  const record = artifactRecord(bitmap, graph);
  assert.ok(validate(record), bitmap.path + ": " + JSON.stringify(validate.errors));
  assert.equal(record.sourceFormat.version, "3.0");
  assert.equal(record.decode.status, "decoded");
  assert.equal(record.data.tiles.length, 16);
  assert.equal(record.references.outgoing.length, 10);
}
const connected = connectedGameRecord(artifacts, {}, { archiveName: "Synthetic TBM house" });
const c = connected.artifacts["rpgtk:/BSTW/Bitmap/synthetic_closed.tbm"];
assert.equal(c.sourceFormat.version, "3.0");
assert.deepEqual(c.references.outgoing.filter(e => e.evidence === "Bitmap tile (1, 2)")
  .map(e => [e.target?.$ref, e.target?.tileIndex]),
  [["rpgtk:/BSTW/Tiles/sample.tst#/data/tiles/7", 8]]);
const animRef = connected.artifacts["rpgtk:/BSTW/Misc/synthetic_house.anm"];
assert.deepEqual(animRef.references.outgoing.filter(e => e.evidence.endsWith(" image"))
  .map(e => e.target?.$ref),
  ["rpgtk:/BSTW/Bitmap/synthetic_closed.tbm", "rpgtk:/BSTW/Bitmap/synthetic_open.tbm"]);

for (const [label, bytes] of [
  ["truncated", closedBitmap.subarray(0, -2)],
  ["invalid size", (() => {
    const b = Buffer.from(closedBitmap);
    b.writeInt16LE(0, 19);
    return b;
  })()],
  ["outsize", tileBitmap30({ width: 129, height: 129 })],
  ["trailing junk", tileBitmap30({ extra: true })],
  ["wrong minor", (() => {
    const b = Buffer.from(closedBitmap); b.writeInt16LE(1, 17); return b;
  })()],
  ["wrong signature", (() => {
    const b = Buffer.from(closedBitmap); b[0] = 0x61; return b;
  })()],
]) {
  const broken = new JSZip();
  broken.file("Bitmap/bad.tbm", bytes);
  const asset = (await readArtifacts(broken, {})).artifacts.get("Bitmap/bad.tbm");
  assert.equal(asset.decodeStatus, "error", label);
}
const future = Buffer.from(closedBitmap);
future.writeInt16LE(1, 17);
assert.equal(detectSourceFormat("tbm", future).version, "3.1");
assert.equal(detectSourceFormat("tbm", future).supported, false);
assert.equal(detectSourceFormat("tbm", closedBitmap.subarray(0, 8)).version, null);

// Optional read-only run against the original BSTW ZIP. No game files in CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const actualZip = await openGameArchive(bytes, src => JSZip.loadAsync(src));
  assert.equal(Object.values(actualZip.files).filter(file => !file.dir).length, 285);
  const loaded = (await readArtifacts(actualZip, {})).artifacts;
  const refs = buildReferences(loaded);
  const houseClosed = loaded.get("BSTW/Bitmap/house_3x3_closed.tbm");
  const houseOpen = loaded.get("BSTW/Bitmap/house_3x3_open.tbm");
  for (const bitmap of [houseClosed, houseOpen]) {
    assert.equal(bitmap.decodeStatus, "decoded", bitmap.error);
    assert.equal(bitmap.byteLength, 252);
    assert.equal(bitmap.tiles.length, 16);
    assert.deepEqual([bitmap.width, bitmap.height], [3, 3]);
    assert.deepEqual([bitmap.storedColumns, bitmap.storedRows], [4, 4]);
    assert.equal(refs.outgoing.get(bitmap.path).length, 9);
    assert.ok(refs.outgoing.get(bitmap.path).every(edge =>
      edge.status === "Resolved" && edge.to === "BSTW/Tiles/default.tst"));
    assert.ok(validate(artifactRecord(bitmap, refs)), JSON.stringify(validate.errors));
  }
  assert.equal(houseClosed.tiles.find(t => t.x === 1 && t.y === 2).value, "default.tst48");
  assert.equal(houseOpen.tiles.find(t => t.x === 1 && t.y === 2).value, "default.tst49");
  const a = tileBitmapSprite(houseClosed, loaded, refs);
  const b = tileBitmapSprite(houseOpen, loaded, refs);
  assert.deepEqual([a.width, a.height, a.missing.length, b.missing.length], [96, 96, 0, 0]);
  let diff = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const i = (y * 96 + x) * 4;
    if (a.pixels.slice(i, i + 4).some((v, j) => v !== b.pixels[i + j])) {
      diff++;
      assert.ok(x >= 32 && x < 64 && y >= 64 && y < 96);
    }
  }
  assert.ok(diff > 0);
  const houseAnm = loaded.get("BSTW/Misc/house_3x3.anm");
  assert.equal(houseAnm.decodeStatus, "decoded");
  assert.deepEqual([houseAnm.width, houseAnm.height], [96, 96]);
  assert.deepEqual(refs.outgoing.get(houseAnm.path).filter(e => e.evidence.endsWith(" image"))
    .map(e => e.to), [houseClosed.path, houseOpen.path]);
  console.log("Real BSTW sample passed: both 252-byte TBMs, 16 stored/9 rendered cells, " +
    "house ANM, default.tst48→49, 96×96 composed images with bottom-center-only changes.");
}
console.log("Native TBM 3.0 synthetic checks passed: inclusive records, shaded TST pixels, " +
  "ANM frame references, connected JSON, format links, corruption and original-archive gate.");
