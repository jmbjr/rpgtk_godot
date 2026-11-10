import { decodeProgram, indexProgram, readMainFile } from "./model.mjs";
import { readCompoundDocument, readGif, readJpeg, readMidi, readWave } from "./media.mjs";

const text = new TextDecoder("windows-1252");
export const extension = path => path.match(/\.([^.\/]+)$/)?.[1].toLowerCase() ?? "";
export const directory = path => path.slice(0, path.lastIndexOf("/") + 1);
export const basename = path => path.slice(path.lastIndexOf("/") + 1);

function cursor(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  function skip(size) {
    if (offset + size > bytes.length) throw new Error("The file is truncated.");
    offset += size;
  }
  return {
    skip,
    byte() { skip(1); return view.getUint8(offset - 1); },
    short() { skip(2); return view.getInt16(offset - 2, true); },
    long() { skip(4); return view.getInt32(offset - 4, true); },
    string() {
      const end = bytes.indexOf(0, offset);
      if (end < 0) throw new Error("The file ends before a string terminator.");
      const value = text.decode(bytes.subarray(offset, end));
      offset = end + 1;
      return value;
    },
  };
}

function header(reader, signature, minors) {
  const actual = reader.string();
  const major = reader.short();
  const minor = reader.short();
  if (actual !== signature || major !== 2 || !minors.includes(minor)) {
    throw new Error("This legacy file format is outside the supported demo layouts.");
  }
  return minor;
}

const reference = (value, evidence, line) => ({ value, evidence, line });

export function readTileset(bytes) {
  const reader = cursor(bytes);
  const version = reader.short();
  const count = reader.short();
  const detail = reader.short();
  if (version !== 20 || detail !== 1) throw new Error("This viewer supports version 20, detail 1 tilesets.");
  if (count < 0 || bytes.length !== 6 + count * 3072) throw new Error("The tileset size does not match its header.");
  return { count, bytes };
}

export function tilePixels(tileset, number) {
  if (!Number.isInteger(number) || number < 1 || number > tileset.count) return null;
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  let source = 6 + (number - 1) * 3072;
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 32; y++) {
      const offset = (y * 32 + x) * 4;
      const r = tileset.bytes[source++];
      const g = tileset.bytes[source++];
      const b = tileset.bytes[source++];
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = r === 0 && g === 1 && b === 2 ? 0 : 255;
    }
  }
  return rgba;
}

function readAnimation(bytes) {
  const reader = cursor(bytes);
  header(reader, "RPGTLKIT TILEANIM", [0]);
  const speed = reader.long();
  const count = reader.long();
  if (count < 0 || count > bytes.length - 29) throw new Error("Invalid animation frame count.");
  const refs = Array.from({ length: count }, (_, index) => reference(reader.string(), `Frame ${index + 1}`));
  return { speed, refs };
}

const boardAmbient = [[0, 0, 0], [75, 75, 75], [-75, -75, -75], [0, 0, 75]];
const boardDirections = ["North", "South", "East", "West"];
const boardPositionLabel = ({ x, y, layer }) => `(${x}, ${y}, layer ${layer})`;

function boardTileReferences(lookup, placements) {
  return [...placements].map(([index, tiles]) => ({
    ...reference(lookup[index], `Board tile lookup · entry ${index} · ${tiles} placed`),
    index,
    tiles,
  }));
}

