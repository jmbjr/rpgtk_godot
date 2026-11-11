import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { buildReferences, readArtifacts, tilePixels } from "../artifacts.mjs";
import { openGameArchive } from "../archive.mjs";
import { mainFileBindings } from "../model.mjs";

const manifest = JSON.parse(await readFile(new URL("../experiments/tk2-test-game/manifest.json", import.meta.url)));
const { name, title, files, room } = manifest;
const project = `Game/${name}`;
const filename = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, basename(path)]));
const z = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => {
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((value, i) => bytes.writeInt16LE(value, i * 2));
  return bytes;
};
const i32 = (...values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => bytes.writeInt32LE(value, i * 4));
  return bytes;
};
const join = (...parts) => Buffer.concat(parts.map(part => typeof part === "string" ? z(part) : part));
const header = (type, minor) => join(`RPGTLKIT ${type}`, i16(2, minor));
const empty = count => Buffer.alloc(count);

function mainFile() {
  // Full binary 2.2 layout, including the legacy settings after the startup bindings.
  return join(header("MAIN", 2), i16(0), "NOCODE",
    `Game\\${name}\\`, title, i16(1, 1, 0, 2, 0), "0english.lng",
    filename.startup, filename.board, filename.player,
    "None", i16(0, 13, 0),
    i16(50), empty(51 * 3), // Runtime key and program slots.
    i16(0), i32(40), i16(0, 0), // Legacy menu, multitask, protection and battles.
    i16(500), empty(501 * 3), // Enemy name and skill slots.
    i16(0), i32(25), i16(0), "", i16(0), "None", "buttonskin.jpg", "menuskin.jpg",
    i16(4), i16(0, 0, 0, 0, 0), // Legacy plugin flags.
    i16(0, 1), i32(1)); // Day/night disabled.
}

const tileName = tile => `${filename.tiles}${tile}`;

function boardFile() {
  const cells = [];
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const edge = x === 0 || y === 0 || x === room.width - 1 || y === room.height - 1;
      let tile = edge ? 2 : 1;
      if ((x === 0 || x === room.width - 1) && (y === 0 || y === room.height - 1)) {
        tile = 3 + (x ? 1 : 0) + (y ? 2 : 0);
      }
      if (x === 9 && y === 5) tile = 2;
      cells.push(join(i16(tile, 0, 0, 0), Buffer.of(edge || tile === 2 ? 1 : 0)));
    }
  }
  // One RLE run fills the seven unused layers.
  cells.push(join(i16(-room.width * room.height * (room.layers - 1), 0, 0, 0, 0), Buffer.of(0)));
  return join(header("BOARD", 2), i16(0), "NOCODE",
    i16(room.width, room.height, room.layers, room.start.x, room.start.y, room.start.layer, 0),
    i16(6), "", ...Array.from({ length: 6 }, (_, i) => tileName(i + 1)), ...cells,
    "", "", "", i32(0, 0), i16(0), "", "", "", "", i16(0), "",
    i16(0, 0, 0, 0), "", i16(...Array(11).fill(0)), "", "", "Test room", empty(7),
    i16(0), "", i16(0, 0, 0), "", i16(0), "", "", "", "", i16(0), // Empty program slot.
    "", "", i16(0), "", i16(0, 0, 0, 0), "", "", "", "", i16(0), "", "", // Empty item slot.
    Buffer.of(0)); // Binary 2.2 orthogonal coordinate flag, followed by zero thread names.
}

function characterFile() {
  const variables = ["experience", "defence", "fight", "health", "maxhealth", "name", "smpower", "maxsm", "level"];
  return join(header("CHAR", 3), "Lab Player",
    ...variables.map(key => `LabPlayer[${key}]${key === "name" ? "$" : "!"}`),
    i32(0, 20, 20, 2, 3, 0, 0, 1), "",
    empty(201 * 11), "", Buffer.of(0), empty(11), Buffer.of(0, 1, 1, 1, 1, 1, 1),
    Buffer.of(100), i16(2), i32(99), i16(5, 5, 5, 5), "", "", "", "", "",
    Buffer.of(0, 1),
    ...Array.from({ length: 16 }, (_, frame) => ["", tileName(7 + frame)]).flat(),
    empty(64 + 4 + 20)); // Unused battle, rest and custom filename slots.
}

function makeTile(pixel) {
  const bytes = Buffer.alloc(32 * 32 * 3);
  for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) {
    bytes.set(pixel(x, y), (x * 32 + y) * 3);
  }
  return bytes;
}

