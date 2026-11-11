// Source file revisions are independent of Toolkit product releases and JSON schemas.
const text = new TextDecoder("windows-1252");
const signatures = {
  gam: ["RPGTLKIT MAIN", "RPGTLKIT MAINFORM"], tem: ["RPGTLKIT CHAR"], brd: ["RPGTLKIT BOARD"],
  itm: ["RPGTLKIT ITEM"], ene: ["RPGTLKIT ENEMY"], bkg: ["RPGTLKIT BKG"],
  spc: ["RPGTLKIT SPLMOVE"], ste: ["RPGTLKIT STATUSE"], anm: ["RPGTLKIT ANIM"],
  fnt: ["RPGTLKIT FONT"], gph: ["RPGTLKIT TILE"], tan: ["RPGTLKIT TILEANIM"],
};
const revisions = {
  gam: { text: ["2.0"], binary: ["2.2"] }, tem: { text: ["2.0", "2.1", "2.2"], binary: ["2.3", "2.4"] },
  brd: { text: ["2.0", "2.1"], binary: ["2.2", "2.3"] }, itm: { text: ["2.0", "2.1"], binary: ["2.2", "2.3"] },
  ste: { text: ["2.0"], binary: ["2.2"] }, tan: { binary: ["2.0"] },
};
export const formatSpecs = {
  gam: "gam", prg: "prg", tst: "tst", tan: "tan", tem: "tem", brd: "brd", itm: "itm",
  ene: "ene", bkg: "bkg", spc: "spc", anm: "anm", gph: "gph", fnt: "fnt", ste: "ste",
  gif: "gif", jpg: "jpg", jpeg: "jpg", wav: "wav", mid: "mid", doc: "doc", ___: "temporary-board",
};
export const toolkitAsset = type => Object.hasOwn(signatures, type) || ["tst", "prg", "___", "tbm", "iso"].includes(type);
const unknown = () => ({ encoding: "unknown", version: null, supported: false });

export function detectSourceFormat(type, bytes) {
  if (!toolkitAsset(type)) return undefined;
  if (type === "prg") return { encoding: "source", version: null, supported: true };
  if (type === "___") return unknown(); // Observed records have no verified version field.
  if (type === "tst") {
    if (bytes.length < 2) return unknown();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = String(view.getInt16(0, true));
    const detail = bytes.length >= 6 ? view.getInt16(4, true) : undefined;
    return { encoding: "binary", version, ...(detail === undefined ? {} : { detail }),
      supported: version === "20" && [1, 2, 3, 4, 5, 6].includes(detail) };
  }
  const lines = text.decode(bytes.subarray(0, 256)).split(/\r\n|\n|\r/);
  let signature = lines[0]?.trim().toUpperCase();
  let encoding, version, detail;
  if (/^RPGTLKIT [A-Z]+$/.test(signature) && /^\d+$/.test(lines[1]?.trim()) && /^\d+$/.test(lines[2]?.trim())) {
    if (![Number(lines[1].trim()), Number(lines[2].trim())].every(Number.isSafeInteger)) return unknown();
    encoding = "text";
    version = `${Number(lines[1].trim())}.${Number(lines[2].trim())}`;
    if (type === "gph" && /^[+-]?\d+$/.test(lines[3]?.trim())) detail = Number(lines[3].trim());
  } else {
    const end = bytes.indexOf(0);
    if (end < 0 || end > 80 || bytes.length < end + 5) return unknown();
    signature = text.decode(bytes.subarray(0, end));
    if (!/^RPGTLKIT [A-Z]+$/.test(signature)) return unknown();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    encoding = "binary";
    version = `${view.getInt16(end + 1, true)}.${view.getInt16(end + 3, true)}`;
  }
  const validSignature = signatures[type]?.includes(signature) && !(encoding === "binary" && signature === "RPGTLKIT MAINFORM");
  const accepted = revisions[type]?.[encoding] ?? (encoding === "text" && !revisions[type] ? ["2.0"] : []);
  return { encoding, version, ...(detail === undefined ? {} : { detail }),
    supported: Boolean(validSignature && accepted.includes(version) && (type !== "gph" || [1, 2, 3, 4, 5, 6].includes(detail))) };
}

export function mainSourceFormat(file) {
  return file.sourceFormat ?? { encoding: file.minor === 0 ? "text" : "binary", version: `${file.major}.${file.minor}`, supported: file.major === 2 && [0, 2].includes(file.minor) };
}

export function formatSummary({ type, sourceFormat }) {
  if (!toolkitAsset(type)) return `${type.toUpperCase() || "Unknown"} · Standard media or archive entry · No Toolkit format version`;
  const f = sourceFormat ?? unknown();
  if (type === "prg") return "PRG · RPGCode source · No stored file-format version";
  if (f.version === null) return `${type.toUpperCase()} · File-format version unavailable · ${type === "___" ? "Unversioned observed text layout" : "Header unrecognized or truncated"}`;
  return `${type.toUpperCase()} · ${f.encoding === "text" ? "Text" : "Binary"} ${f.version}`
    + (f.detail === undefined ? "" : ` · Detail ${f.detail}`)
    + (f.supported ? "" : " · Unsupported layout");
}

export function formatSpecTarget({ type, sourceFormat }) {
  const page = formatSpecs[type] ?? "other";
  if (!toolkitAsset(type)) return { page, anchor: "" };
  if (type === "prg") return { page, anchor: "#unversioned-source" };
  if (type === "___") return { page, anchor: "#unversioned-observed-layout" };
  if (!sourceFormat?.supported) return { page, anchor: "#unsupported-versions" };
  const { encoding, version, detail } = sourceFormat;
  return { page, anchor: `#${encoding}-${version.replaceAll(".", "")}${detail === undefined ? "" : `-detail-${detail}`}` };
}
