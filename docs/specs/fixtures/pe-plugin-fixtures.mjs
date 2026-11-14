// Fully synthetic PE32 export fixtures; these bytes are not from BSTW.
// Their .text section and exported RVAs are inert, never executable code.
export function syntheticPortableExecutable(exports = [
  "DllCanUnloadNow", "DllGetClassObject", "DllRegisterServer", "DllUnregisterServer",
], { pe64 = false, machine = pe64 ? 0x8664 : 0x14c } = {}) {
  if (exports.length > 12 || exports.some(name => name.length > 60))
    throw Error("Synthetic fixture export names exceed the reserved section.");
  const bytes = Buffer.alloc(0x600);
  bytes.write("MZ", 0, "ascii");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80, "binary");
  const coff = 0x84, opt = coff + 20, optionalSize = pe64 ? 0xf0 : 0xe0;
  bytes.writeUInt16LE(machine, coff);
  bytes.writeUInt16LE(1, coff + 2);
  bytes.writeUInt16LE(optionalSize, coff + 16);
  bytes.writeUInt16LE(0x2000, coff + 18); // IMAGE_FILE_DLL
  bytes.writeUInt16LE(pe64 ? 0x20b : 0x10b, opt);
  bytes.writeUInt32LE(16, opt + (pe64 ? 108 : 92));
  bytes.writeUInt32LE(0x1100, opt + (pe64 ? 112 : 96));
  bytes.writeUInt32LE(0x180, opt + (pe64 ? 116 : 100));
  const section = opt + optionalSize;
  bytes.write(".text\0\0\0", section, "binary");
  for (const [offset, value] of [[8, 0x400], [12, 0x1000], [16, 0x400], [20, 0x200]]) {
    bytes.writeUInt32LE(value, section + offset);
  }
  const exp = 0x300, count = exports.length;
  bytes.writeUInt32LE(1, exp + 16); // ordinal base
  bytes.writeUInt32LE(count, exp + 20);
  bytes.writeUInt32LE(count, exp + 24);
  bytes.writeUInt32LE(0x1130, exp + 28);
  bytes.writeUInt32LE(0x1160, exp + 32);
  bytes.writeUInt32LE(0x1190, exp + 36);
  let stringOffset = 0x3b0;
  for (const [index, name] of exports.entries()) {
    bytes.writeUInt32LE(0x2000 + index * 16, 0x330 + index * 4);
    bytes.writeUInt32LE(0x1000 + stringOffset - 0x200, 0x360 + index * 4);
    bytes.writeUInt16LE(index, 0x390 + index * 2);
    bytes.write(name + "\0", stringOffset, "ascii");
    stringOffset += name.length + 1;
  }
  return bytes;
}
export const syntheticComDll = syntheticPortableExecutable();
export const syntheticLegacyDll = syntheticPortableExecutable(["TKPlugInit", "TKPlugVersion", "TKPlugType"]);
