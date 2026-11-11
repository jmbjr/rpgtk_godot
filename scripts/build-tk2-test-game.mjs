import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { fixtures as formatFixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import { buildReferences, readArtifacts, tilePixels } from "../artifacts.mjs";
import { openGameArchive } from "../archive.mjs";
import { mainFileBindings } from "../model.mjs";

const legacy = process.argv.includes("--legacy");
const manifestLocation = legacy ? "../experiments/tk2-legacy-game/manifest.json" : "../experiments/tk2-test-game/manifest.json";
const manifest = JSON.parse(await readFile(new URL(manifestLocation, import.meta.url)));
const specimens = manifest.specimens ?? [];
const tilesetSpecimens = manifest.tilesets ?? [];
const legacyBoards = manifest.legacyBoards ?? [];
const legacyBoardAssets = manifest.legacyBoardAssets ?? [];
const fixtureByPath = new Map(formatFixtures.map(fixture => [fixture.path, fixture.bytes]));
const sourceBytes = async specimen => {
  assert.ok(Boolean(specimen.fixture) !== Boolean(specimen.source), "Specify exactly one fixture or source");
  if (specimen.fixture) {
    const bytes = fixtureByPath.get(specimen.fixture);
    assert.ok(bytes, `Missing conformance fixture: ${specimen.fixture}`);
    return bytes;
  }
  assert.ok(specimen.source.startsWith("docs/specs/fixtures/"), specimen.source);
  return readFile(new URL(`../${specimen.source}`, import.meta.url));
};
// Toolkit 2's text writers use CRLF. Conformance fixtures are LF, so normalize
// the container's wire form without changing the checked-in source specimens.
const gphWireText = bytes => bytes.toString("latin1").replace(/\r\n|\r|\n/g, "\r\n");
const { name, title, files, room } = manifest;
const project = `Game/${name}`;
const readmePath = `Readme-${name}.txt`;
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
  // Binary 2.2 layout. Use the desktop resolution and leave full screen off.
  return join(header("MAIN", 2), i16(0), "NOCODE",
    `Game\\${name}\\`, title, i16(0, 0, 0, 2, 0), "0english.lng",
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

function boardFile(tileset = null) {
  const cells = [];
  const gallery = Boolean(tileset);
  const tilesetName = tileset ? basename(tileset.path) : filename.tiles;
  const lookupCount = tileset ? tileset.count : 6;
  const boardTileName = tile => `${tilesetName}${tile}`;
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const edge = x === 0 || y === 0 || x === room.width - 1 || y === room.height - 1;
      let tile = edge ? 2 : 1;
      if (!gallery && (x === 0 || x === room.width - 1) && (y === 0 || y === room.height - 1)) {
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
    i16(lookupCount), "", ...Array.from({ length: lookupCount }, (_, i) => boardTileName(i + 1)), ...cells,
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
  title,
  "",
  "Extract this ZIP directly into your RPG Toolkit 2 installation folder.",
  `Open Main\\${filename.main} from the editor's Open Main File command.`,
  "Run the project. Press a key at the startup message and walk around the room.",
  "Check the four colored corners and the solid block in the middle.",
  "",
  "The viewer checks the archive, file layouts and references during the build.",
  "Please record your Toolkit release and whether the project opens and runs.",
  ...specimens.map(specimen => `Tile editor check (standalone): ${specimen.path}`),
  ...tilesetSpecimens.map(set => `Tileset mode ${set.detail}: ${set.path} | Board editor: ${set.board}`),
  ...legacyBoards.map(board => `Older board ${board.format} ${board.revision}: ${board.path} | Open in board editor; save a copy`),
].join("\r\n") + "\r\n";

const zip = new JSZip();
const date = new Date("2000-01-01T00:00:00Z");
const options = { date, createFolders: false };
for (const folder of ["Main", "Game", project, ...["Bitmap", "Bkrounds", "Boards", "Chrs", "Enemy",
  "Font", "Item", "Media", "Misc", "Prg", "SpcMove", "StatusE", "Tiles"].map(dir => `${project}/${dir}`)]) {
  zip.file(`${folder}/`, "", { ...options, dir: true });
}
zip.file(files.main, mainFile(), options);
zip.file(files.startup, `#MWin("${title}. Press a key to walk around.")\r\n#Wait(key$)\r\n#MWinCls()\r\n#End\r\n`, options);
zip.file(files.board, boardFile(), options);
zip.file(files.tiles, tilesetFile(), options);
zip.file(files.player, characterFile(), options);
for (const set of tilesetSpecimens) {
  assert.equal(set.type, "tst");
  assert.ok(set.path.startsWith(`${project}/Tiles/`) && set.path.endsWith(".tst"), set.path);
  assert.ok(set.board.startsWith(`${project}/Boards/`) && set.board.endsWith(".brd"), set.board);
  assert.ok(set.source.startsWith("docs/specs/fixtures/") && set.source.endsWith(".tst"), set.source);
  assert.ok([2, 3, 4, 5, 6].includes(set.detail) && set.format === 20 && set.count === 2);
  const source = await readFile(new URL(`../${set.source}`, import.meta.url));
  zip.file(set.path, source, options); // Preserve exact binary fixture bytes.
  zip.file(set.board, boardFile(set), options); // Separate, unlinked editor-test room.
}
for (const specimen of [...legacyBoardAssets, ...legacyBoards]) {
  assert.ok(specimen.path.startsWith(project + "/"), specimen.path);
  if (legacyBoards.includes(specimen)) assert.ok(specimen.path.startsWith(project + "/Boards/"), specimen.path);
  zip.file(specimen.path, await sourceBytes(specimen), options); // Byte-for-byte controlled specimen.
}
for (const specimen of specimens) {
  assert.equal(specimen.type, "gph");
  assert.ok(specimen.path.startsWith(`${project}/Tiles/`), specimen.path);
  // Preserve the fixture's fields and pixels while using editor-native CRLF.
  const source = await readFile(new URL(`../${specimen.source}`, import.meta.url));
  zip.file(specimen.path, gphWireText(source), options);
}
zip.file(readmePath, instructions, options);
const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

// Verify the exact ZIP with the same import path the site uses.
const opened = await openGameArchive(bytes, input => JSZip.loadAsync(input));
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url)));
const { artifacts } = await readArtifacts(opened, catalog);
const requiredPaths = [...Object.values(files), ...specimens.map(specimen => specimen.path),
  ...tilesetSpecimens.flatMap(set => [set.path, set.board]),
  ...legacyBoards.map(board => board.path), ...legacyBoardAssets.map(asset => asset.path)];
