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
  if (major !== 2 || ![2, 9].includes(minor)) {
    throw new Error(`Main File format ${major}.${minor} is outside this viewer’s supported binary formats 2.2 and 2.9.`);
  }
  integer();
  string();
  const projectPath = string();
  const title = string();
  // 2.2 includes a legacy parallax i16 before registration protection.
  // Toolkit 3 GAM 2.9 omits it: reading five values shifts every link.
  const screenFields = Array.from({ length: minor < 3 ? 5 : 4 }, integer);
  const language = string();
  const main = { major, minor, projectPath, title, language,
    startup: string(), board: string(), character: string() };
  // Preserve the original prefix-only synthetic fixtures and Toolkit 2
  // profile. A real Toolkit 3 Main File continues after these three links.
  if (minor !== 9 || cursor === bytes.length) return main;

  function byte() {
    if (cursor + 1 > view.byteLength) throw new Error("The Main File tail is truncated.");
    return view.getUint8(cursor++);
  }
  function long() {
    if (cursor + 4 > view.byteLength) throw new Error("The Main File tail is truncated.");
    const value = view.getInt32(cursor, true);
    cursor += 4;
    return value;
  }
  function maximum(label, upperBound) {
    const count = integer();
    if (count < -1 || count > upperBound) throw new Error("Invalid " + label + " maximum index.");
    return count;
  }
  const runtimeProgram = string();
  const runtimeKeys = {
    runKey: integer(), menuKey: integer(), generalKey: integer(),
    extended: Array.from({ length: maximum("runtime key", 500) + 1 }, (_, slot) =>
      ({ slot, key: integer(), program: string() })),
  };
  const menuPlugin = string();
  const fightPlugin = string();
  const combat = {
    enabled: integer(),
    enemies: Array.from({ length: maximum("enemy", 500) + 1 }, (_, slot) =>
      ({ slot, name: string(), skill: integer() })),
    type: integer(), chances: long(), useAlternateProgram: integer(),
    fightProgram: string(), gameOverProgram: string(),
  };
  const skins = { button: string(), window: string() };
  // Inclusive maximum indices are not populated counts. In BSTW there
  // are nine plugin slots (0–8) but only five nonempty declarations.
  const pluginSlots = Array.from({ length: maximum("plugin", 100) + 1 },
    (_, slot) => ({ slot, filename: string() }));
  const dayNight = { enabled: integer(), type: integer(), length: long() };
  const cursorSettings = {
    moveSound: string(), selectSound: string(), cancelSound: string(),
    joystick: byte(), colorDepth: byte(), gameSpeed: byte(), pixelMovement: byte(),
    image: string(), hotspotX: byte(), hotspotY: byte(), transparentColor: long(),
  };
  const display = { width: long(), height: long(), fpsInTitleBar: byte() };
  const pathfinding = {
    heuristic: integer(), drawVectors: long(), pathColor: long(),
    movementControls: long(),
    // MV_MIN..MV_MAX are 0..7 in this native profile (eight i16 keys).
    movementKeys: Array.from({ length: 8 }, integer),
  };
  if (cursor !== bytes.length) {
    throw new Error("Unexpected bytes after the Toolkit 3 Main File settings.");
  }
  return {
    ...main,
    configuration: {
      screen: { type: screenFields[0], fullScreen: screenFields[1],
        resolution: screenFields[2], disableProtection: screenFields[3] },
      runtimeProgram, runtimeKeys, menuPlugin, fightPlugin,
      combat, skins, pluginSlots, dayNight,
      cursor: cursorSettings, display, pathfinding,
    },
  };
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

export function mainFileBindings(mainFile, paths) {
  const startup = resolveAsset(paths.filter(path => /\.prg$/i.test(path)), "Prg", mainFile.startup);
  const folder = startup.path?.slice(0, startup.path.lastIndexOf("/"));
  const startupRoot = folder === undefined ? null : folder.slice(0, folder.lastIndexOf("/") + 1);
  const bindings = [
    ["Configured startup", { ...startup, value: mainFile.startup }],
    ["Opening board", { ...resolveAsset(paths, "Boards", mainFile.board, startupRoot), value: mainFile.board }],
    ["Initial character", { ...resolveAsset(paths, "Chrs", mainFile.character, startupRoot), value: mainFile.character }],
  ];
  const config = mainFile.configuration;
  if (!config) return bindings;
  const add = (evidence, folderName, value) => {
    if (!value || value.toLowerCase() === "none") return;
    const target = resolveAsset(paths, folderName, value, startupRoot);
    bindings.push([evidence, { ...target, value }]);
  };
  add("Runtime program", "Prg", config.runtimeProgram);
  for (const entry of config.runtimeKeys.extended) {
    add(`Runtime key · slot ${entry.slot}`, "Prg", entry.program);
  }
  add("Menu system plugin", "Plugin", config.menuPlugin);
  add("Fight system plugin", "Plugin", config.fightPlugin);
  add("Fight program", "Prg", config.combat.fightProgram);
  add("Game-over program", "Prg", config.combat.gameOverProgram);
  for (const enemy of config.combat.enemies) {
    add(`Enemy · slot ${enemy.slot}`, "Enemy", enemy.name);
  }
  for (const plugin of config.pluginSlots) {
    add(`Declared plugin · slot ${plugin.slot}`, "Plugin", plugin.filename);
  }
  for (const name of ["moveSound", "selectSound", "cancelSound"]) {
    add(`Cursor ${name}`, "Media", config.cursor[name]);
  }
  return bindings;
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
