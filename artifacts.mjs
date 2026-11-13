import { detectSourceFormat, toolkitAsset } from "./asset-format.mjs";
import { dosPalette, tilesetRgb } from "./tile-palette.mjs";
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
    remaining: () => bytes.length - offset,
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
  if (version !== 20 || ![1, 2, 3, 4, 5, 6].includes(detail)) {
    throw new Error("This viewer supports version 20, detail 1–6 tilesets.");
  }
  const width = detail % 2 ? 32 : 16;
  if (count < 0 || bytes.length !== 6 + count * width * width * (detail <= 2 ? 3 : 1)) {
    throw new Error("The tileset size does not match its header.");
  }
  return { count, width, height: width, bytes };
}

export function tilePixels(tileset, number) {
  if (!Number.isInteger(number) || number < 1 || number > tileset.count) return null;
  const size = 32; // Preview cells use the same grid size for both tile details.
  const { width, height } = tileset;
  const bytes = tilesetRgb(tileset, number);
  const scale = size / width;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / scale);
    for (let x = 0; x < size; x++) {
      const source = (Math.floor(x / scale) * height + row) * 3;
      const offset = (y * size + x) * 4;
      const r = bytes[source];
      const g = bytes[source + 1];
      const b = bytes[source + 2];
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

function compactTileTypes(runs) {
  const result = [];
  for (const run of runs.sort((a, b) => a.offset - b.offset)) {
    const last = result.at(-1);
    if (last && last.value === run.value && last.offset + last.length === run.offset) last.length += run.length;
    else result.push({ ...run });
  }
  return result;
}

function boardCondition(number, string) {
  return { mode: number(), initialVariable: string(), finalVariable: string(), initialValue: string(), finalValue: string(), type: number() };
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
  const tileTypes = [];
  const placements = new Map();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let layer = 0; layer < layers; layer++) {
        const value = reader.string();
        const shade = [integer(), integer(), integer()];
        const valueType = integer();
        tileTypes.push({ offset: (layer * height + y) * width + x, length: 1, value: valueType });
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

  const programs = [];
  const items = [];
  for (let i = 0; i < 51; i++) {
    const program = reader.string();
    const position = readPosition();
    const graphic = reader.string();
    const condition = boardCondition(integer, reader.string);
    programs.push({ slot: i, program, position, graphic, condition });
    add(program, `Board program ${boardPositionLabel(position)}`, position);
    add(graphic, `Program graphic ${boardPositionLabel(position)}`, position);
  }
  const itemPositions = [];
  for (let i = 0; i < 11; i++) {
    const item = reader.string();
    const position = readPosition();
    itemPositions.push(position);
    const condition = boardCondition(integer, reader.string);
    items.push({ slot: i, item, position, condition });
    add(item, `Board item ${boardPositionLabel(position)}`, position);
  }
  const start = readPosition();
  for (const [i, position] of itemPositions.entries()) {
    items[i].activationProgram = reader.string();
    add(items[i].activationProgram, `Item activation program ${boardPositionLabel(position)}`, position);
  }
  const saveDisabled = integer();
  for (const [i, position] of itemPositions.entries()) {
    items[i].multitaskProgram = reader.string();
    add(items[i].multitaskProgram, `Item multitask program ${boardPositionLabel(position)}`, position);
  }
  return { width, height, layers, layerTitles, lookup, runs, tileTypes: compactTileTypes(tileTypes), programs, items, start, saveDisabled, background, ambient, refs };
}

function readVectorBoard(reader, bytes) {
  // Native Toolkit 3 binary 2.4: unlike pre-vector BRD 2.2/2.3 there are
  // no registration fields, start coordinates or per-tile shade/type bytes.
  const width = reader.short();
  const height = reader.short();
  const layers = reader.short();
  const coordinateType = reader.short();
  const cells = width * height * layers;
  const area = width * height;
  if (width < 1 || height < 1 || layers < 1 || cells > 2_000_000) {
    throw new Error("Unsupported vector board dimensions.");
  }
  const lookupCount = reader.short() + 1;
  if (lookupCount < 1 || lookupCount > reader.remaining()) {
    throw new Error("Invalid vector board tile lookup count.");
  }
  const lookup = Array.from({ length: lookupCount }, () => reader.string());
  const placements = new Map();
  const rawRuns = [];
  for (let offset = 0; offset < cells;) {
    const token = reader.short();
    const length = token < 0 ? -token : 1;
    const index = token < 0 ? reader.short() : token;
    if (index < 0 || index >= lookup.length || offset + length > cells) {
      throw new Error("Invalid vector board tile run.");
    }
    rawRuns.push({ offset, length, index });
    if (index && lookup[index]) placements.set(index, (placements.get(index) ?? 0) + length);
    offset += length;
  }

  // Toolkit 3 stores tile shading in independent, counted layer blocks.
  // A source run may exceed the remaining cells (the 2.4 reader exits at
  // the layer boundary); retain its stored count and clamp the preview.
  const shadingCount = reader.short() + 1;
  if (shadingCount < 0 || shadingCount > reader.remaining() / 6) {
    throw new Error("Invalid vector board shading layer count.");
  }
  const shades = Array.from({ length: 3 }, () => new Int16Array(cells));
  const shadingLayers = [];
  for (let i = 0; i < shadingCount; i++) {
    const layer = reader.long();
    const sourceRuns = [];
    for (let offset = 0; offset < area;) {
      const storedLength = reader.short();
      const shade = [reader.short(), reader.short(), reader.short()];
      if (storedLength < 1) throw new Error("Invalid vector board shade run.");
      const length = Math.min(storedLength, area - offset);
      sourceRuns.push({ offset, length, storedLength, shade });
      if (layer >= 1 && layer <= layers) {
        const from = (layer - 1) * area + offset;
        for (let channel = 0; channel < 3; channel++) {
          shades[channel].fill(shade[channel], from, from + length);
        }
      }
      offset += length;
    }
    shadingLayers.push({ layer, runs: sourceRuns });
  }

  // Merge graphic and shade runs without inventing pre-vector tile types.
  const runs = [];
  for (const run of rawRuns) {
    if (!run.index || !lookup[run.index]) continue;
    for (let offset = run.offset; offset < run.offset + run.length;) {
      const shade = shades.map(channel => channel[offset]);
      let end = offset + 1;
      while (end < run.offset + run.length && shades.every((channel, i) => channel[end] === shade[i])) end++;
      runs.push({ offset, length: end - offset, index: run.index, shade });
      offset = end;
    }
  }

  // Light and collision-vector records precede the newer program/sprite
  // sections. Stop here: no unsupported late-tail fields are inferred.
  const lightCount = reader.short() + 1;
  if (lightCount < 0 || lightCount > reader.remaining() / 10) {
    throw new Error("Invalid vector board light count.");
  }
  const lights = [];
  const readPoints = label => {
    const count = reader.short() + 1;
    if (count < 0 || count > reader.remaining() / 8) throw new Error("Invalid " + label + " point count.");
    return Array.from({ length: count }, () => ({ x: reader.long(), y: reader.long() }));
  };
  for (let i = 0; i < lightCount; i++) {
    const layer = reader.long();
    const type = reader.long();
    const points = readPoints("board light");
    const colorsCount = reader.short() + 1;
    if (colorsCount < 0 || colorsCount > reader.remaining() / 6) {
      throw new Error("Invalid vector board light color count.");
    }
    const colors = Array.from({ length: colorsCount }, () =>
      [reader.short(), reader.short(), reader.short()]);
    lights.push({ layer, type, points, colors });
  }
  const vectorCount = reader.short() + 1;
  if (vectorCount < 0 || vectorCount > reader.remaining() / 10) {
    throw new Error("Invalid vector board vector count.");
  }
  const vectors = Array.from({ length: vectorCount }, (_, slot) => {
    const points = readPoints("board vector");
    const attributes = reader.short();
    const closed = reader.short(); // Preserve raw VB boolean (-1/0).
    const layer = reader.short();
    const tileType = reader.short();
    const handle = reader.string();
    return { slot, points, attributes, closed, layer, tileType, handle };
  });
  return {
    width, height, layers, coordinateType,
    layerTitles: ["", ...Array.from({ length: Math.max(layers, 8) }, (_, i) => "Layer " + (i + 1))].slice(0, 9),
    lookup, runs, tileTypes: [], shadingLayers, lights, vectors,
    background: -1, ambient: [0, 0, 0], // Neutral preview defaults; not stored prefix settings.
    programs: [], items: [], refs: boardTileReferences(lookup, placements),
  };
}

function readBoard(bytes) {
  if (/^RPGTLKIT BOARD[\r\n]/i.test(text.decode(bytes.subarray(0, 16)))) return readTextBoard(bytes);
  const reader = cursor(bytes);
  const minor = header(reader, "RPGTLKIT BOARD", [2, 3, 4]);
  if (minor === 4) return readVectorBoard(reader, bytes);
  reader.skip(2);
  reader.string();
  const width = reader.short();
  const height = reader.short();
  const layers = reader.short();
  const cells = width * height * layers;
  if (width < 1 || height < 1 || layers < 1 || cells > 2_000_000) throw new Error("Unsupported board dimensions.");
  const start = { x: reader.short(), y: reader.short(), layer: reader.short() };
  const saveDisabled = reader.short();
  const count = reader.short() + 1;
  if (count < 1 || count > bytes.length) throw new Error("Invalid board tile lookup count.");
  const lookup = Array.from({ length: count }, () => reader.string());
  const runs = [];
  const tileTypes = [];
  const placements = new Map();
  for (let offset = 0; offset < cells;) {
    const token = reader.short();
    const length = token < 0 ? -token : 1;
    const index = token < 0 ? reader.short() : token;
    const shade = [reader.short(), reader.short(), reader.short()];
    const valueType = reader.byte();
    tileTypes.push({ offset, length, value: valueType });
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
  const programs = [];
  const items = [];
  for (let i = 0; i < programCount; i++) {
    const program = reader.string();
    const position = readPosition();
    const graphic = reader.string();
    const condition = boardCondition(reader.short, reader.string);
    programs.push({ slot: i, program, position, graphic, condition });
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
    const condition = boardCondition(reader.short, reader.string);
    const activationProgram = reader.string();
    const multitaskProgram = reader.string();
    items.push({ slot: i, item, position, condition, activationProgram, multitaskProgram });
    add(item, `Board item ${boardPositionLabel(position)}`, position);
    add(activationProgram, `Item activation program ${boardPositionLabel(position)}`, position);
    add(multitaskProgram, `Item multitask program ${boardPositionLabel(position)}`, position);
  }
  const board = { width, height, layers, layerTitles, lookup, runs, tileTypes: compactTileTypes(tileTypes), programs, items, start, saveDisabled, background, ambient, refs };
  if (minor === 3) {
    const threadCount = reader.long() + 1;
    if (threadCount < 0 || threadCount >= reader.remaining()) throw new Error("Invalid board thread count.");
    board.threads = Array.from({ length: threadCount }, (_, index) => {
      const program = reader.string();
      add(program, `Board thread · slot ${index}`);
      return program;
    });
    board.coordinateType = reader.byte();
  }
  return board;
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

const characterStats = ["XP", "HP", "Max HP", "Defense", "Fight", "Special power", "Max special power", "Level"];

function readCharacterWalking(readPart) {
  const walking = [];
  for (const direction of ["South", "East", "North", "West"]) {
    for (let frame = 1; frame <= 4; frame++) {
      const parts = ["top", "bottom"].map(part => reference(readPart(), `Walk ${direction.toLowerCase()} · frame ${frame} · ${part}`));
      walking.push({ direction, frame, parts });
    }
  }
  return walking;
}

const characterActions = ["Attack", "Defense", "Special move", "Defeat"];

function characterArtwork(embedded, minor, binary, read) {
  const width = embedded ? 32 : (!binary && minor === 1 ? 32 : 64);
  const height = embedded ? 32 : 64;
  const artwork = characterActions.flatMap(kind => Array.from({ length: 4 }, (_, i) =>
    ({ kind, frame: i + 1, width, height, ...(embedded ? { pixels: [] } : { parts: [] }) })));
  const frame = (kind, i) => artwork.find(f => f.kind === kind && f.frame === i + 1);
  const part = (f, x, y) => f.parts.push({ x, y, ...reference(read(), `${f.kind} · frame ${f.frame} · tile (${x}, ${y})`) });
  if (embedded) {
    // Text embedded order: frame, x, y, fight/special/defense/death.
    for (let i = 0; i < 4; i++) for (let pixel = 0; pixel < 1024; pixel++) {
      for (const kind of ["Attack", "Special move", "Defense", "Defeat"]) frame(kind, i).pixels.push(read());
    }
  } else if (binary) {
    for (let i = 0; i < 4; i++) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
      for (const kind of characterActions) part(frame(kind, i), x, y);
    }
  } else {
    for (let x = 0; x < width / 32; x++) for (let y = 0; y < 2; y++) for (let i = 0; i < 4; i++) {
      for (const kind of characterActions) part(frame(kind, i), x, y);
    }
  }
  const rest = { kind: "Rest", frame: 1, width, height, ...(embedded ? { pixels: Array.from({ length: 1024 }, read) } : { parts: [] }) };
  if (!embedded) for (let x = 0; x < width / 32; x++) for (let y = 0; y < 2; y++) part(rest, x, y);
  artwork.push(rest);
  for (let i = 0; i < 10; i++) {
    const custom = { kind: "Custom", frame: i + 1, width: 32, height: embedded ? 32 : 64,
      ...(embedded ? { pixels: Array.from({ length: 1024 }, read) } : { parts: [] }) };
    if (!embedded) for (let y = 0; y < 2; y++) part(custom, 0, y);
    artwork.push(custom);
  }
  return artwork;
}

function readTextCharacter(bytes) {
  const reader = textReader(bytes, "RPGTLKIT CHAR", [0, 1, 2]);
  const integer = () => {
    const value = reader.number();
    if (!Number.isSafeInteger(value)) throw new Error("Invalid text character integer.");
    return value;
  };
  const skip = count => {
    for (let i = 0; i < count; i++) reader.string();
  };
  const name = reader.string();
  skip(9); // RPGCode variable names.
  const stats = Object.fromEntries(characterStats.map(label => [label, integer()]));
  const profile = reference(reader.string(), "Character portrait");
  const refs = [profile];
  for (let i = 0; i < 201; i++) {
    refs.push(reference(reader.string(), `Special move slot ${i}`));
    skip(4);
  }
  skip(2); // Special move name and enable flag.
  const sizeType = reader.minor === 0 ? 0 : integer();
  if (![0, 1].includes(sizeType)) throw new Error("Unsupported text character graphic size.");

  const color = () => {
    const value = integer();
    if (value < -1 || value > 0xffffff) throw new Error("Invalid embedded character tile color.");
    return value;
  };
  let embeddedWalking;
  let artwork;
  if (sizeType === 0) {
    embeddedWalking = Array.from({ length: 16 }, () => Array.from({ length: 1024 }, color));
    artwork = characterArtwork(true, reader.minor, false, color);
  }
  const walking = readCharacterWalking(embeddedWalking ? () => "" : reader.string);
  refs.push(...walking.flatMap(frame => frame.parts));
  if (sizeType === 1) artwork = characterArtwork(false, reader.minor, false, reader.string);
  refs.push(...artwork.flatMap(frame => frame.parts ?? []));
  skip(10 + 6 + 7); // Accessories, armor flags, and level progression.
  for (const label of ["Attack", "Defense", "Special move", "Defeat"]) refs.push(reference(reader.string(), `${label} sound`));
  refs.push(reference(reader.string(), "Level-up program"));
  skip(1); // Level-up type.
  return { name, stats, profile, walking, ...(embeddedWalking ? { embeddedWalking } : {}), artwork, refs: refs.filter(ref => ref.value) };
}

function readCharacter(bytes) {
  if (/^RPGTLKIT CHAR[\r\n]/i.test(text.decode(bytes.subarray(0, 15)))) return readTextCharacter(bytes);
  const reader = cursor(bytes);
  const minor = header(reader, "RPGTLKIT CHAR", [3, 4]);
  const name = reader.string();
  for (let i = 0; i < 9; i++) reader.string();
  const stats = Object.fromEntries(
    characterStats.map(label => [label, reader.long()]),
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
  const walking = readCharacterWalking(reader.string);
  const artwork = characterArtwork(false, minor, true, reader.string);
  refs.push(...walking.flatMap(frame => frame.parts), ...artwork.flatMap(frame => frame.parts));
  return { name, stats, profile, walking, artwork, refs: refs.filter(ref => ref.value) };
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
  const isText = /^RPGTLKIT STATUSE[\r\n]/i.test(text.decode(bytes.subarray(0, 17)));
  const reader = isText ? textReader(bytes, "RPGTLKIT STATUSE") : cursor(bytes);
  const version = isText ? reader.minor : header(reader, "RPGTLKIT STATUSE", [2]);
  const number = isText ? () => {
    const value = reader.number();
    if (!Number.isSafeInteger(value)) throw new Error("Invalid status effect integer.");
    return value;
  } : reader.short;
  const name = reader.string();
  const rounds = number();
  const speed = Boolean(number());
  const slow = Boolean(number());
  const disable = Boolean(number());
  const removeHp = Boolean(number());
  const hpAmount = number();
  const removeSmp = Boolean(number());
  const smpAmount = number();
  const runProgram = Boolean(number());
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
  if (![1, 2, 3, 4, 5, 6].includes(detail) || ![0, 1].includes(compressed)) throw new Error("Unsupported standalone tile encoding.");
  const size = detail % 2 ? 32 : 16;
  const pixels = [];
  while (pixels.length < size * size) {
    const count = compressed ? reader.number() : 1;
    const color = reader.number();
    if (!Number.isInteger(color) || color < -1 || color > (detail <= 2 ? 0xffffff : 255)) throw new Error("Invalid standalone tile color.");
    if (!Number.isInteger(count) || count < 1 || pixels.length + count > size * size) throw new Error("Invalid standalone tile run.");
    for (let i = 0; i < count; i++) pixels.push(detail > 2 && color !== -1 ? dosPalette[color] : color);
  }
  return { width: size, height: size, detail, compressed: Boolean(compressed), order: "column-major", encoding: "Toolkit COLORREF; -1 is transparent", pixels };
}

function readTextItem(bytes) {
  const reader = textReader(bytes, "RPGTLKIT ITEM", [0, 1]);
  const integer = () => {
    const value = reader.number();
    if (!Number.isSafeInteger(value)) throw new Error("Invalid text item integer.");
    return value;
  };
  const name = reader.string();
  const modes = Object.fromEntries(["equip", "menu", "board", "battle"].map(mode => [mode, Boolean(integer())]));
  const armorSlots = [0, ...Array.from({ length: 7 }, integer)];
  const accessory = reader.string();
  const modifiers = { hp: integer(), defense: integer(), fight: integer(), specialPower: integer() };
  const equip = fields(reader, ["Equip program", "Remove program"]);
  const menu = { hp: integer(), specialPower: integer() };
  const menuProgram = fields(reader, ["Menu-use program"]);
  const battle = { hp: integer(), specialPower: integer() };
  const battleProgram = fields(reader, ["Battle-use program"]);
  const board = fields(reader, ["On-board program", "Pickup program"]);
  const sizeType = reader.minor === 0 ? 0 : integer();
  if (![0, 1].includes(sizeType)) throw new Error("Unsupported text item graphic size.");

  const refs = [...equip.refs, ...menuProgram.refs, ...battleProgram.refs, ...board.refs];
  const readPair = label => {
    const pair = fields(reader, [`${label} top`, `${label} bottom`]);
    refs.push(...pair.refs);
    return Object.values(pair.values);
  };
  const readTile = () => {
    const first = integer();
    if (first === -2) return null;
    const pixels = [first, ...Array.from({ length: 1023 }, integer)];
    if (pixels.some(color => color < -1 || color > 0xffffff)) throw new Error("Invalid embedded item tile color.");
    return pixels;
  };
  const walking = Array.from({ length: 16 }, (_, i) => sizeType ? readPair(`Walking frame ${i + 1}`) : ["", ""]);
  const rest = sizeType ? readPair("Rest graphic") : ["", ""];
  const embeddedGraphics = sizeType === 0 ? { walking: Array.from({ length: 16 }, readTile), rest: readTile() } : undefined;
  const usableBy = integer();
  const characters = ["", ...Array.from({ length: 50 }, () => reader.string())];
  const buyPrice = integer();
  const sellPrice = integer();
  const keyItem = Boolean(integer());
  const description = reader.string();
  const animation = fields(reader, ["Item animation"]);
  refs.push(...animation.refs);
  return {
    version: reader.minor, name, description, modes, usableBy, characters, buyPrice, sellPrice, keyItem,
    armorSlots, accessory, modifiers, programs: { ...equip.values, ...menuProgram.values, ...battleProgram.values, ...board.values },
    animation: animation.values["Item animation"], menu, battle, sizeType, walking, rest,
    ...(embeddedGraphics ? { embeddedGraphics } : {}), refs,
  };
}

function readItem(bytes) {
  if (/^RPGTLKIT ITEM[\r\n]/i.test(text.decode(bytes.subarray(0, 15)))) return readTextItem(bytes);
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
    if (read || toolkitAsset(type)) {
      artifact.sourceFormat = detectSourceFormat(type, new Uint8Array());
      try {
        const bytes = await file.async("uint8array");
        artifact.byteLength = bytes.length;
        artifact.sourceFormat = detectSourceFormat(type, bytes);
        if (read) Object.assign(artifact, read(bytes, catalog));
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