function readTextBoard(bytes) {
  const reader = textReader(bytes, "RPGTLKIT BOARD", [0, 1]);
  const integer = () => {
    const value = reader.number();
    if (!Number.isSafeInteger(value)) throw new Error("Invalid board integer.");
    return value;
  };
  const skip = count => {
    for (let i = 0; i < count; i++) reader.string();
  };
  skip(2); // Registration flag and code.
  const width = reader.minor === 0 ? 19 : integer();
  const height = reader.minor === 0 ? 11 : integer();
  const layers = 8;
  const cells = width * height * layers;
  if (width < 1 || height < 1 || cells > 2_000_000) throw new Error("Unsupported board dimensions.");
  if (reader.remaining() < cells * 5) throw new Error("The text board tile grid is truncated.");

  const lookup = [""];
  const indices = new Map();
  const runs = [];
  const placements = new Map();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let layer = 0; layer < layers; layer++) {
        const value = reader.string();
        const shade = [integer(), integer(), integer()];
        integer(); // Tile type.
        if (!value) continue;
        if (!indices.has(value)) {
          indices.set(value, lookup.length);
          lookup.push(value);
        }
        const index = indices.get(value);
        const offset = (layer * height + y) * width + x;
        runs.push({ offset, length: 1, index, shade });
        placements.set(index, (placements.get(index) ?? 0) + 1);
      }
    }
  }
  runs.sort((a, b) => a.offset - b.offset);

  const refs = boardTileReferences(lookup, placements);
  const add = (value, evidence, position) => {
    if (value && value.toLowerCase() !== "none") {
      refs.push({ ...reference(value, evidence), ...(position ? { position } : {}) });
    }
  };
  const readPosition = () => ({ x: integer(), y: integer(), layer: integer() });
  add(reader.string(), "Board background image");
  add(reader.string(), "Border background image");
  const background = integer();
  skip(1); // Border color.
  const ambient = boardAmbient[integer()] ?? boardAmbient[0];
  for (const direction of boardDirections) add(reader.string(), `${direction} board link`);
  skip(1); // Battle skill.
  add(reader.string(), "Battle background");
  skip(11); // Battle flag and ten board constants.
  add(reader.string(), "Board music");
  const layerTitles = ["", ...Array.from({ length: layers }, () => reader.string())];

  for (let i = 0; i < 51; i++) {
    const program = reader.string();
    const position = readPosition();
    const graphic = reader.string();
    skip(6);
    add(program, `Board program ${boardPositionLabel(position)}`, position);
    add(graphic, `Program graphic ${boardPositionLabel(position)}`, position);
  }
  const itemPositions = [];
  for (let i = 0; i < 11; i++) {
    const item = reader.string();
    const position = readPosition();
    itemPositions.push(position);
    skip(6);
    add(item, `Board item ${boardPositionLabel(position)}`, position);
  }
  skip(3); // Player start coordinates.
  for (const position of itemPositions) {
    add(reader.string(), `Item activation program ${boardPositionLabel(position)}`, position);
  }
  skip(1); // Save flag.
  for (const position of itemPositions) {
    add(reader.string(), `Item multitask program ${boardPositionLabel(position)}`, position);
  }
  return { width, height, layers, layerTitles, lookup, runs, background, ambient, refs };
}

