import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { fixtures as formatFixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import { visualCharacterBytes, visualTileBytes, diagnosticStyle } from "../docs/specs/fixtures/visual-character-fixtures.mjs";
import { visualItemBytes, visualItemTileBytes, itemDiagnosticStyle } from "../docs/specs/fixtures/visual-item-fixtures.mjs";
import { visualEnemyBytes, visualEnemyTileBytes, enemyDiagnosticStyle } from "../docs/specs/fixtures/visual-enemy-fixtures.mjs";
import { enemySprite, itemSprites, standaloneTilePixels } from "../sprites.mjs";
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
const legacyCharacters = manifest.legacyCharacters ?? [];
const legacyCharacterAssets = manifest.legacyCharacterAssets ?? [];
const visualSpriteKit = manifest.visualSpriteKit ?? null;
const legacyItems = manifest.legacyItems ?? [];
const visualItemKit = manifest.visualItemKit ?? null;
const legacyEnemies = manifest.legacyEnemies ?? [];
const visualEnemyKit = manifest.visualEnemyKit ?? null;
const fixtureByPath = new Map(formatFixtures.map(fixture => [fixture.path, fixture.bytes]));
const sourceBytes = async specimen => {
  if (specimen.visualStyle) {
    assert.equal(specimen.visualStyle, diagnosticStyle.id);
    assert.ok(specimen.fixture && !specimen.source, "Diagnostic TEM needs its historical reference fixture");
    assert.ok(fixtureByPath.has(specimen.fixture), "Original format fixture must be retained");
    const bytes = visualCharacterBytes.get(specimen.fixture);
    assert.ok(bytes, `Unknown diagnostic TEM source: ${specimen.fixture}`);
    return bytes;
  }
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
  ...(visualSpriteKit ? [
    "Visual standard diagnostic-v1: transparent outer corner, bright border, white top-left and bottom-right, dark interior.",
    "Every TEM walk and artwork slot must be visibly populated. Direction colors South=green, East=orange, North=blue, West=violet.",
    "Action colors Attack=coral, Defense=blue, Special=purple, Defeat=gray, Rest=teal, Custom=yellow.",
    "Referenced walking uses top/bottom parts, not a single embedded 32x32 sprite. Blank diagnostic artwork is a failure.",
  ] : []),
  ...legacyCharacters.map(character => `TEM ${character.format} ${character.revision} ${character.graphics}: ${character.path} | Diagnostic colors and visible pixels; save a copy`),
  ...legacyItems.map(item => `ITM ${item.format} ${item.revision} ${item.graphics}: ${item.path} | Every walking frame and rest pose should show a colored relic`),
  ...legacyEnemies.map(enemy => `ENE ${enemy.revision} ${enemy.tail}: ${enemy.path} | Distinct 2x2 enemy art; inspect animation tail; save a copy`),
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
if (visualSpriteKit) {
  assert.equal(visualSpriteKit.style, diagnosticStyle.id);
  assert.equal(visualSpriteKit.tileCount, visualTileBytes.size);
  assert.equal(legacyCharacters.length, diagnosticStyle.characterCount);
  for (const [tile, pixels] of visualTileBytes) zip.file(`${project}/Tiles/${tile}`, pixels, options);
}
if (visualItemKit) {
  assert.equal(visualItemKit.style, itemDiagnosticStyle.id);
  assert.equal(visualItemKit.tileCount, visualItemTileBytes.size);
  assert.equal(legacyItems.length, itemDiagnosticStyle.count);
  for (const [name, bytes] of visualItemTileBytes) zip.file(`${project}/Tiles/${name}`, bytes, options);
  for (const item of legacyItems) {
    assert.equal(item.visualStyle, itemDiagnosticStyle.id);
    assert.ok(item.path.startsWith(project + "/Item/") && item.path.endsWith(".itm"), item.path);
    assert.ok(fixtureByPath.has(item.fixture), `${item.path}: source evidence missing`);
    const bytes = visualItemBytes.get(item.fixture);
    assert.ok(bytes, `${item.path}: generator specimen missing`);
    zip.file(item.path, bytes, options);
  }
}
if (visualEnemyKit) {
  assert.equal(visualEnemyKit.style, enemyDiagnosticStyle.id);
  assert.equal(visualEnemyKit.tileCount, visualEnemyTileBytes.size);
  assert.equal(legacyEnemies.length, enemyDiagnosticStyle.count);
  for (const [name, bytes] of visualEnemyTileBytes) zip.file(`${project}/Tiles/${name}`, bytes, options);
  for (const enemy of legacyEnemies) {
    assert.equal(enemy.visualStyle, enemyDiagnosticStyle.id);
    assert.ok(enemy.path.startsWith(project + "/Enemy/") && enemy.path.endsWith(".ene"), enemy.path);
    assert.ok(fixtureByPath.has(enemy.fixture), `${enemy.path}: source evidence missing`);
    const bytes = visualEnemyBytes.get(enemy.fixture);
    assert.ok(bytes, `${enemy.path}: generated specimen missing`);
    zip.file(enemy.path, bytes, options);
  }
}
for (const specimen of [...legacyBoardAssets, ...legacyBoards, ...legacyCharacterAssets, ...legacyCharacters]) {
  assert.ok(specimen.path.startsWith(project + "/"), specimen.path);
  if (legacyBoards.includes(specimen)) assert.ok(specimen.path.startsWith(project + "/Boards/"), specimen.path);
  if (legacyCharacters.includes(specimen)) assert.ok(specimen.path.startsWith(project + "/Chrs/"), specimen.path);
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
  ...legacyBoards.map(board => board.path), ...legacyBoardAssets.map(asset => asset.path),
  ...legacyCharacters.map(character => character.path),
  ...legacyCharacterAssets.map(asset => asset.path),
  ...(visualSpriteKit ? [...visualTileBytes.keys()].map(tile => `${project}/Tiles/${tile}`) : []),
  ...legacyItems.map(item => item.path),
  ...(visualItemKit ? [...visualItemTileBytes.keys()].map(tile => `${project}/Tiles/${tile}`) : []),
  ...legacyEnemies.map(enemy => enemy.path),
  ...(visualEnemyKit ? [...visualEnemyTileBytes.keys()].map(tile => `${project}/Tiles/${tile}`) : [])];
assert.equal(new Set(requiredPaths).size, requiredPaths.length, "Duplicate manifest paths");
assert.deepEqual([...artifacts.keys()].sort(), [...requiredPaths, readmePath].sort());
for (const path of requiredPaths) assert.equal(artifacts.get(path).decodeStatus, "decoded", path);
if (visualSpriteKit) {
  for (const [name, bytes] of visualTileBytes) {
    const path = `${project}/Tiles/${name}`;
    assert.deepEqual(Buffer.from(await opened.file(path).async("uint8array")), bytes, path);
    const tile = artifacts.get(path);
    assert.deepEqual([tile.width, tile.height, tile.detail, tile.compressed], [32, 32, 1, false]);
    assert.equal(tile.pixels.length, 1024);
    assert.equal(tile.pixels[0], diagnosticStyle.transparentCorner);
    assert.equal(tile.pixels[2 * 32 + 2], diagnosticStyle.corners.topLeft);
    assert.equal(tile.pixels[29 * 32 + 29], diagnosticStyle.corners.bottomRight);
    assert.ok(tile.pixels.filter(value => value !== -1).length > 500, `${path}: must be visually substantial`);
  }
}
if (visualItemKit) {
  for (const [name, raw] of visualItemTileBytes) {
    const path = `${project}/Tiles/${name}`;
    assert.deepEqual(Buffer.from(await opened.file(path).async("uint8array")), raw, path);
    const tile = artifacts.get(path);
    assert.deepEqual([tile.width, tile.height, tile.detail, tile.compressed], [32, 32, 1, false], path);
    assert.equal(tile.pixels[0], -1, path);
    assert.equal(tile.pixels[2 * 32 + 2], diagnosticStyle.corners.topLeft, path);
    assert.ok(tile.pixels.filter(value => value !== -1).length > 500, path);
    const rgba = standaloneTilePixels(tile);
    assert.deepEqual([...rgba.slice(0, 4)], [0, 0, 0, 0], path);
    assert.equal(rgba[(16 * 32 + 16) * 4 + 3], 255, path);
  }
}
if (visualEnemyKit) {
  for (const [name, raw] of visualEnemyTileBytes) {
    const path = `${project}/Tiles/${name}`;
    assert.deepEqual(Buffer.from(await opened.file(path).async("uint8array")), raw, path);
    const tile = artifacts.get(path);
    assert.deepEqual([tile.width, tile.height, tile.detail, tile.compressed],
      [32, 32, 1, false], path);
    assert.equal(tile.pixels.length, 1024, path);
    assert.ok(tile.pixels.includes(-1), `${path}: transparent margin expected`);
    assert.ok(tile.pixels.filter(pixel => pixel !== -1).length > 500,
      `${path}: mostly nonblank enemy quadrant expected`);
    assert.notEqual(tile.pixels[16 * 32 + 16], -1, `${path}: nontransparent center`);
  }
}
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
for (const specimen of [...legacyBoardAssets, ...legacyBoards, ...legacyCharacters, ...legacyCharacterAssets]) {
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
const expectedCharacterDependencies = {
  portrait: `${project}/Bitmap/face.gif`,
  tileset: `${project}/Tiles/two-tiles.tst`,
  sound: `${project}/Media/tone.wav`,
  specialMove: `${project}/SpcMove/pulse.spc`,
  program: files.startup,
};
for (const characterSpec of legacyCharacters) {
  assert.ok(["text", "binary"].includes(characterSpec.format));
  assert.ok(["embedded", "referenced"].includes(characterSpec.graphics));
  const asset = artifacts.get(characterSpec.path);
  assert.equal(asset.name, characterSpec.expectedName, characterSpec.path);
  assert.equal(asset.walking.length, 16, characterSpec.path);
  assert.equal(asset.artwork.length, 27, characterSpec.path);
  assert.deepEqual([asset.artwork[0].kind, asset.artwork[0].frame, asset.artwork[0].width,
    asset.artwork[0].height], ["Attack", 1, ...characterSpec.battleSize], characterSpec.path);
  assert.deepEqual([asset.artwork.at(-1).kind, asset.artwork.at(-1).frame],
    ["Custom", 10], characterSpec.path);
  if (characterSpec.graphics === "embedded") {
    assert.equal(asset.embeddedWalking.length, 16, characterSpec.path);
    assert.ok(asset.embeddedWalking.every(pixels => pixels.length === 1024), characterSpec.path);
    assert.ok(asset.embeddedWalking.some(pixels => pixels.includes(-1)), characterSpec.path);
    assert.ok(asset.embeddedWalking.every(pixels => pixels.filter(value => value !== -1).length > 500),
      `${characterSpec.path}: all walking frames must show substantial diagnostic art`);
    assert.ok(asset.artwork.every(frame => frame.pixels?.length === 1024), characterSpec.path);
    assert.ok(asset.artwork.every(frame => frame.pixels.filter(value => value !== -1).length > 500),
      `${characterSpec.path}: all action/rest/custom frames must be visible`);
  } else {
    assert.equal(asset.embeddedWalking, undefined, characterSpec.path);
    assert.ok(asset.artwork.every(frame => Array.isArray(frame.parts)), characterSpec.path);
    assert.ok(asset.artwork.every(frame => frame.parts.length > 0 && frame.parts.every(part => part.value)),
      `${characterSpec.path}: all referenced art frames have filled graphic slots`);
    assert.ok(asset.walking.every(frame => frame.parts.length === 2 && frame.parts.every(part => part.value)),
      `${characterSpec.path}: all walking frames have top and bottom`);
  }
  const edges = graph.outgoing.get(characterSpec.path) ?? [];
  assert.ok(edges.some(edge => edge.evidence === "Character portrait" &&
    edge.to === expectedCharacterDependencies.portrait), `${characterSpec.path}: portrait must resolve`);
  if (characterSpec.format === "text") {
    for (const [evidence, path] of [
      ["Special move slot 0", expectedCharacterDependencies.specialMove],
      ["Attack sound", expectedCharacterDependencies.sound],
      ["Level-up program", expectedCharacterDependencies.program],
    ]) assert.ok(edges.some(edge => edge.evidence === evidence && edge.to === path),
      `${characterSpec.path}: missing resolved ${evidence}`);
    // Text 2.0/2.1 fixtures supply a special-move sound; text 2.2 deliberately leaves it blank.
    if (["2.0", "2.1"].includes(characterSpec.revision)) {
      assert.ok(edges.some(edge => edge.evidence === "Special move sound" &&
        edge.to === expectedCharacterDependencies.sound), `${characterSpec.path}: special-move sound`);
    }
  }
  const tileEdges = edges.filter(edge => edge.to === expectedCharacterDependencies.tileset &&
    edge.tile === 2 && edge.evidence.startsWith("Walk "));
  assert.equal(tileEdges.length > 0, characterSpec.expectedTilesetReference,
    `${characterSpec.path}: walking tile-reference presence`);
  if (characterSpec.visualStyle === diagnosticStyle.id && characterSpec.graphics === "referenced") {
    const diagEdges = edges.filter(edge => edge.to?.startsWith(`${project}/Tiles/diag-`));
    const expectedReferences = asset.walking.reduce((n, frame) => n + frame.parts.length, 0) +
      asset.artwork.reduce((n, frame) => n + frame.parts.length, 0);
    assert.equal(diagEdges.length, expectedReferences, `${characterSpec.path}: every visual art slot must resolve`);
    assert.ok(diagEdges.every(edge => artifacts.get(edge.to)?.type === "gph"), characterSpec.path);
  }
  if (characterSpec.revision === "2.1" && characterSpec.graphics === "referenced") {
    assert.equal(asset.artwork[0].parts.length, 2, "Text 2.1 referenced battle frames use one tile column");
  }
}
for (const itemSpec of legacyItems) {
  const bytes = visualItemBytes.get(itemSpec.fixture);
  assert.deepEqual(Buffer.from(await opened.file(itemSpec.path).async("uint8array")), bytes, itemSpec.path);
  const item = artifacts.get(itemSpec.path);
  assert.deepEqual([item.version, item.name], [itemSpec.version, itemSpec.expectedName], itemSpec.path);
  const embedded = itemSpec.graphics === "embedded";
  assert.equal(Boolean(item.embeddedGraphics), embedded, itemSpec.path);
  if (embedded) {
    assert.equal(item.embeddedGraphics.walking.length, 16, itemSpec.path);
    assert.ok(item.embeddedGraphics.walking.every(frame =>
      frame?.length === 1024 && frame.filter(value => value !== -1).length > 500), itemSpec.path);
    assert.equal(item.embeddedGraphics.rest.length, 1024, itemSpec.path);
  } else {
    assert.ok(item.walking.every(frame => frame.length === 2 && frame.every(Boolean)), itemSpec.path);
    assert.ok(item.rest.every(Boolean), itemSpec.path);
  }
  const sprites = itemSprites(item, artifacts, graph);
  assert.ok(sprites.rest && sprites.rest.pixels.some(value => value !== 0), itemSpec.path);
  const frames = sprites.walking.flatMap(direction => direction.frames);
  assert.equal(frames.length, 16, itemSpec.path);
  assert.ok(frames.every(frame => frame && frame.missing.length === 0 && frame.pixels[(16 * frame.width + 16) * 4 + 3] === 255),
    `${itemSpec.path}: every walking frame must be visible with no missing assets`);
  assert.equal(new Set(frames.map(frame => Buffer.from(frame.pixels).toString("base64"))).size, 16,
    `${itemSpec.path}: all 16 walking frames must be visually distinguishable`);
  const edges = graph.outgoing.get(itemSpec.path) ?? [];
  assert.ok(edges.some(edge => edge.evidence === "Equip program" && edge.to === files.startup), itemSpec.path);
  assert.ok(edges.some(edge => edge.evidence === "Item animation" &&
    edge.to === `${project}/Misc/effect.anm`), itemSpec.path);
  if (!embedded) {
    assert.equal(edges.filter(edge => edge.to?.startsWith(`${project}/Tiles/diag-item-`)).length, 34,
      `${itemSpec.path}: 32 walking and 2 rest source references must resolve`);
  }
}
for (const enemySpec of legacyEnemies) {
  const fixture = visualEnemyBytes.get(enemySpec.fixture);
  assert.deepEqual(Buffer.from(await opened.file(enemySpec.path).async("uint8array")),
    fixture, enemySpec.path);
  const enemy = artifacts.get(enemySpec.path);
  assert.equal(enemy.name, enemySpec.expectedName, enemySpec.path);
  assert.deepEqual([enemy.width, enemy.height, enemy.tileStride], [2, 2, 7], enemySpec.path);
  assert.deepEqual(enemy.stats, { HP: 14, "Special power": 5, Fight: 4, Defense: 3 });
  assert.equal(enemy.tiles.length, 133, enemySpec.path);
  const prefix = enemySpec.expectedAnimations === 4 ? "animated" : "short";
  const expected = Array.from({ length: 2 }, (_, x) =>
    Array.from({ length: 2 }, (_, y) => `diag-enemy-${prefix}-${x}-${y}.gph`));
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++)
    assert.equal(enemy.tiles[x * 7 + y], expected[x][y], `${enemySpec.path}: quadrant x=${x} y=${y}`);
  assert.equal(enemy.tiles.filter(Boolean).length, 4, enemySpec.path);
  const frame = enemySprite(enemy, artifacts, graph);
  assert.ok(frame, `${enemySpec.path}: enemy sprite must render`);
  assert.deepEqual([frame.width, frame.height], [64, 64]);
  assert.deepEqual(frame.missing, [], `${enemySpec.path}: all quadrants must resolve`);
  const alpha = (x, y) => frame.pixels[(y * frame.width + x) * 4 + 3];
  assert.equal(alpha(0, 0), 0, `${enemySpec.path}: transparent outer corner`);
  assert.equal(alpha(63, 63), 0, `${enemySpec.path}: transparent opposite corner`);
  for (const [x, y] of [[16, 16], [16, 48], [48, 16], [48, 48]])
    assert.equal(alpha(x, y), 255, `${enemySpec.path}: quadrant ${x},${y} must be visible`);
  const edges = graph.outgoing.get(enemySpec.path) ?? [];
  assert.equal(edges.filter(edge => edge.evidence.startsWith("Enemy tile · slot") &&
    edge.to?.startsWith(`${project}/Tiles/diag-enemy-`)).length, 4,
    `${enemySpec.path}: four graphic references must resolve`);
  for (const [label, destination] of [
    ["Victory program", files.startup], ["Attack sound", `${project}/Media/tone.wav`],
    ["Special move · slot 1", `${project}/SpcMove/pulse.spc`],
  ]) assert.ok(edges.some(edge => edge.evidence === label && edge.to === destination),
    `${enemySpec.path}: missing ${label} reference`);
  assert.equal(Object.keys(enemy.animations).length, enemySpec.expectedAnimations,
    `${enemySpec.path}: optional animation-tail shape`);
  const actions = ["Attack", "Defense", "Special move", "Defeat"];
  const animationEdges = edges.filter(edge => edge.evidence.endsWith(" animation"));
  assert.equal(animationEdges.length, enemySpec.expectedAnimations, enemySpec.path);
  if (enemySpec.expectedAnimations) for (const action of actions) {
    assert.equal(enemy.animations[action], "effect.anm");
    assert.ok(animationEdges.some(edge => edge.evidence === `${action} animation` &&
      edge.to === `${project}/Misc/effect.anm`), `${enemySpec.path}: ${action} animation must resolve`);
  } else {
    assert.deepEqual(enemy.animations, {}, `${enemySpec.path}: short tail must have no animation fields`);
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
console.log(`Verified ${output}: project paths, startup bindings, solid cell, transparency, 16 walking tile references; ${specimens.length} standalone GPH variants; ${tilesetSpecimens.length} TST modes with linked gallery boards; ${legacyBoards.length} historical boards; ${legacyCharacters.length} historical TEM profiles; ${visualSpriteKit ? visualTileBytes.size : 0} TEM diagnostic GPHs; ${legacyItems.length} historical ITMs; ${visualItemKit ? visualItemTileBytes.size : 0} ITM diagnostic GPHs; ${legacyEnemies.length} ENE variants; ${visualEnemyKit ? visualEnemyTileBytes.size : 0} ENE diagnostic GPHs.`);
