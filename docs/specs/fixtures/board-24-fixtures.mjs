// Synthetic 2.4 vector-board fixtures, NOT copied from the BSTW game.
// Field sequence follows the pinned Toolkit 3 native vector-board reader.
const z = text => Buffer.from(text + "\0", "ascii");
const i16 = (...items) => {
  const out = Buffer.alloc(items.length * 2);
  items.forEach((value, index) => out.writeInt16LE(value, index * 2));
  return out;
};
const i32 = (...items) => {
  const out = Buffer.alloc(items.length * 4);
  items.forEach((value, index) => out.writeInt32LE(value, index * 4));
  return out;
};
const pack = (...items) => Buffer.concat(items);
const point = (x, y) => i32(x, y);
const vector = (points, attributes, closed, layer, tileType, handle) => pack(
  i16(points.length - 1), ...points.map(([x, y]) => point(x, y)),
  i16(attributes, closed, layer, tileType), z(handle),
);
const header = (width, height, layers, coordinate) =>
  pack(z("RPGTLKIT BOARD"), i16(2, 4, width, height, layers, coordinate));

const vectors = [
  vector([[2, 3], [68, 3], [32, 45]], 17, -1, 1, 1, "wall-A"),
  vector([[33, 55], [35, 68]], -9, 0, 2, 2, "portal-B"),
];
const fixture = pack(
  header(3, 2, 2, 4),
  i16(2), z(""), z("two-tiles.tst1"), z("two-tiles.tst2"),
  i16(-4, 1, -3, 2, -5, 1), // exactly twelve cells, layer/row/column order
  i16(1), // upper shading block index: 2 blocks
  i32(1), i16(6, 5, -7, 2),
  i32(2), i16(6, -3, 1, 6),
  i16(0), // upper light index: 1 light
  i32(2, 42), i16(1), point(5, 6), point(7, 8),
  i16(0), i16(10, 20, 30), // one color
  i16(1), ...vectors, // upper vector index: 2 vectors
  Buffer.from([0xaa, 0xbb, 0xcc]), // unread *later* native section sentinel
);
const empty = pack(
  header(5, 3, 1, 6), i16(0), z(""),
  i16(-15, 0), i16(0), i32(1), i16(15, 0, 0, 0),
  i16(-1), i16(-1), // no lights, no vectors
);
const brokenRuns = pack(header(2, 2, 1, 4), i16(0), z(""), i16(-5, 0));
const brokenLookup = pack(header(2, 2, 1, 4), i16(6), z(""));
export const board24Fixtures = {
  standard: fixture,
  alternate: empty,
  badRun: brokenRuns,
  badLookup: brokenLookup,
};
