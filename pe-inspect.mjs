// Static Windows Portable Executable metadata. This module never loads,
// registers or executes a DLL. All offsets and counts come from untrusted bytes.
const machineNames = { 0x14c: "x86", 0x8664: "x64", 0xaa64: "ARM64" };
const base = (bytes, status, reason) => ({
  byteLength: bytes.length, status, ...(reason ? { reason } : {}),
});

export function inspectPortableExecutable(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const has = (off, len) => Number.isSafeInteger(off) && off >= 0 &&
    Number.isSafeInteger(len) && len >= 0 && off + len <= bytes.length;
  const u16 = off => { if (!has(off, 2)) throw Error("Truncated PE 16-bit field."); return view.getUint16(off, true); };
  const u32 = off => { if (!has(off, 4)) throw Error("Truncated PE 32-bit field."); return view.getUint32(off, true); };
  const ascii = (off, max = 512) => {
    if (!has(off, 1)) throw Error("Invalid PE string offset.");
    const limit = Math.min(off + max, bytes.length);
    const end = bytes.indexOf(0, off);
    if (end < 0 || end >= limit) throw Error("Unterminated or oversized PE string.");
    return new TextDecoder("windows-1252").decode(bytes.subarray(off, end));
  };
  if (!has(0, 64) || bytes[0] !== 0x4d || bytes[1] !== 0x5a)
    return base(bytes, "not-pe", "No complete DOS MZ header.");
  try {
    const pe = u32(0x3c);
    if (!has(pe, 24) || u32(pe) !== 0x00004550)
      throw Error("Invalid PE signature or COFF header.");
    const machine = u16(pe + 4), sectionCount = u16(pe + 6);
    const optionalSize = u16(pe + 20), characteristics = u16(pe + 22);
    if (!sectionCount || sectionCount > 96) throw Error("Invalid PE section count.");
    const opt = pe + 24, sectionsStart = opt + optionalSize;
    if (!has(opt, optionalSize) || !has(sectionsStart, 40 * sectionCount))
      throw Error("Invalid PE optional or section headers.");
    const magic = u16(opt), peFormat = magic === 0x10b ? "PE32" :
      magic === 0x20b ? "PE32+" : null;
    if (!peFormat) throw Error("Unknown PE optional-header kind.");
    const dataDirectoryOffset = magic === 0x10b ? 96 : 112;
    const directories = magic === 0x10b ? 92 : 108;
    if (optionalSize < dataDirectoryOffset + 8)
      throw Error("Truncated PE export-directory entry.");
    const directoryCount = u32(opt + directories);
    const sections = Array.from({ length: sectionCount }, (_, index) => {
      const at = sectionsStart + index * 40;
      const virtualSize = u32(at + 8), virtualAddress = u32(at + 12);
      const rawSize = u32(at + 16), rawOffset = u32(at + 20);
      if (rawSize && !has(rawOffset, rawSize))
        throw Error("PE section data extends beyond the file.");
      return { virtualSize, virtualAddress, rawSize, rawOffset };
    });
    const rva = (address, size = 1) => {
      for (const s of sections) {
        if (address < s.virtualAddress || address + size > s.virtualAddress + s.rawSize) continue;
        const offset = s.rawOffset + address - s.virtualAddress;
        if (has(offset, size)) return offset;
      }
      throw Error("PE data RVA is outside file-backed sections.");
    };
    const dll = Boolean(characteristics & 0x2000);
    const format = { ...base(bytes, "pe"),
      machine, architecture: machineNames[machine] ?? "unknown",
      peFormat, isDll: dll, exports: [],
      interfaceEvidence: { comRegistrationExports: false, legacyTKPlugInitExport: false },
    };
    if (directoryCount === 0) return format;
    const exportRva = u32(opt + dataDirectoryOffset);
    const exportSize = u32(opt + dataDirectoryOffset + 4);
    if (!exportRva || !exportSize) return format;
    const exp = rva(exportRva, 40);
    const ordinalBase = u32(exp + 16);
    const functionCount = u32(exp + 20), nameCount = u32(exp + 24);
    if (functionCount > 8192 || nameCount > 8192 || nameCount > functionCount)
      throw Error("Unbounded or invalid PE export table.");
    const funcs = rva(u32(exp + 28), functionCount * 4);
    const names = nameCount ? rva(u32(exp + 32), nameCount * 4) : 0;
    const ordinals = nameCount ? rva(u32(exp + 36), nameCount * 2) : 0;
    for (let index = 0; index < nameCount; index++) {
      const functionIndex = u16(ordinals + index * 2);
      if (functionIndex >= functionCount) throw Error("Export name has invalid function index.");
      const exportName = ascii(rva(u32(names + index * 4)));
      const target = u32(funcs + functionIndex * 4);
      const forwarder = target >= exportRva && target - exportRva < exportSize;
      format.exports.push({ name: exportName, ordinal: ordinalBase + functionIndex,
        ...(forwarder ? { forwardedTo: ascii(rva(target)) } : {}) });
    }
    const named = new Set(format.exports.map(item => item.name));
    format.interfaceEvidence = {
      comRegistrationExports: named.has("DllRegisterServer") &&
        named.has("DllGetClassObject"),
      legacyTKPlugInitExport: named.has("TKPlugInit"),
    };
    return format;
  } catch (error) {
    return base(bytes, "malformed-pe", error.message);
  }
}
