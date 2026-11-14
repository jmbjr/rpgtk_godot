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
// Each native board saves the complete post-vector tail. All values below
// are synthetic and deliberately distinctive to catch field-alignment bugs.
const sprite = (filename, activationProgram, x, y, layer, condition) =>
  pack(z(filename), z(activationProgram), z(""), z("trigger"),
    z(condition), z("endTrigger"), z("done"), z("loading"),
    z("pending"), i16(1, 1, x, y, layer, -1));
const nativeTail = (layers, populated) => {
  if (!populated) return pack(
    i16(-1, -1, -1, 0), z(""), // no programs/sprites/images; one blank thread
    i16(0), z(""), // one empty constant
    ...Array.from({ length: layers + 1 }, () => z("")),
    z(""), z(""), z(""), z(""),
    z(""), i32(0, 0), z(""), z(""), z(""),
    i16(0, 0, 0, 0, 0, 0, 0, 0, 0),
  );
  return pack(
    i16(0), // one native program
    z("doorTrigger.prg"), z("trigger.png"), z("doorClosed"), z("1"),
    z("doorOpen"), z("yes"), i16(1, 1, 4, 1),
    i16(1), point(48, 72), point(80, 72), i16(-1), z("door-trigger"),
    i16(1), // two placed item sprites
    sprite("jim.itm", "", 38, 52, 1, "0"),
    sprite("door.itm", "openDoor.prg", 68, 90, 2, "01"),
    i16(0), z("banner.png"), i32(11, 22), i16(2, 7), i32(0x00112233),
    i16(-1), // reserved translucency
    i16(0), z("ambient.prg"), // one thread
    i16(1), z("alpha"), z("beta"), // two stored board constants
    z(""), z("Ground"), z("Upper"), // layers+1 titles
    z("north.brd"), z(""), z("east.brd"), z(""),
    z("sky.png"), i32(3, 0x00a0b0c0), z("town.mid"),
    z("arrival.prg"), z("battle.png"),
    i16(8, -1, 0, 2, -4, 6, 19, 27, 1),
  );
};
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
  nativeTail(2, true), // full native program/sprite/image/settings tail
);
const empty = pack(
  header(5, 3, 1, 6), i16(0), z(""),
  i16(-15, 0), i16(0), i32(1), i16(15, 0, 0, 0),
  i16(-1), i16(-1), // no lights, no vectors
  nativeTail(1, false),
);
const brokenRuns = pack(header(2, 2, 1, 4), i16(0), z(""), i16(-5, 0));
const brokenLookup = pack(header(2, 2, 1, 4), i16(6), z(""));
export const board24Fixtures = {
  standard: fixture,
  alternate: empty,
  badRun: brokenRuns,
  badLookup: brokenLookup,
};