function readBoard(bytes) {
  if (/^RPGTLKIT BOARD[\r\n]/i.test(text.decode(bytes.subarray(0, 16)))) return readTextBoard(bytes);
  const reader = cursor(bytes);
  header(reader, "RPGTLKIT BOARD", [2, 3]);
  reader.skip(2);
  reader.string();
  const width = reader.short();
  const height = reader.short();
  const layers = reader.short();
  const cells = width * height * layers;
  if (width < 1 || height < 1 || layers < 1 || cells > 2_000_000) throw new Error("Unsupported board dimensions.");
  reader.skip(8);
  const count = reader.short() + 1;
  if (count < 1 || count > bytes.length) throw new Error("Invalid board tile lookup count.");
  const lookup = Array.from({ length: count }, () => reader.string());
  const runs = [];
  const placements = new Map();
  for (let offset = 0; offset < cells;) {
    const token = reader.short();
    const length = token < 0 ? -token : 1;
    const index = token < 0 ? reader.short() : token;
    const shade = [reader.short(), reader.short(), reader.short()];
    reader.byte(); // Tile type is independent of the graphic.
    if (index < 0 || index >= lookup.length || offset + length > cells) throw new Error("Invalid board tile run.");
    if (index && lookup[index]) {
      runs.push({ offset, length, index, shade });
      placements.set(index, (placements.get(index) ?? 0) + length);
    }
    offset += length;
  }

  const refs = boardTileReferences(lookup, placements);
  const add = (value, evidence, position) => {
    if (value && value.toLowerCase() !== "none") {
      refs.push({ ...reference(value, evidence), ...(position ? { position } : {}) });
    }
  };
  const readPosition = () => ({ x: reader.short(), y: reader.short(), layer: reader.short() });
  add(reader.string(), "Board background image");
  reader.string();
  reader.string();
  const background = reader.long();
  reader.skip(4);
  const ambient = boardAmbient[reader.short()] ?? boardAmbient[0];
  for (const direction of boardDirections) add(reader.string(), `${direction} board link`);
  reader.skip(2);
  add(reader.string(), "Battle background");
  reader.skip(8);
  reader.string();
  reader.skip(22);
  add(reader.string(), "Board music");
  const layerTitles = Array.from({ length: 9 }, () => reader.string());

  const programCount = reader.short() + 1;
  if (programCount < 0 || programCount > bytes.length) throw new Error("Invalid board program count.");
  for (let i = 0; i < programCount; i++) {
    const program = reader.string();
    const position = readPosition();
    const graphic = reader.string();
    reader.skip(2);
    for (let j = 0; j < 4; j++) reader.string();
    reader.skip(2);
    add(program, `Board program ${boardPositionLabel(position)}`, position);
    add(graphic, `Program graphic ${boardPositionLabel(position)}`, position);
  }
  add(reader.string(), "Board entry program");
  reader.string();

  const itemCount = reader.short() + 1;
  if (itemCount < 0 || itemCount > bytes.length) throw new Error("Invalid board item count.");
  for (let i = 0; i < itemCount; i++) {
    const item = reader.string();
    const position = readPosition();
    reader.skip(2);
    for (let j = 0; j < 4; j++) reader.string();
    reader.skip(2);
    add(item, `Board item ${boardPositionLabel(position)}`, position);
    add(reader.string(), `Item activation program ${boardPositionLabel(position)}`, position);
    add(reader.string(), `Item multitask program ${boardPositionLabel(position)}`, position);
  }
  return { width, height, layers, layerTitles, lookup, runs, background, ambient, refs };
}

export function boardTilesets(edges, graph, artifacts) {
  const sets = new Map();
  function collect(edge, animation) {
    if (artifacts.get(edge.to)?.type !== "tst") return;
    if (!sets.has(edge.to)) sets.set(edge.to, { direct: new Set(), animations: new Set() });
    const set = sets.get(edge.to);
    if (animation) set.animations.add(animation);
    else if (edge.tile !== undefined) set.direct.add(edge.tile);
  }
  for (const edge of edges) {
    collect(edge);
    if (artifacts.get(edge.to)?.type === "tan") {
      for (const frame of graph.outgoing.get(edge.to) ?? []) collect(frame, edge.to);
    }
  }
  return sets;
}

function readCharacter(bytes) {
  const reader = cursor(bytes);
  const minor = header(reader, "RPGTLKIT CHAR", [3, 4]);
  const name = reader.string();
  for (let i = 0; i < 9; i++) reader.string();
  const stats = Object.fromEntries(
    ["XP", "HP", "Max HP", "Defense", "Fight", "Special power", "Max special power", "Level"]
      .map(label => [label, reader.long()]),
  );
  const profile = reference(reader.string(), "Character portrait");
  const refs = [profile];
  for (let i = 0; i < 201; i++) {
    refs.push(reference(reader.string(), `Special move slot ${i}`));
    reader.skip(8);
    reader.string();
    reader.string();
  }
  reader.string();
  reader.skip(1);
  for (let i = 0; i < 11; i++) reader.string();
  reader.skip(7); // Armor types.
  reader.skip(minor === 3 ? 1 : 4); // Level type.
  reader.skip(14); // Experience and level progression.
  for (const label of ["Attack", "Defense", "Special move", "Defeat"]) refs.push(reference(reader.string(), `${label} sound`));
  refs.push(reference(reader.string(), "Level-up program"));
  reader.skip(2);
  const walking = [];
  for (const direction of ["South", "East", "North", "West"]) {
    for (let frame = 1; frame <= 4; frame++) {
      const parts = ["top", "bottom"].map(part => reference(reader.string(), `Walk ${direction.toLowerCase()} · frame ${frame} · ${part}`));
      refs.push(...parts);
      walking.push({ direction, frame, parts });
    }
  }
  return { name, stats, profile, walking, refs: refs.filter(ref => ref.value) };
}

