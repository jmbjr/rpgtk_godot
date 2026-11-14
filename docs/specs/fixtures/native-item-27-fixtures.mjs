// Small, deliberate Toolkit 3 ITM binary 2.7 fixtures.
// The game archive is NOT committed. Field order follows the pinned
// Toolkit 3.1 CommonItem.bas reader/writer, rather than a BSTW byte copy.
const z = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => {
  const b = Buffer.alloc(2 * values.length);
  values.forEach((v, i) => b.writeInt16LE(v, i * 2));
  return b;
};
const i32 = (...values) => {
  const b = Buffer.alloc(4 * values.length);
  values.forEach((v, i) => b.writeInt32LE(v, i * 4));
  return b;
};
const f64 = (...values) => {
  const b = Buffer.alloc(8 * values.length);
  values.forEach((v, i) => b.writeDoubleLE(v, i * 8));
  return b;
};
const pack = (...items) => Buffer.concat(items);
const dirs = ["South", "North", "East", "West", "Northwest",
  "Northeast", "Southwest", "Southeast"];
export const nativeItemDirections = dirs;

export function nativeItem27({ emptyGraphics = false } = {}) {
  const gfx = emptyGraphics ? Array(10).fill("") : [
    "native_south.anm", "native_north.anm", "native_east.anm", "native_west.anm",
    "", "", "", "", "rest_native.anm", "reserved_native.anm",
  ];
  const standing = emptyGraphics ? Array(8).fill("") :
    ["idle_native.anm", "", "", "", "", "", "", ""];
  return pack(
    z("RPGTLKIT ITEM"), i16(2, 7),
    z("Synthetic Amulet"), z("A diagnostic item"),
    Buffer.from([1, 0, 1, 0, 1]), // equip, menu, board, battle, use restrictions
    ...Array.from({ length: 51 }, (_, i) => z(i === 2 ? "Test Bruce" : "")),
    i32(1234, 4321), Buffer.from([1]), // prices and key-item flag
    Buffer.from([1, 0, 1, 0, 0, 1, 0, 0]), z("charm"),
    i32(101, -102, 103, -104), // four signed equipment modifiers
    z("equip.prg"), z("remove.prg"),
    i32(21, 22), z("menu.prg"),
    i32(-23, 24), z("battle.prg"), z("fx_native.anm"),
    z("board.prg"), z("pickup.prg"), Buffer.from([1]), // size code
    ...gfx.map(z), ...standing.map(z), f64(0.0625, 2.25), // speed BEFORE idle
    i32(emptyGraphics ? -1 : 1), // inclusive custom maximum
    ...(!emptyGraphics ? [z("wave.anm"), z("Wave"), z(""), z("Unused")] : []),
    i16(emptyGraphics ? -1 : 1), // inclusive vector-base maximum
    ...(!emptyGraphics ? [
      i16(2), i32(-12, -20, 12, -20, 13, 14),
      i16(1), i32(-22, -8, 22, 18),
    ] : []),
  );
}
export const nativeItemBytes = nativeItem27();
export const nativeBlankItemBytes = nativeItem27({ emptyGraphics: true });
