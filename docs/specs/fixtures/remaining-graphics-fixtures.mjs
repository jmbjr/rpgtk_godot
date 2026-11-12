// Diagnostic additions for Issue #63 batch 1. Not historical editor saves.
// Keep source-backed format-fixtures.mjs and palette GPH fixtures unchanged.
const color = (r, g, b) => r | (g << 8) | (b << 16);
const dark = color(25, 33, 52);
const white = color(255, 249, 234);
const ink = color(10, 18, 36);
const gph = (detail, compressed, pixels) => {
  const source = compressed ? [] : pixels;
  if (compressed) {
    for (let i = 0; i < pixels.length;) {
      let end = i + 1;
      while (end < pixels.length && pixels[end] === pixels[i]) end++;
      source.push(end - i, pixels[i]);
      i = end;
    }
  }
  return Buffer.from(["RPGTLKIT TILE", 2, 0, detail, compressed ? 1 : 0, ...source, ""].join("\r\n"), "ascii");
};
function markerTile(size, variant, opaque = false) {
  const pixels = Array(size * size).fill(-1);
  const mark = (x, y, value) => {
    if (x >= 0 && y >= 0 && x < size && y < size) pixels[x * size + y] = value;
  };
  const accent = [
    color(78, 198, 231), color(255, 185, 65),
    color(201, 132, 250), color(101, 221, 153),
  ][variant % 4];
  for (let x = 1; x < size - 1; x++) for (let y = 1; y < size - 1; y++) {
    mark(x, y, x < 3 || y < 3 || x > size - 4 || y > size - 4 ? accent : dark);
  }
  const left = Math.round(size / 4);
  const right = size - left - 1;
  for (let x = left; x <= right; x++) for (let y = left; y <= right; y++) {
    if (Math.abs(x - size / 2) + Math.abs(y - size / 2) < size / 4 + (variant % 3))
      mark(x, y, variant % 2 ? accent : white);
  }
  for (let i = 0; i <= variant && i < size - 6; i++) mark(4 + i, size - 5, white);
  if (opaque) pixels[0] = ink;
  return pixels;
}
export const extraGphBytes = new Map([
  ["mode-1-raw.gph", gph(1, false, markerTile(32, 0))],
  ["mode-2-rle.gph", gph(2, true, markerTile(16, 1))],
  ...[0, 1].map(index => [
    "diag-bkg-" + index + ".gph", gph(1, false, markerTile(32, index + 2)),
  ]),
  ...[1, 2, 3, 4].map(frame => [
    "diag-tan-frame-" + frame + ".gph", gph(1, false, markerTile(32, frame - 1)),
  ]),
]);
const text = data => Buffer.from([...data, ""].join("\r\n"), "ascii");

// Alternating checker and a conspicuous contrasting 1-tile border; 209
// populated, named tiles exercise full 19x11 column-major BKG indexing.
export const backgroundGrid = Array.from({ length: 19 * 11 }, (_, index) => {
  const x = Math.floor(index / 11);
  const y = index % 11;
  return "diag-bkg-" + ((x === 0 || x === 18 || y === 0 || y === 10) ? 1 : (x + y) % 2) + ".gph";
});
export const backgroundShading = backgroundGrid.map((_, index) => {
  const x = Math.floor(index / 11);
  return x === 0 ? [15, -5, 0] : x === 18 ? [-10, 0, 20] : [0, 0, 0];
});
export const backgroundBytes = text([
  "RPGTLKIT BKG", 2, 0, ...backgroundGrid,
  "note.mid", "tone.wav", "", "", "", "",
  ...backgroundShading.flat(),
]);

const zstr = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => b.writeInt16LE(v, i * 2));
  return b;
};
const i32 = (...values) => {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => b.writeInt32LE(v, i * 4));
  return b;
};
export const animationFrames = Array.from({ length: 4 }, (_, i) => "diag-tan-frame-" + (i + 1) + ".gph");
export const animatedTileBytes = Buffer.concat([
  zstr("RPGTLKIT TILEANIM"), i16(2, 0), i32(8, animationFrames.length),
  ...animationFrames.map(zstr),
]);

// 8x8 glyph rows; ASCII 0/space are intentionally empty. Visible glyphs use
// deterministic registration patterns; A/B/0/1 are legible landmarks.
const readable = new Map([
  [65, [24, 36, 66, 126, 66, 66, 66, 0]],
  [66, [124, 66, 66, 124, 66, 66, 124, 0]],
  [48, [60, 66, 70, 74, 82, 98, 60, 0]],
  [49, [24, 40, 8, 8, 8, 8, 62, 0]],
]);
export const fontGlyphs = Array.from({ length: 256 }, (_, code) => {
  if (code === 0 || code === 32) return Array(8).fill(0);
  if (readable.has(code)) return readable.get(code);
  return [126, 66, 66 | ((code >> 4) & 7) * 2, 66, 66 | (code & 7) * 2, 66, 126, 0];
});
export const fontBytes = text(["RPGTLKIT FONT", 2, 0, ...fontGlyphs.flat()]);
