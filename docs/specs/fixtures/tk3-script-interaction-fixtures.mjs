// Two distinct, wholly synthetic Toolkit 3 game archives. The production
// GAM/BRD/TEM/ITM/ANM/TST/PRG readers are used without test-only shortcuts.
// No original commercial/game-demo bytes are included.
import { readFile } from "node:fs/promises";
import JSZip from "../../vendor/jszip.min.js";
import { nativeMainFixture } from "./native-main-29-fixtures.mjs";
import { board24Fixtures } from "./board-24-fixtures.mjs";
import { character28, nativeAnims, testTileset } from "./native-character-28-fixtures.mjs";
import { nativeItem27 } from "./native-item-27-fixtures.mjs";

const specs = Object.freeze([
  Object.freeze({
    id: "harbor", root: "HarborLab", main: "HarborLab.gam",
    title: "Harbor Message Lab", startup: "harbor_start.prg",
    board: "wharf.brd", character: "mira.tem", characterName: "Mira",
    item: "dockbell.itm", itemName: "Dock Bell", script: "bell_greeting.prg",
    position: Object.freeze({ x: 40, y: 42, layer: 1 }),
    variable: "bell_seen",
    first: "Mira: The harbor bell has rung for the first time.",
    repeat: "Mira: The harbor bell remembers your visit.",
  }),
  Object.freeze({
    id: "grove", root: "GroveLab", main: "GroveLab.gam",
    title: "Grove Message Lab", startup: "grove_start.prg",
    board: "meadow.brd", character: "orio.tem", characterName: "Orio",
    item: "oakidol.itm", itemName: "Old Oak Idol", script: "oak_whisper.prg",
    position: Object.freeze({ x: 67, y: 43, layer: 1 }),
    variable: "oak_visited",
    first: "Orio: The old oak whispers a new name.",
    repeat: "Orio: The oak has met you before.",
  }),
]);
export const scriptFixtureSpecs = specs;

function replaceOnce(bytes, oldString, newString) {
  const input = Buffer.from(bytes);
  const old = Buffer.from(oldString, "latin1");
  const replacement = Buffer.from(newString, "latin1");
  const offset = input.indexOf(old);
  if (offset < 0 || input.indexOf(old, offset + 1) !== -1)
    throw Error("Expected unique source fixture byte segment: " + JSON.stringify(oldString));
  return Buffer.concat([input.subarray(0, offset), replacement, input.subarray(offset + old.length)]);
}

function changeSource(bytes, changes) {
  return changes.reduce((result, [oldText, newText]) => replaceOnce(
    result, oldText + "\0", newText + "\0"), Buffer.from(bytes));
}
function i16(...values) {
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((n, i) => bytes.writeInt16LE(n, i * 2));
  return bytes;
}
function alterPosition(bytes, position) {
  const original = i16(1, 1, 38, 52, 1, -1);
  const wanted = i16(1, 1, position.x, position.y, position.layer, -1);
  const source = Buffer.from(bytes);
  const index = source.indexOf(original);
  if (index < 0 || source.indexOf(original, index + original.length) !== -1)
    throw Error("Expected one synthetic BRD placement with 38,52,L1");
  return Buffer.concat([source.subarray(0, index), wanted,
    source.subarray(index + original.length)]);
}
export function sourceForScriptFixture(spec) {
  return [
    "// All words, characters and game artwork here are synthetic.",
    "if (" + spec.variable + " == 0)",
    "{",
    "  mwin(" + JSON.stringify(spec.first) + ")",
    "  wait()",
    "  mwinCls()",
    "  " + spec.variable + " = 1",
    "}",
    "else",
    "{",
    "  mwin(" + JSON.stringify(spec.repeat) + ")",
    "  wait()",
    "  mwinCls()",
    "}",
    "",
  ].join("\n");
}

export async function buildScriptFixtureZip(spec) {
  const zip = new JSZip();
  const r = spec.root;
  const gam = changeSource(nativeMainFixture, [
    ["Test main configuration", spec.title],
    ["menuTitle.prg", spec.startup],
    ["start.brd", spec.board],
    ["bruce.tem", spec.character],
  ]);
  const tem = changeSource(character28, [["Test Bruce", spec.characterName]]);
  // The fixture BRD slot 0 is source-owned jim.itm without activation.
  // Replace its filename and empty activation string with two actual
  // source references, then edit only its stored position.
  const withActivation = replaceOnce(board24Fixtures.standard,
    "jim.itm\0\0", spec.item + "\0" + spec.script + "\0");
  const brd = alterPosition(withActivation, spec.position);
  const itm = changeSource(nativeItem27({ emptyGraphics: true }),
    [["Synthetic Amulet", spec.itemName]]);
  zip.file(spec.main, gam);
  zip.file(r + "/Boards/" + spec.board, brd);
  zip.file(r + "/Chrs/" + spec.character, tem);
  zip.file(r + "/Item/" + spec.item, itm);
  zip.file(r + "/Prg/" + spec.startup, "// Synthetic startup; not executed by direct board launch.\n");
  zip.file(r + "/Prg/" + spec.script, sourceForScriptFixture(spec));
  // Different scripts may reference the same shared synthetic animation
  // filenames, but only within each independent archive namespace.
  for (const [file, bytes] of nativeAnims)
    zip.file(r + "/Misc/" + file, bytes);
  zip.file(r + "/Tiles/test-characters.tst", testTileset);
  zip.file(r + "/Tiles/two-tiles.tst",
    await readFile(new URL("./two-tiles.tst", import.meta.url)));
  // Source placed object in slot 1 references another PRG in the
  // original synthetic test board. Omit it deliberately to exercise
  // unresolved reference filtering (without blocking play).
  return zip;
}
