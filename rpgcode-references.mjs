// Static filename evidence. Argument positions follow the command catalog
// and the corresponding Toolkit 3.1 functions.cpp implementations.
// Keep this independent of the executable subset and the legacy command UI.
const graphics = ["bmp", "gif", "jpg", "jpeg", "png", "tbm", "tst", "gph", "tan"];
const audio = ["mid", "midi", "wav", "mp3", "ogg", "wma", "avi"];
const first = (names, folder, types) => names.split(" ").map(name =>
  [name, [[0, { folder, types }]]]);
const roles = new Map([
  ...first("include run thread", "Prg"),
  ...first("send viewbrd", "Boards"),
  ...first("addplayer newplyr", "Chrs"),
  ...first("giveitem takeitem createitem", "Item"),
  ...first("bitmap wingraphic setbutton setimage setimagetransparent setimagetranslucent setimageadditive", undefined, graphics),
  ...first("animation sizedanimation", undefined, ["anm"]),
  ...first("mediaplay midiplay wav mp3 mp3pause", "Media", audio),
  ...first("load save start", undefined),
  ["put", [[2, { types: graphics }]]],
  ["layerput", [[3, { types: graphics }]]],
  ["equip", [[2, { folder: "Item" }]]],
  ["applystatus", [[1, { folder: "StatusE", types: ["ste"] }]]],
  ["fightenemy", []],
]);
const hostCommands = new Set(["load", "save", "start"]);
const identifiers = /#?[a-z_][\w.]*/gi;

function codeMask(row, state) {
  let code = "";
  for (let i = 0; i < row.length;) {
    if (state.block) {
      const close = row.indexOf("*/", i);
      if (close < 0) break;
      i = close + 2;
      state.block = false;
      code = code.padEnd(i);
    } else if (row.startsWith("//", i)) break;
    else if (row.startsWith("/*", i)) {
      i += 2;
      state.block = true;
      code = code.padEnd(i);
    } else if (row[i] === '"') {
      const end = row.indexOf('"', i + 1);
      i = end < 0 ? row.length : end + 1;
      code = code.padEnd(i);
    } else code += row[i++];
  }
  return code.padEnd(row.length);
}

function callArguments(mask, row, start) {
  let depth = 1;
  let left = start + 1;
  const args = [];
  for (let i = left; i < mask.length; i++) {
    const char = mask[i];
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (depth === 0 || (depth === 1 && char === ",")) {
      args.push(row.slice(left, i).trim());
      if (depth === 0) return args;
      left = i + 1;
    }
  }
}

// Tolerant static call syntax, shared by references and source excerpts. This
// does not validate method availability or require the executable VM subset.
const controlForms = new Set(["if", "elseif", "while", "until", "for", "switch", "case", "method"]);
export function indexRpgcodeCommands(source) {
  const calls = [];
  const state = { block: false };
  for (const [index, row] of source.split(/\r\n?|\n/).entries()) {
    if (!state.block && /^\s*\*(?!\/)/.test(row)) continue;
    const mask = codeMask(row, state);
    for (const match of mask.matchAll(identifiers)) {
      const [evidence] = match;
      const command = evidence.replace(/^#/, "").toLowerCase();
      const before = mask.slice(0, match.index);
      if (/\bmethod\s+$/i.test(before) || controlForms.has(command)) continue;
      const tail = match.index + evidence.length;
      const opening = mask.slice(tail).match(/^\s*\(/);
      const legacy = evidence.startsWith("#");
      if (!opening && (!legacy || !/^\s*"/.test(row.slice(tail)))) continue;
      const args = opening ? callArguments(mask, row, tail + opening[0].length - 1) :
        [row.slice(tail).trim()];
      calls.push({ evidence, command, line: index + 1, column: match.index + 1,
        member: /->\s*$|[.\w$!>]$/.test(before),
        args, rawArguments: row.slice(tail).trim() });
    }
  }
  return calls;
}

export function indexRpgcodeReferences(source) {
  const refs = [];
  for (const call of indexRpgcodeCommands(source)) {
    const { command, args, evidence, line, member, rawArguments } = call;
    if (member || !roles.has(command)) continue;
    const location = { evidence, line };
    if (!args) {
      refs.push({ ...location, value: rawArguments, status: "Unindexed" });
      continue;
    }
    const rules = command === "fightenemy" && args.length >= 2 ?
      args.map((_, i) => [i, { folder: i === args.length - 1 ? "Bkrounds" : "Enemy" }]) :
      roles.get(command);
    for (const [argument, role] of rules) {
      const raw = args[argument];
      if (!raw) continue;
      const literal = raw.match(/^"([^"]*)"$/);
      if (literal?.[1]) refs.push({ ...location, ...role, argument: argument + 1, value: literal[1],
        ...(hostCommands.has(command) ? { status: "External" } : {}) });
      else if (!literal) refs.push({ ...location, ...role, argument: argument + 1, value: raw, status: "Dynamic" });
    }
  }
  return refs;
}

// BRD program strings are either a project PRG filename or RPGCode text.
export const boardProgramFilename = value => /^[^\\/:"*?<>|]+\.prg$/i.test(value);