assert.equal(new Set(requiredPaths).size, requiredPaths.length, "Duplicate manifest paths");
assert.deepEqual([...artifacts.keys()].sort(), [...requiredPaths, readmePath].sort());
for (const path of requiredPaths) assert.equal(artifacts.get(path).decodeStatus, "decoded", path);
for (const specimen of specimens) {
  const tile = artifacts.get(specimen.path);
  assert.equal(tile.detail, specimen.detail, specimen.path);
  assert.equal(tile.compressed, specimen.compressed, specimen.path);
  assert.deepEqual([tile.width, tile.height], [16, 16], specimen.path);
  assert.equal(tile.pixels.length, 256, specimen.path);
  assert.equal(tile.pixels[0], -1, "Fixture transparency marker");
  assert.ok(tile.pixels.slice(1).every(Number.isInteger), specimen.path);
  const source = await readFile(new URL(`../${specimen.source}`, import.meta.url));
  const packaged = await opened.file(specimen.path).async("string");
  assert.equal(packaged, gphWireText(source), "Fixture content must change only in line endings");
}
const main = artifacts.get(files.main);
assert.equal(main.projectPath, `Game\\${name}\\`);
const bindings = mainFileBindings(main, [...artifacts.keys()]);
assert.deepEqual(bindings.map(([, binding]) => [binding.status, binding.path]),
  ["startup", "board", "player"].map(key => ["resolved", files[key]]));
