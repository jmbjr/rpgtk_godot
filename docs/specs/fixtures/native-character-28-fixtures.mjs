// Small synthetic Toolkit 3 TEM 2.8 + ANM 2.3 fixtures.
// NOT copied from BSTW, and safe to commit to source control.
const z = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => { const b = Buffer.alloc(2 * values.length); values.forEach((v, i) => b.writeInt16LE(v, i * 2)); return b; };
const i32 = (...values) => { const b = Buffer.alloc(4 * values.length); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b; };
const f64 = (...values) => { const b = Buffer.alloc(8 * values.length); values.forEach((v, i) => b.writeDoubleLE(v, i * 8)); return b; };
const pack = (...parts) => Buffer.concat(parts);
const header = (kind, version) => pack(z("RPGTLKIT " + kind), i16(2, version));
const movement = ["South", "North", "East", "West", "Northwest", "Northeast", "Southwest", "Southeast"];
const movementNames = ["test_south.anm", "test_north.anm", "test_east.anm", "test_west.anm", "", "", "", ""];
const specials = Array.from({ length: 201 }, (_, slot) => pack(
  z(slot === 1 ? "pulse.spc" : ""),
  i32(slot === 1 ? 17 : 0, slot === 1 ? 4 : 0), z(""), z(""),
));
export const character28 = pack(
  header("CHAR", 8), z("Test Bruce"),
  ...Array.from({length: 9}, (_, i) => z("var-" + i)),
  i32(11, 101, 105, 21, 23, 42, 51, 7),
  z("test-portrait.png"),
  ...specials, z(""), Buffer.from([0]),
  ...Array.from({length: 11}, () => z("")),
  Buffer.alloc(7), i32(3), i16(14), i32(999), i16(1,2,3,4),
  z("level.prg"), Buffer.from([1, 0]),
  ...movementNames.map(z),
  ...["fight.anm", "defend.anm", "special.anm", "die.anm", "rest.anm", ""].map(z),
  ...["test_idle.anm", "", "", "", "", "", "", ""].map(z),
  f64(2.5, 0.0625),
  i32(1), z("gesture.anm"), z("Wave"), z(""), z(""),
  i16(1),
  i16(2), i32(1,2, 3,4, -5,6),
  i16(1), i32(10,11, 12,13),
);
export const animation23 = (names, storedCount = 50, pause = 0.15) =>
  pack(header("ANIM", 3), i32(32, 32, storedCount),
    ...Array.from({ length: storedCount + 1 }, (_, i) =>
      pack(z(names[i] ?? ""), i32(0x00ffffff), z(i === 1 ? "tick.wav" : ""))),
    f64(pause));
export const nativeAnims = new Map([
  ["test_south.anm", animation23(["test-characters.tst14", "test-characters.tst15"])],
  ["test_north.anm", animation23(["test-characters.tst16", "test-characters.tst17"], 1)],
  ["test_east.anm", animation23(["test-characters.tst12", "test-characters.tst13"], 1)],
  ["test_west.anm", animation23(["test-characters.tst10", "test-characters.tst11"], 1)],
  ["test_idle.anm", animation23(["test-characters.tst18"], 0)],
]);
export const testTileset = (() => {
  const b = Buffer.alloc(6 + 18 * 32 * 32 * 3);
  b.writeInt16LE(20, 0);
  b.writeInt16LE(18, 2);
  b.writeInt16LE(1, 4);
  for (let t = 0; t < 18; t++) {
    for (let p = 0; p < 1024; p++) {
      const at = 6 + (t * 1024 + p) * 3;
      b[at] = (t * 13 + 30) % 256;
      b[at + 1] = (t * 7 + 50) % 256;
      b[at + 2] = (t * 17 + 80) % 256;
    }
  }
  return b;
})();
export const testDirections = movement.slice(0, 4);
