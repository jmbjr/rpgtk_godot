// Visible synthetic ITM editions. The sparse format-fixtures.mjs remain unchanged.
import { fixtures } from "./format-fixtures.mjs";

const original = new Set(fixtures.map(f => f.path));
const dirs = ["South", "East", "North", "West"];
const colors = {
  South: [75, 207, 120], East: [255, 183, 60],
  North: [91, 191, 255], West: [217, 132, 255], Rest: [83, 222, 168],
};
const color = (r, g, b) => r | (g << 8) | (b << 16);
const bg = color(24, 31, 49);
const white = color(255, 253, 235);
const ink = color(13, 16, 31);
const gem = color(255, 140, 180);
const fill = (count, value) => Array(count).fill(value);
const gphName = (direction, frame, part) =>
  "diag-item-" + direction.toLowerCase() + "-" + frame + "-" + part + ".gph";
const restName = part => "diag-item-rest-" + part + ".gph";

// Fixed transparent corner, asymmetric registration marks and an opaque gem.
// A four-step x-offset and frame marker distinguish the walking frames.
function itemTile(direction, frame, segment = "whole") {
  const pixels = fill(1024, -1);
  const pixel = (x, y, value) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) pixels[x * 32 + y] = value;
  };
  const rect = (x0, y0, x1, y1, value) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) pixel(x, y, value);
  };
  const accent = color(...colors[direction]);
  rect(2, 2, 29, 29, bg);
  for (let x = 2; x <= 29; x++) for (let y = 2; y <= 29; y++) {
    if (x <= 4 || x >= 27 || y <= 4 || y >= 27) pixel(x, y, accent);
  }
  rect(2, 2, 5, 5, white);
  rect(26, 2, 29, 5, ink);
  rect(2, 26, 5, 29, ink);
  rect(26, 26, 29, 29, white);
  if (segment !== "bottom") {
    const cx = 16 + (frame === 1 ? -2 : frame === 3 ? 2 : 0);
    for (let x = 7; x <= 24; x++) for (let y = 8; y <= 23; y++) {
      if (Math.abs(x - cx) + Math.abs(y - 16) <= 10) pixel(x, y, gem);
    }
    rect(cx - 3, 11, cx - 1, 13, white);
    rect(cx + 2, 19, cx + 3, 20, ink);
  } else {
    rect(10, 9, 21, 18, accent);
    rect(13, 11, 18, 16, ink);
    rect(14, 12, 17, 15, white);
  }
  if (direction !== "Rest") rect(8, 23, 8 + frame * 3, 24, white);
  else rect(9, 23, 22, 24, white);
  return pixels;
}
const asGph = pixels => Buffer.from(
  ["RPGTLKIT TILE", 2, 0, 1, 0, ...pixels, ""].join("\r\n"), "ascii"
);
export const visualItemTileBytes = new Map();
for (const direction of dirs) for (let frame = 1; frame <= 4; frame++) {
  for (const part of ["top", "bottom"]) {
    visualItemTileBytes.set(gphName(direction, frame, part),
      asGph(itemTile(direction, frame, part)));
  }
}
for (const part of ["top", "bottom"]) {
  visualItemTileBytes.set(restName(part), asGph(itemTile("Rest", 1, part)));
}
const embeddedWalk = dirs.flatMap(direction =>
  Array.from({length: 4}, (_, i) => itemTile(direction, i + 1)));
const referencedWalk = dirs.flatMap(direction =>
  Array.from({length: 4}, (_, i) =>
    [gphName(direction, i + 1, "top"), gphName(direction, i + 1, "bottom")]));
const rest = itemTile("Rest");
const referencedRest = ["top", "bottom"].map(restName);
const text = values => Buffer.from([...values, ""].join("\r\n"), "ascii");
function textItem(minor, referenced) {
  const graphics = referenced ? [...referencedWalk.flat(), ...referencedRest]
    : [...embeddedWalk.flat(), ...rest];
  return text([
    "RPGTLKIT ITEM", 2, minor, "Relic",
    1, 0, 1, 0, 1, ...fill(6, 0),
    "Charm", 4, -3, 2, 1, "start.prg", "", 2, 3, "", 4, 5, "", "", "",
    ...(minor === 1 ? [referenced ? 1 : 0] : []), ...graphics,
    1, "Hero", ...fill(49, ""), 20, 10, 1, "Diagnostic relic", "effect.anm",
  ]);
}
const z = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => {
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => bytes.writeInt16LE(v, i * 2));
  return bytes;
};
const i32 = (...values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((v, i) => bytes.writeInt32LE(v, i * 4));
  return bytes;
};
const binary = (...fields) => Buffer.concat(fields.map(f =>
  typeof f === "string" ? z(f) : f));
function binaryItem(minor) {
  const n = minor === 2 ? i16 : i32;
  return binary(
    "RPGTLKIT ITEM", i16(2, minor), "Relic", "Diagnostic relic",
    Buffer.from([1, 0, 1, 0, 1]),
    "Hero", Buffer.alloc(50), n(20, 10),
    Buffer.from([1, 1, 0, 0, 0, 0, 0, 0, 0]),
    "Charm", n(4, -3, 2, 1), "start.prg", "",
    n(2, 3), "", n(4, 5), "", "effect.anm", "", "",
    Buffer.from([1]), ...referencedWalk.flat(), ...referencedRest,
  );
}
const paths = [
  "Item/text-20-item.itm", "Item/text-item-0.itm",
  "Item/text-item-1.itm", "Item/token-2.itm", "Item/token-3.itm",
];
for (const path of paths) if (!original.has(path)) {
  throw new Error("Missing original ITM format evidence: " + path);
}
export const visualItemBytes = new Map([
  [paths[0], textItem(0, false)],
  [paths[1], textItem(1, false)],
  [paths[2], textItem(1, true)],
  [paths[3], binaryItem(2)],
  [paths[4], binaryItem(3)],
]);
export const itemDiagnosticStyle = {
  id: "diagnostic-v1", count: visualItemBytes.size,
  tileCount: visualItemTileBytes.size, embeddedCount: 2, referencedCount: 3,
};