function tilesetFile() {
  const floor = [49, 73, 81];
  const wall = [37, 50, 62];
  const accents = [[238, 105, 84], [250, 204, 87], [84, 205, 171], [130, 150, 244]];
  const tiles = [
    makeTile((x, y) => x === 0 || y === 0 ? [64, 93, 102] : floor),
    makeTile((x, y) => y < 4 || x === 0 ? [95, 120, 138] : wall),
    ...accents.map(color => makeTile((x, y) => x >= 5 && x < 22 && y >= 6 && y < 19 ? color : wall)),
  ];
  for (const color of accents) {
    for (let frame = 0; frame < 4; frame++) {
      tiles.push(makeTile((x, y) => {
        if (x >= 10 && x <= 21 && y >= 7 && y <= 16) return [250, 225, 178];
        if (x >= 9 && x <= 22 && y >= 17 && y <= 24) return color;
        if (y >= 25 && y <= 27 && (x === 10 + frame || x === 21 - frame)) return color;
        return [0, 1, 2];
      }));
    }
  }
  return join(i16(20, tiles.length, 1), ...tiles);
}

const instructions = [
  "Toolkit 2 Test Lab",
  "",
  "Extract this ZIP directly into your RPG Toolkit 2 installation folder.",
  `Open Main\\${filename.main} from the editor's Open Main File command.`,
  "Run the project. Press a key at the startup message and walk around the room.",
  "Check the four colored corners and the solid block in the middle.",
  "",
  "The viewer checks the archive, file layouts and references during the build.",
  "Please record your Toolkit release and whether the project opens and runs.",
].join("\r\n") + "\r\n";

const zip = new JSZip();
const date = new Date("2000-01-01T00:00:00Z");
const options = { date, createFolders: false };
for (const folder of ["Main", "Game", project, ...["Bitmap", "Bkrounds", "Boards", "Chrs", "Enemy",
  "Font", "Item", "Media", "Misc", "Prg", "SpcMove", "StatusE", "Tiles"].map(dir => `${project}/${dir}`)]) {
  zip.file(`${folder}/`, "", { ...options, dir: true });
}
zip.file(files.main, mainFile(), options);
zip.file(files.startup, '#MWin("Toolkit 2 Test Lab. Press a key to walk around.")\r\n#Wait(key$)\r\n#MWinCls()\r\n#End\r\n', options);
zip.file(files.board, boardFile(), options);
zip.file(files.tiles, tilesetFile(), options);
zip.file(files.player, characterFile(), options);
zip.file("Readme-TK2TestLab.txt", instructions, options);
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

// Verify the exact ZIP with the same import path the site uses.
const opened = await openGameArchive(bytes, input => JSZip.loadAsync(input));
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url)));
const { artifacts } = await readArtifacts(opened, catalog);
assert.deepEqual([...artifacts.keys()].sort(), [...Object.values(files), "Readme-TK2TestLab.txt"].sort());
for (const path of Object.values(files)) assert.equal(artifacts.get(path).decodeStatus, "decoded", path);
const main = artifacts.get(files.main);
assert.equal(main.projectPath, `Game\\${name}\\`);
const bindings = mainFileBindings(main, [...artifacts.keys()]);
assert.deepEqual(bindings.map(([, binding]) => [binding.status, binding.path]),
  ["startup", "board", "player"].map(key => ["resolved", files[key]]));
const graph = buildReferences(artifacts, { name: files.main, bindings });
for (const path of [files.board, files.player]) {
  const edges = graph.outgoing.get(path);
  assert.equal(edges.length, path === files.board ? 6 : 16);
  assert.ok(edges.every(edge => edge.to === files.tiles && Number.isInteger(edge.tile)));
}
const board = artifacts.get(files.board);
assert.deepEqual(board.start, room.start);
assert.deepEqual([board.width, board.height, board.layers], [room.width, room.height, room.layers]);
const blockedOffset = 5 * room.width + 9;
assert.ok(board.tileTypes.some(run => run.value === 1 && run.offset <= blockedOffset && blockedOffset < run.offset + run.length));
const tiles = artifacts.get(files.tiles);
assert.equal(tiles.count, 22);
assert.equal(tilePixels(tiles, 7)[3], 0);
assert.ok(artifacts.get(files.player).walking.length === 16);

const output = process.argv[2] ?? "dist/tk2-test-game.zip";
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(`Verified ${output}: project paths, startup bindings, solid cell, transparency, and 16 walking tile references.`);