// Use documented file-taking commands, so prose in #MWin cannot create an edge.
const FILE_COMMANDS = new Set(("addplayer newplyr send viewbrd run include prg put layerput bitmap wingraphic setbutton setimage " +
  "setimagetransparent setimagetranslucent setimageadditive giveitem takeitem equip createitem fightenemy " +
  "animation sizedanimation mediaplay midiplay mp3 wav applystatus").split(" "));
const externalFileCommands = new Set(["load", "save", "start"]);
const firstFileArgument = new Set(["run", "include", "send", "viewbrd", ...externalFileCommands]);
function readProgram(bytes, catalog) {
  const program = indexProgram(decodeProgram(bytes), catalog);
  const refs = [];
  for (const row of program.rows) {
    for (const [index, token] of row.tokens.entries()) {
      if (token.kind !== "builtin") continue;
      const args = row.line.slice(token.start + token.value.length, row.tokens[index + 1]?.start);
      if (firstFileArgument.has(token.name) && /^\s*\(/.test(args)) {
        const literal = args.match(/^\s*\(\s*"([^"]*)"\s*(?:,|\))/);
        if (literal?.[1]) {
          refs.push({ ...reference(literal[1], token.value, token.line),
            ...(externalFileCommands.has(token.name) ? { status: "External" } : {}) });
        } else if (!literal && /^\s*\(\s*[^)\s]/.test(args)) {
          refs.push({ ...reference(args.trim(), token.value, token.line), status: "Dynamic" });
        }
        continue;
      }
      if (!FILE_COMMANDS.has(token.name)) continue;
      for (const match of args.matchAll(/"([^"]+)"/g)) {
        if (/\.[a-z][a-z0-9]{1,5}$/i.test(match[1])) refs.push(reference(match[1], token.value, token.line));
      }
    }
  }
  return { program, refs };
}

function textReader(bytes, signature, minors = [0]) {
  const lines = decodeProgram(bytes).split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  let position = 0;
  function string() {
    if (position >= lines.length) throw new Error("The file is truncated.");
    return lines[position++].trim();
  }
  function number() {
    const value = Number(string());
    if (!Number.isFinite(value)) throw new Error("Invalid numeric field.");
    return value;
  }
  const validHeader = string().toUpperCase() === signature && number() === 2;
  const minor = validHeader ? number() : undefined;
  if (!minors.includes(minor)) {
    const versions = minors.map(version => `2.${version}`).join(" or ");
    throw new Error(`This text file is outside the supported Toolkit ${versions} layout.`);
  }
  return { minor, string, number, remaining: () => lines.length - position };
}

function fields(reader, names) {
  const refs = [];
  const values = Object.fromEntries(names.map(name => {
    const value = reader.string();
    if (value && value.toLowerCase() !== "none") refs.push(reference(value, name));
    return [name, value];
  }));
  return { values, refs };
}

function readBackground(bytes) {
  const reader = textReader(bytes, "RPGTLKIT BKG");
  const width = 19;
  const height = 11;
  const tiles = Array.from({ length: width * height }, () => reader.string());
  const { values: audio, refs } = fields(reader, ["Music", "Select sound", "Choose sound", "Ready sound", "Invalid action sound"]);
  reader.string(); // Reserved field.
  const shading = tiles.map(() => [reader.number(), reader.number(), reader.number()]);
  tiles.forEach((tile, i) => {
    if (tile) refs.push(reference(tile, `Background tile (${Math.floor(i / height) + 1}, ${i % height + 1})`));
  });
  return { width, height, order: "column-major", tiles, audio, shading, refs };
}

