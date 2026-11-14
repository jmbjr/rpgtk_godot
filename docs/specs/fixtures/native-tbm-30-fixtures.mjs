// Fully synthetic Toolkit 3 TBM 3.0 files. No BSTW game assets.
const z = v => Buffer.from(v + "\0", "ascii");
const i16 = (...a) => {
  const b = Buffer.alloc(a.length * 2);
  a.forEach((v, i) => b.writeInt16LE(v, i * 2));
  return b;
};
const i32 = (...a) => {
  const b = Buffer.alloc(a.length * 4);
  a.forEach((v, i) => b.writeInt32LE(v, i * 4));
  return b;
};
const f64 = (...a) => {
  const b = Buffer.alloc(a.length * 8);
  a.forEach((v, i) => b.writeDoubleLE(v, i * 8));
  return b;
};
const pack = (...a) => Buffer.concat(a);

export function tileBitmap30({ open = false, width = 3, height = 3, extra = false } = {}) {
  const cells = [];
  for (let x = 0; x <= width; x++) {
    for (let y = 0; y <= height; y++) {
      const visible = x < width && y < height;
      const tileNumber = open && x === 1 && y === 2 ? 11 : 1 + y * width + x;
      const value = visible ? "sample.tst" + tileNumber :
        x === width && y === 0 ? "sample.tst12" : "";
      const shade = x === 0 && y === 0 ? [13, -7, 2] : [0, 0, 0];
      cells.push(z(value), i16(...shade));
    }
  }
  return pack(z("TK3 TILEBITMAP"), i16(3, 0, width, height), ...cells,
    ...(extra ? [Buffer.from([0xae])] : []));
}
export const closedBitmap = tileBitmap30();
export const openBitmap = tileBitmap30({ open: true });
export const nativeHouseAnimation = pack(
  z("RPGTLKIT ANIM"), i16(2, 3),
  i32(96, 96, 1),
  z("synthetic_closed.tbm"), i32(0x00010203), z(""),
  z("synthetic_open.tbm"), i32(0x00010203), z(""),
  f64(0.12),
);
