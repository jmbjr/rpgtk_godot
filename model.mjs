const legacyText = new TextDecoder("windows-1252");

function readTextMainFile(bytes) {
  const lines = legacyText.decode(bytes).split(/\r\n|\n|\r/);
  const [signature, majorText, minorText] = lines.map(line => line.trim());
  const major = Number(majorText);
  const minor = Number(minorText);
  if (!["RPGTLKIT MAIN", "RPGTLKIT MAINFORM"].includes(signature.toUpperCase()) || majorText !== "2" || minorText !== "0") {
    throw new Error("This text Main File is outside the supported Toolkit 2.0 layout.");
  }
  if (lines.length < 12) throw new Error("The text Main File startup fields are truncated.");
  return { major, minor, startup: lines[4].trim(), board: lines[10].trim(), character: lines[11].trim() };
}

export function readMainFile(bytes) {
  if (/^RPGTLKIT (?:MAIN|MAINFORM)[\r\n]/i.test(legacyText.decode(bytes.subarray(0, 24)))) {
    return readTextMainFile(bytes);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  function string() {
    const end = bytes.indexOf(0, cursor);
    if (end < 0) throw new Error("The Main File ends before a string terminator.");
    const value = legacyText.decode(bytes.subarray(cursor, end));
    cursor = end + 1;
    return value;
  }
  function integer() {
    if (cursor + 2 > view.byteLength) throw new Error("The Main File header is truncated.");
    const value = view.getInt16(cursor, true);
    cursor += 2;
    return value;
  }
  if (string() !== "RPGTLKIT MAIN") throw new Error("This file does not have a Toolkit Main File signature.");
  const major = integer();
  const minor = integer();
  if (major !== 2 || minor !== 2) throw new Error(`Main File format ${major}.${minor} is outside this viewer’s supported format 2.2.`);
  integer();
  string();
  const projectPath = string();
  const title = string();
  for (let i = 0; i < 5; i++) integer();
  const language = string();
  return { major, minor, projectPath, title, language, startup: string(), board: string(), character: string() };
}

export function resolveAsset(paths, folder, name, root = null) {
  if (!name || name.toLowerCase() === "none") return { status: "unset" };
  const requested = `${folder}/${name.replaceAll("\\", "/")}`.toLowerCase();
  const matches = paths.filter(path => {
    const lower = path.toLowerCase();
    if (root !== null) return lower === `${root}${requested}`.toLowerCase();
    return lower === requested || lower.endsWith(`/${requested}`);
  });
  if (matches.length === 1) return { status: "resolved", path: matches[0] };
  return { status: matches.length ? "ambiguous" : "missing" };
}

export function decodeProgram(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return legacyText.decode(bytes);
  }
}

const lexicalToken = /"[^"]*(?:"|$)|\*.*$|#[a-z_][\w.]*/gi;
const assignment = /^(?:\s*\[[^\]]*\])?[!$]\s*=(?!=)/;
const declaration = /^\s*#method\s+([\w.]+)/i;

export function indexProgram(source, catalog) {
  const lines = source.split(/\r\n|\n|\r/);
  const methods = new Set();
  for (const line of lines) {
    const name = line.match(declaration)?.[1];
    if (name) methods.add(name.toLowerCase());
  }
  const groups = new Map();
  const rows = lines.map((line, index) => {
    const tokens = [];
    const start = line.trimStart();
    if (!start || !/^[#{}:*@]/.test(start)) return { line, tokens };
    const isMethod = declaration.test(line);
    for (const match of line.matchAll(lexicalToken)) {
      const [value] = match;
      if (value.startsWith("*")) {
        tokens.push({ kind: "comment", value, start: match.index });
        break;
      }
      if (!value.startsWith("#")) continue;
      const name = value.slice(1).toLowerCase();
      const tail = line.slice(match.index + value.length);
      const kind = assignment.test(tail) ? "assignment" :
        name === "method" && isMethod ? "declaration" :
        methods.has(name) ? "local" :
        Object.hasOwn(catalog, name) ? "builtin" : "unknown";
      const key = `${kind}:${name}`;
      const token = { key, kind, name, value, start: match.index, line: index + 1 };
      tokens.push(token);
      if (!groups.has(key)) groups.set(key, { key, kind, name, value, lines: [] });
      groups.get(key).lines.push(index + 1);
    }
    return { line, tokens };
  });
  const builtins = [...groups.values()].filter(group => group.kind === "builtin");
  return { rows, groups, builtins, count: builtins.reduce((n, group) => n + group.lines.length, 0) };
}