function readEnemy(bytes) {
  const reader = textReader(bytes, "RPGTLKIT ENEMY");
  const name = reader.string();
  const stats = Object.fromEntries(["HP", "Special power", "Fight", "Defense"].map(label => [label, reader.number()]));
  const canFlee = Boolean(reader.number());
  const sneakChance = reader.number();
  const sneakUp = reader.number();
  const width = reader.number();
  const height = reader.number();
  const tiles = Array.from({ length: 19 * 7 }, () => reader.string());
  const specialMoves = [];
  const weaknesses = [];
  const refs = [];
  for (let i = 0; i <= 100; i++) {
    specialMoves.push(reader.string());
    weaknesses.push(reader.string());
  }
  const ai = reader.number();
  const usesScript = Boolean(reader.number());
  const script = reader.string();
  const xp = reader.number();
  const gold = reader.number();
  const { values: programs, refs: programRefs } = fields(reader, ["Victory program", "Escape program"]);
  refs.push(...programRefs);
  if (script) refs.push(reference(script, "Enemy AI program"));
  const animations = {};
  // Some demo enemies end after the four legacy sound slots.
  const sounds = fields(reader, ["Attack sound", "Defense sound", "Special move sound", "Defeat sound"]);
  if (![0, 4].includes(reader.remaining())) throw new Error("Invalid legacy enemy animation tail.");
  refs.push(...sounds.refs);
  for (const action of ["Attack", "Defense", "Special move", "Defeat"]) {
    if (!reader.remaining()) break;
    const value = reader.string();
    animations[action] = value;
    if (value) refs.push(reference(value, `${action} animation`));
  }
  for (const [label, values] of [["Enemy tile", tiles], ["Special move", specialMoves], ["Weakness", weaknesses]]) {
    values.forEach((value, i) => { if (value) refs.push(reference(value, `${label} · slot ${i + 1}`)); });
  }
  return { name, stats, canFlee, sneakChance, sneakUp, width, height, tileStride: 7, tiles, specialMoves, weaknesses, ai, usesScript, script, xp, gold, programs, sounds: sounds.values, animations, refs };
}

function readSpecialMove(bytes) {
  const reader = textReader(bytes, "RPGTLKIT SPLMOVE");
  const name = reader.string();
  const fightPower = reader.number();
  const cost = reader.number();
  const program = reader.string();
  const targetSpecialPower = reader.number();
  const storedUseFlags = [reader.number(), reader.number()];
  // Verified in the Toolkit 2 editor with the demo's exact 2.0 text file.
  const [board, battle] = storedUseFlags.map(Boolean);
  const { values: assets, refs } = fields(reader, ["Status effect", "Animation"]);
  if (program) refs.push(reference(program, "Special move program"));
  const description = reader.string();
  return { name, fightPower, cost, program, targetSpecialPower, battle, board, storedUseFlags, assets, description, refs };
}

function readStatusEffect(bytes) {
  const reader = cursor(bytes);
  const version = header(reader, "RPGTLKIT STATUSE", [2]);
  const name = reader.string();
  const rounds = reader.short();
  const speed = Boolean(reader.short());
  const slow = Boolean(reader.short());
  const disable = Boolean(reader.short());
  const removeHp = Boolean(reader.short());
  const hpAmount = reader.short();
  const removeSmp = Boolean(reader.short());
  const smpAmount = reader.short();
  const runProgram = Boolean(reader.short());
  const program = reader.string();
  const refs = program ? [reference(program, "Status effect program")] : [];
  return { version, name, rounds, speed, slow, disable, removeHp, hpAmount, removeSmp, smpAmount, runProgram, program, refs };
}

function readLegacyAnimation(bytes) {
  const reader = textReader(bytes, "RPGTLKIT ANIM");
  const width = reader.number();
  const height = reader.number();
  const storedFrameCount = reader.number();
  const refs = [];
  const frames = Array.from({ length: 51 }, (_, index) => {
    const image = reader.string();
    const transparentColor = reader.number();
    const sound = reader.string();
    if (image) refs.push(reference(image, `Frame ${index + 1} image`));
    if (sound) refs.push(reference(sound, `Frame ${index + 1} sound`));
    return { image, transparentColor, sound };
  });
  const pauseSeconds = reader.number();
  return { width, height, storedFrameCount, frames, pauseSeconds, refs };
}