const graph = buildReferences(artifacts, { name: files.main, bindings });
for (const set of tilesetSpecimens) {
  const fixtureBytes = await readFile(new URL(`../${set.source}`, import.meta.url));
  const archivedBytes = Buffer.from(await opened.file(set.path).async("uint8array"));
  assert.deepEqual(archivedBytes, fixtureBytes, `${set.path}: binary fixture bytes must be unchanged`);
  assert.deepEqual([fixtureBytes.readInt16LE(0), fixtureBytes.readInt16LE(2), fixtureBytes.readInt16LE(4)],
    [set.format, set.count, set.detail], `${set.path}: header`);
  const expectedWidth = set.detail % 2 ? 32 : 16;
  assert.equal(fixtureBytes.length, 6 + set.count * expectedWidth ** 2 * (set.detail <= 2 ? 3 : 1));
  const tileset = artifacts.get(set.path);
  assert.equal(tileset.count, set.count);
  assert.deepEqual([tileset.width, tileset.height], [expectedWidth, expectedWidth]);
  const rgba = tilePixels(tileset, 1);
  assert.ok(rgba && Array.from({ length: 32 * 32 }, (_, index) => rgba[index * 4 + 3]).some(alpha => alpha === 0),
    `${set.path}: first tile has transparent pixels`);

  const board = artifacts.get(set.board);
  assert.deepEqual([board.width, board.height, board.layers], [room.width, room.height, room.layers]);
  assert.deepEqual(board.start, room.start);
  const edges = graph.outgoing.get(set.board) ?? [];
  assert.deepEqual(edges.map(edge => [edge.to, edge.tile]).sort((a, b) => a[1] - b[1]),
    [[set.path, 1], [set.path, 2]], `${set.board}: both tile references resolve`);
}
for (const specimen of [...legacyBoardAssets, ...legacyBoards]) {
  const packaged = Buffer.from(await opened.file(specimen.path).async("uint8array"));
  assert.deepEqual(packaged, await sourceBytes(specimen), `${specimen.path}: source bytes changed`);
}
const boardDependencyPaths = {
  tiles: `${project}/Tiles/two-tiles.tst`,
  item: `${project}/Item/token-2.itm`,
  image: `${project}/Bitmap/face.gif`,
  music: `${project}/Media/note.mid`,
};
for (const boardSpec of legacyBoards) {
  const board = artifacts.get(boardSpec.path);
  assert.deepEqual([board.width, board.height, board.layers],
    [boardSpec.width, boardSpec.height, boardSpec.layers], boardSpec.path);
  const edges = graph.outgoing.get(boardSpec.path) ?? [];
  const tileNumbers = [...new Set(edges.filter(edge => edge.to === boardDependencyPaths.tiles)
    .map(edge => edge.tile).filter(Number.isInteger))].sort((a, b) => a - b);
  assert.deepEqual(tileNumbers, boardSpec.expectedTileNumbers, `${boardSpec.path}: exact tile references`);
  if (boardSpec.format === "text") {
    for (const path of [boardDependencyPaths.item, boardDependencyPaths.image, boardDependencyPaths.music, files.startup]) {
      assert.ok(edges.some(edge => edge.to === path), `${boardSpec.path}: unresolved expected ref ${path}`);
    }
  }
  if (boardSpec.format === "binary") {
    assert.deepEqual(board.threads, boardSpec.threads, boardSpec.path);
    assert.equal(board.coordinateType, boardSpec.coordinateType, boardSpec.path);
    const threadEdges = edges.filter(edge => edge.evidence.startsWith("Board thread"));
    assert.deepEqual(threadEdges.map(edge => edge.value),
      boardSpec.threads.filter(Boolean), `${boardSpec.path}: thread reference slots`);
    if (boardSpec.threads.includes("absent.prg")) {
      assert.ok(threadEdges.some(edge => edge.value === "absent.prg" && !edge.to),
        `${boardSpec.path}: unresolved thread deliberately preserved`);
    }
  }
}
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
console.log(`Verified ${output}: project paths, startup bindings, solid cell, transparency, 16 walking tile references; ${specimens.length} standalone GPH variants; ${tilesetSpecimens.length} TST modes with linked gallery boards; ${legacyBoards.length} historical boards.`);
