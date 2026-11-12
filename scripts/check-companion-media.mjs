// Verify the two fully renderable image formats independently of the
// Toolkit-specific metadata-only JPEG/DOC fixtures.
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { diagnosticPng, diagnosticBmp, mediaFixtureSignature as signature }
  from "../docs/specs/fixtures/companion-media-fixtures.mjs";

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) {
      const carry = value & 1;
      value = (value >>> 1) ^ (carry ? 0xedb88320 : 0);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}
function unpackPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let dimensions;
  const idat = [];
  let ended = false;
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "PNG chunk header and CRC");
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    assert.ok(end <= bytes.length, "PNG chunk bounds");
    const body = bytes.subarray(offset + 4, offset + 8 + length);
    assert.equal(bytes.readUInt32BE(offset + 8 + length), crc32(body), "PNG CRC");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      assert.equal(length, 13);
      dimensions = [data.readUInt32BE(0), data.readUInt32BE(4)];
      assert.deepEqual([...data.subarray(8)], [8, 2, 0, 0, 0],
        "PNG RGB8/deflate/ordinary scanning");
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") { ended = true; assert.equal(length, 0); }
    offset = end;
  }
  assert.ok(ended && idat.length && dimensions, "Complete PNG stream");
  assert.equal(offset, bytes.length, "No PNG trailer garbage");
  const [w, h] = dimensions;
  const scanlines = inflateSync(Buffer.concat(idat));
  assert.equal(scanlines.length, h * (1 + w * 3));
  const pixels = [];
  for (let y = 0; y < h; y++) {
    assert.equal(scanlines[y * (1 + w * 3)], 0, "Every row uses filter none");
    for (let x = 0; x < w; x++) {
      const at = y * (1 + w * 3) + 1 + x * 3;
      pixels.push([...scanlines.subarray(at, at + 3)]);
    }
  }
  return { w, h, pixels };
}
function unpackBmp(bytes) {
  assert.equal(bytes.toString("ascii", 0, 2), "BM");
  assert.equal(bytes.readUInt32LE(2), bytes.length, "BMP byte length");
  assert.equal(bytes.readUInt32LE(14), 40, "BITMAPINFOHEADER");
  const [w, h] = [bytes.readInt32LE(18), bytes.readInt32LE(22)];
  assert.equal(bytes.readUInt16LE(26), 1, "BMP planes");
  assert.equal(bytes.readUInt16LE(28), 24, "BMP 24-bit true-color");
  assert.equal(bytes.readUInt32LE(30), 0, "BMP uncompressed");
  const stride = (w * 3 + 3) & ~3;
  const start = bytes.readUInt32LE(10);
  assert.equal(start + stride * h, bytes.length, "BMP pixel payload length");
  const pixels = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = start + (h - 1 - y) * stride + x * 3;
    pixels.push([bytes[at + 2], bytes[at + 1], bytes[at]]);
  }
  return { w, h, pixels };
}

const png = unpackPng(diagnosticPng);
const bmp = unpackBmp(diagnosticBmp);
assert.deepEqual([png.w, png.h, bmp.w, bmp.h],
  [signature.width, signature.height, signature.width, signature.height]);
assert.deepEqual(png.pixels, bmp.pixels,
  "PNG RGB scanlines and bottom-up BMP BGR pixels match position-by-position");
const at = (x, y) => png.pixels[y * png.w + x];
for (const [x, y, name] of [
  [0, 0, "topLeft"], [15, 0, "topRight"],
  [0, 15, "bottomLeft"], [15, 15, "bottomRight"],
]) assert.deepEqual(at(x, y), signature.corners[name], name);
assert.deepEqual(at(7, 7), [255, 255, 255], "Center white cross");
assert.ok(new Set(png.pixels.map(p => p.join(","))).size >= 7, "Diagnostic color variation");
console.log("Companion-media checks passed: fully renderable 16x16 PNG/BMP, CRCs, pixel equality, distinct corner markers.");