function readFont(bytes) {
  const reader = textReader(bytes, "RPGTLKIT FONT");
  const glyphs = Array.from({ length: 256 }, () => Array.from({ length: 8 }, () => {
    const value = reader.number();
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new Error("Invalid glyph row byte.");
    return value;
  }));
  return { width: 8, height: 8, glyphs };
}

function readStandaloneTile(bytes) {
  const reader = textReader(bytes, "RPGTLKIT TILE");
  const detail = reader.number();
  const compressed = reader.number();
  if (![1, 2].includes(detail) || ![0, 1].includes(compressed)) throw new Error("Unsupported standalone tile encoding.");
  const size = detail === 1 ? 32 : 16;
  const pixels = [];
  while (pixels.length < size * size) {
    const count = compressed ? reader.number() : 1;
    const color = reader.number();
    if (!Number.isInteger(color) || color < -1 || color > 0xffffff) throw new Error("Invalid standalone tile color.");
    if (!Number.isInteger(count) || count < 1 || pixels.length + count > size * size) throw new Error("Invalid standalone tile run.");
    for (let i = 0; i < count; i++) pixels.push(color);
  }
  return { width: size, height: size, detail, compressed: Boolean(compressed), order: "column-major", encoding: "Toolkit COLORREF; -1 is transparent", pixels };
}

function readItem(bytes) {
  const reader = cursor(bytes);
  const version = header(reader, "RPGTLKIT ITEM", [2, 3]);
  const number = version === 3 ? reader.long : reader.short;
  const name = reader.string();
  const description = reader.string();
  const modes = Object.fromEntries(["equip", "menu", "board", "battle"].map(mode => [mode, Boolean(reader.byte())]));
  const usableBy = reader.byte();
  const characters = Array.from({ length: 51 }, () => reader.string());
  const buyPrice = number();
  const sellPrice = number();
  const keyItem = Boolean(reader.byte());
  const armorSlots = Array.from({ length: 8 }, () => reader.byte());
  const accessory = reader.string();
  const modifiers = { hp: number(), defense: number(), fight: number(), specialPower: number() };
  const equip = fields(reader, ["Equip program", "Remove program"]);
  const menu = { hp: number(), specialPower: number(), ...fields(reader, ["Menu-use program"]) };
  const battle = { hp: number(), specialPower: number(), ...fields(reader, ["Battle-use program", "Item animation"]) };
  const board = fields(reader, ["On-board program", "Pickup program"]);
  const sizeType = reader.byte();
  const refs = [...equip.refs, ...menu.refs, ...battle.refs, ...board.refs];
  const walking = Array.from({ length: 16 }, (_, index) => {
    const frame = fields(reader, [`Walking frame ${index + 1} top`, `Walking frame ${index + 1} bottom`]);
    refs.push(...frame.refs);
    return Object.values(frame.values);
  });
  const rest = fields(reader, ["Rest graphic top", "Rest graphic bottom"]);
  refs.push(...rest.refs);
  return { version, name, description, modes, usableBy, characters, buyPrice, sellPrice, keyItem, armorSlots, accessory, modifiers,
    programs: { ...equip.values, ...menu.values, "Battle-use program": battle.values["Battle-use program"], ...board.values },
    animation: battle.values["Item animation"],
    menu: { hp: menu.hp, specialPower: menu.specialPower },
    battle: { hp: battle.hp, specialPower: battle.specialPower },
    sizeType, walking, rest: Object.values(rest.values), refs };
}

// The demo contains one headerless text artifact with this repeated record shape.
// Its producer and the meanings of its header integers are unverified.
function readTemporaryBoardText(bytes) {
  const lines = decodeProgram(bytes).split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  const integer = line => /^[+-]?\d+$/.test(line.trim()) && Number.isSafeInteger(Number(line));
  if (lines.length < 9 || (lines.length - 5) % 4 !== 0 || !lines.slice(0, 5).every(integer)) {
    throw new Error("Temporary text does not match the demo record shape.");
  }
  const records = [];
  const refs = [];
  for (let i = 5; i < lines.length; i += 4) {
    const value = lines[i].trim();
    const numbers = lines.slice(i + 1, i + 4);
    if ((value && !/\.tst\d+$/i.test(value)) || !numbers.every(integer)) throw new Error("Invalid temporary text record.");
    records.push({ tileName: value, values: numbers.map(Number) });
    if (value) refs.push(reference(value, "Observed temporary text tile name", i + 1));
  }
  return { layout: "Observed text records; producer and field meanings unverified", header: lines.slice(0, 5).map(Number), records, refs };
}

