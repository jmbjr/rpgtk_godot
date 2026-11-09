import { decodeProgram, indexProgram } from "./model.mjs";

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
  if (reader.string() !== signature || reader.short() !== 2 || !minors.includes(reader.short())) {
    throw new Error("This legacy file format is outside the supported demo layouts.");
  }
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

function readBoard(bytes) {
  const reader = cursor(bytes);
  header(reader, "RPGTLKIT BOARD", [2, 3]);
  reader.skip(2);
  reader.string();
  const width = reader.short();
  const height = reader.short();
  const layers = reader.short();
  reader.skip(8);
  const count = reader.short() + 1;
  if (count < 1 || count > bytes.length) throw new Error("Invalid board tile lookup count.");
  const refs = Array.from({ length: count }, (_, index) => reference(reader.string(), `Board tile lookup · entry ${index}`));
  return { width, height, layers, refs: refs.filter(ref => ref.value) };
}

function readCharacter(bytes) {
  const reader = cursor(bytes);
  header(reader, "RPGTLKIT CHAR", [3]);
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
  reader.skip(22);
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
function readProgram(bytes, catalog) {
  const program = indexProgram(decodeProgram(bytes), catalog);
  const refs = [];
  for (const row of program.rows) {
    for (const [index, token] of row.tokens.entries()) {
      if (token.kind !== "builtin" || !FILE_COMMANDS.has(token.name)) continue;
      const args = row.line.slice(token.start + token.value.length, row.tokens[index + 1]?.start);
      for (const match of args.matchAll(/"([^"]+)"/g)) {
        if (/\.[a-z][a-z0-9]{1,5}$/i.test(match[1])) refs.push(reference(match[1], token.value, token.line));
      }
    }
  }
  return { program, refs };
}

const readers = { prg: readProgram, tst: readTileset, tan: readAnimation, tem: readCharacter, brd: readBoard };

export async function readArtifacts(zip, catalog) {
  const files = Object.values(zip.files).filter(entry => !entry.dir);
  const artifacts = new Map();
  const folders = new Set(Object.values(zip.files).filter(entry => entry.dir).map(entry => entry.name));
  for (const file of files) {
    const path = file.name;
    const type = extension(path);
    const read = readers[type];
    const artifact = { path, type };
    if (read) {
      try {
        Object.assign(artifact, read(await file.async("uint8array"), catalog));
      } catch (error) {
        artifact.error = error.message;
      }
    }
    artifacts.set(path, artifact);
    for (let folder = directory(path); folder; folder = directory(folder.slice(0, -1))) folders.add(folder);
    if (!directory(path)) folders.add("");
  }
  return { artifacts, folders: [...folders].sort() };
}

export function buildReferences(artifacts, mainFile) {
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
    const to = ref.path ?? (candidates.length === 1 ? candidates[0] : undefined);
    const target = artifacts.get(to);
    const invalidTile = tile !== undefined && target?.count !== undefined && (tile < 1 || tile > target.count);
    const edge = { ...ref, from, to: invalidTile ? undefined : to, tile,
      status: invalidTile ? "Tile index out of range" : to ? "Resolved" : candidates.length > 1 ? "Ambiguous" : "Missing" };
    if (!outgoing.has(from)) outgoing.set(from, []);
    outgoing.get(from).push(edge);
    if (!edge.to) return;
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  for (const artifact of artifacts.values()) {
    for (const ref of artifact.refs ?? []) add(artifact.path, ref);
  }
  if (mainFile) {
    for (const [evidence, binding] of mainFile.bindings) {
      if (binding.path) add(mainFile.name, { value: binding.path, evidence, path: binding.path, external: true });
    }
  }
  return { incoming, outgoing };
}