const readers = {
  gam: readMainFile, prg: readProgram, tst: readTileset, tan: readAnimation, tem: readCharacter, brd: readBoard,
  bkg: readBackground, ene: readEnemy, spc: readSpecialMove, ste: readStatusEffect, anm: readLegacyAnimation,
  fnt: readFont, gph: readStandaloneTile, itm: readItem,
  gif: readGif, jpg: readJpeg, jpeg: readJpeg, wav: readWave, mid: readMidi,
  doc: readCompoundDocument, ___: readTemporaryBoardText,
};

export async function readArtifacts(zip, catalog) {
  const files = Object.values(zip.files).filter(entry => !entry.dir);
  const artifacts = new Map();
  const folders = new Set(Object.values(zip.files).filter(entry => entry.dir).map(entry => entry.name));
  for (const file of files) {
    const path = file.name;
    const type = extension(path);
    const read = readers[type];
    const artifact = { path, type, decodeStatus: read ? "decoded" :
      /^(gif|jpe?g|png|bmp|wav|mid)$/.test(type) ? "media" : type === "doc" ? "document" : "unidentified" };
    if (read) {
      try {
        const bytes = await file.async("uint8array");
        artifact.byteLength = bytes.length;
        Object.assign(artifact, read(bytes, catalog));
      } catch (error) {
        artifact.error = error.message;
        artifact.decodeStatus = "error";
      }
    }
    artifacts.set(path, artifact);
    for (let folder = directory(path); folder; folder = directory(folder.slice(0, -1))) folders.add(folder);
    if (!directory(path)) folders.add("");
  }
  return { artifacts, folders: [...folders].sort() };
}

export function buildReferences(artifacts, mainFiles = []) {
  const names = new Map();
  for (const { path } of artifacts.values()) {
    const name = basename(path).toLowerCase();
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(path);
  }
  const incoming = new Map();
  const outgoing = new Map();
  function add(from, ref) {
    const normalized = ref.value.replaceAll("\\", "/").toLowerCase();
    const indexed = normalized.match(/^(.*\.tst)(\d+)$/);
    const name = indexed ? indexed[1] : normalized;
    const tile = indexed ? Number(indexed[2]) : undefined;
    const candidates = (names.get(basename(name)) ?? [])
      .filter(path => !name.includes("/") || path.toLowerCase() === name || path.toLowerCase().endsWith(`/${name}`));
    const status = ref.status ?? (/^(?:[a-z]:[\\/]|\\\\|https?:\/\/)/i.test(ref.value) ? "External" : undefined);
    const to = ref.path ?? (!status && candidates.length === 1 ? candidates[0] : undefined);
    const target = artifacts.get(to);
    const invalidTile = tile !== undefined && target && (target.count === undefined || tile < 1 || tile > target.count);
    const edge = { ...ref, from, to: invalidTile ? undefined : to, tile,
      status: invalidTile ? (target.count === undefined ? "Tileset unavailable" : "Tile index out of range") :
        to ? "Resolved" : status ?? (candidates.length > 1 ? "Ambiguous" : "Missing") };
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(edge);
    if (!edge.to) return;
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  for (const artifact of artifacts.values()) {
    for (const ref of artifact.refs ?? []) add(artifact.path, ref);
  }
  for (const mainFile of [mainFiles].flat().filter(Boolean)) {
    for (const [evidence, binding] of mainFile.bindings) {
      add(mainFile.name, { value: binding.value, evidence, path: binding.path, status: binding.status,
        external: mainFile.external ?? true });
    }
  }
  return { incoming, outgoing };
}
