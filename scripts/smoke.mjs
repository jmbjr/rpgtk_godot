import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { midiTimeline } from "../midi.mjs";
import JSZip from "../vendor/jszip.min.js";
import { decodeProgram, indexProgram, readMainFile, resolveAsset } from "../model.mjs";

const [archivePath, mainPath] = process.argv.slice(2);
if (!archivePath || !mainPath) {
  console.error("Usage: node scripts/smoke.mjs /path/to/Demo.zip /path/to/Demo.gam");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url)));
const zip = await JSZip.loadAsync(await readFile(archivePath));
const paths = Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name);
assert.equal(paths.filter(path => /\.prg$/i.test(path)).length, 51);

const gam = readMainFile(await readFile(mainPath));
assert.equal(gam.title, "The Jewel Of Destiny (millenium)");
const startup = resolveAsset(paths, "Prg", gam.startup);
assert.equal(startup.path, "Demo/Prg/start.prg");
assert.equal(resolveAsset(paths, "Boards", gam.board, "Demo/").path, "Demo/Boards/house1.brd");
assert.equal(resolveAsset(paths, "Chrs", gam.character, "Demo/").path, "Demo/Chrs/frap.tem");

async function index(path) {
  const bytes = await zip.file(path).async("uint8array");
  return indexProgram(decodeProgram(bytes), catalog);
}

const program = await index(startup.path);
assert.equal(program.count, 65);
assert.equal(program.builtins.length, 28);
assert.deepEqual(program.groups.get("builtin:setbutton").lines, [83, 84, 85]);
assert.deepEqual(program.groups.get("builtin:dos").lines, [66]);
assert.deepEqual(program.groups.get("local:drawtitle").lines, [33]);
assert.equal(program.rows[25].tokens[0].kind, "comment");
assert.ok((await index("Demo/Prg/chest1.prg")).groups.has("builtin:giveitem"));
assert.throws(() => readMainFile(Buffer.from("RPGTLKIT MAIN\0")), /truncated/);
await assert.rejects(JSZip.loadAsync("bad"));
assert.equal(resolveAsset(["one/Prg/start.prg", "two/Prg/START.PRG"], "Prg", "start.prg").status, "ambiguous");

console.log("Demo smoke passed: 51 programs, 65 calls across 28 built-ins, and all three Main File bindings.");

const { readArtifacts, buildReferences, boardTilesets, tilePixels } = await import("../artifacts.mjs");
const { artifacts, folders } = await readArtifacts(zip, catalog);
assert.equal(artifacts.size, 153);
assert.ok(folders.includes("Demo/Tiles/"));
assert.ok(folders.includes("Demo/StatusE/"));
assert.deepEqual([...artifacts.values()].filter(artifact => artifact.error), []);
assert.equal([...artifacts.values()].filter(artifact => artifact.type === "tst").reduce((sum, set) => sum + set.count, 0), 356);
assert.equal([...artifacts.values()].filter(artifact => artifact.type === "tan").length, 8);

const connections = buildReferences(artifacts, { name: "Demo.gam", bindings: [
  ["Initial character", { path: "Demo/Chrs/frap.tem" }],
] });
const water = "Demo/Tiles/water.tst";
const animation = "Demo/Tiles/water2.tan";
const frames = connections.outgoing.get(animation);
assert.deepEqual(frames.map(edge => [edge.to, edge.tile]), Array.from({ length: 8 }, (_, i) => [water, i + 33]));
assert.ok(connections.incoming.get(water).some(edge => edge.from === animation && edge.tile === 33));
assert.ok(connections.incoming.get(animation).some(edge => edge.from === "Demo/Boards/castle_out.brd"));
const pixels = tilePixels(artifacts.get(water), 33);
assert.equal(pixels.length, 4096);
assert.ok(pixels.some((value, index) => index % 4 === 3 && value === 255));
assert.equal(tilePixels(artifacts.get(water), 41), null);
assert.ok(connections.incoming.get("Demo/Tiles/default.tst").some(edge => edge.from === "Demo/Boards/house1.brd" && edge.tile === 10));
assert.ok(connections.incoming.get("Demo/Chrs/tano.tem").some(edge => edge.from === "Demo/Prg/getTano.prg" && edge.line === 10));
assert.equal(artifacts.get("Demo/Chrs/frap.tem").stats.Level, 1);
assert.ok(connections.incoming.get("Demo/Chrs/frap.tem").some(edge => edge.from === "Demo.gam" && edge.external));

console.log("Artifact smoke passed: folder inventory, tileset counts, animation links, board references, and character uses.");

const openingBoard = "Demo/Boards/house1.brd";
const castle = "Demo/Boards/castle_out.brd";
const board = artifacts.get(openingBoard);
assert.deepEqual([board.width, board.height, board.layers], [19, 11, 8]);
assert.ok(board.runs.some(run => run.length > 1));
assert.ok(board.runs.every(run => run.offset + run.length <= 19 * 11 * 8));
assert.ok(connections.incoming.get(openingBoard).some(edge => edge.from === "Demo/Prg/warp00000002.prg" && edge.line === 2));
assert.ok(connections.outgoing.get(openingBoard).some(edge =>
  edge.to === "Demo/Prg/chest2.prg" && edge.evidence === "Board program (14, 4, layer 1)"));
const castleSets = boardTilesets(connections.outgoing.get(castle), connections, artifacts);
assert.deepEqual([...castleSets.keys()].sort(), ["Demo/Tiles/char.tst", "Demo/Tiles/default.tst", water]);
assert.ok(castleSets.get(water).animations.has(animation));
const withOpeningBoard = buildReferences(artifacts, { name: "Demo.gam", bindings: [
  ["Opening board", { path: openingBoard }],
] });
assert.ok(withOpeningBoard.incoming.get(openingBoard).some(edge => edge.from === "Demo.gam" && edge.external));
const boards = [...artifacts.values()].filter(artifact => artifact.type === "brd");
assert.equal(boards.length, 17);
assert.ok(boards.every(artifact => artifact.runs.length > 0));
console.log("Board smoke passed: 17 tile maps, compressed runs, placed programs, incoming board links, and animation-backed tilesets.");

const { artifactRecord } = await import("../records.mjs");
const counts = new Map();
for (const artifact of artifacts.values()) counts.set(artifact.decodeStatus, (counts.get(artifact.decodeStatus) ?? 0) + 1);
assert.deepEqual(Object.fromEntries(counts), { decoded: 153 });
assert.equal(artifacts.get("Demo/Font/BASE.FNT").glyphs.length, 256);
assert.equal(artifacts.get("Demo/Tiles/key.gph").pixels.length, 1024);
assert.equal(artifacts.get("Demo/Misc/explode.anm").frames[1].sound, "bang.wav");
assert.equal(artifacts.get("Demo/Enemy/larva.ene").stats.HP, 2000);
assert.equal(artifacts.get("Demo/Bkrounds/grass.bkg").tiles.length, 209);
assert.equal(artifacts.get("Demo/SpcMove/attackall.spc").program, "spc_attackall.prg");
assert.equal(artifacts.get("Demo/Item/kid1.itm").walking.length, 16);
assert.ok(connections.incoming.get(animation).some(edge => edge.from === castle));

const boardRecord = artifactRecord(board, connections);
const tileRecord = artifactRecord(artifacts.get("Demo/Tiles/default.tst"), connections);
assert.equal(boardRecord.schemaVersion, 1);
assert.equal(boardRecord.decode.status, "partial");
const lookup = boardRecord.data.tileLookup.find(entry => entry.value === "default.tst10");
assert.ok(boardRecord.data.runs.some(run => boardRecord.data.tileLookup[run.lookupIndex] === lookup));
assert.equal(lookup.value, "default.tst10");
assert.equal(lookup.reference.target.$ref, `${tileRecord.$id}#/data/tiles/9`);
assert.equal(tileRecord.data.tiles[9].number, 10);
assert.equal(Buffer.from(tileRecord.data.tiles[9].rgb, "base64").length, 3072);
const mainRecord = artifactRecord({ ...gam, path: "Demo.gam", type: "gam", decodeStatus: "decoded" }, connections, {
  external: true,
  bindings: [["Opening board", { path: openingBoard, value: gam.board, status: "resolved" }]],
});
assert.equal(mainRecord.$id, "rpgtk-main:/Demo.gam");
assert.equal(mainRecord.references.outgoing[0].target.$ref, boardRecord.$id);
assert.equal(artifactRecord(artifacts.get("Demo/Boards/temp.___"), connections).decode.status, "partial");
console.log("JSON smoke passed: all 153 files have structured records and exact tile and Main File references.");

const gif = artifacts.get("Demo/Bitmap/title.gif");
assert.deepEqual([gif.signature, gif.width, gif.height], ["GIF89a", 608, 352]);
assert.ok(gif.frames.length);
const jpeg = artifacts.get("Demo/Bitmap/mountains.jpg");
assert.deepEqual([jpeg.width, jpeg.height], [608, 512]);
assert.equal(jpeg.components.length, 3);
const wave = artifacts.get("Demo/Media/bang.wav");
assert.deepEqual([wave.channels, wave.sampleRateHz, wave.bitsPerSample, wave.sampleFrames], [1, 8000, 8, 7187]);
assert.equal(wave.durationSeconds, 0.898375);
const midi = artifacts.get("Demo/Media/VIP - Dungeon2.mid");
assert.equal(midi.trackCount, 18);
assert.equal(midi.timeDivision.ticksPerQuarter, 120);
assert.ok(midi.tracks.some(track => track.tempos.length));
const titleMusic = connections.outgoing.get(startup.path).find(edge => edge.to?.endsWith("VIP - Title2.mid"));
assert.ok(titleMusic);
const titleTimeline = midiTimeline(await zip.file(titleMusic.to).async("uint8array"));
assert.ok(titleTimeline.duration > 1);
assert.ok(titleTimeline.events.some(event => (event.message[0] & 0xf0) === 0x90 && event.message[2] > 0));
assert.ok(titleTimeline.events.every((event, index, events) =>
  Number.isFinite(event.seconds) && (!index || event.seconds >= events[index - 1].seconds)));

const doc = artifacts.get("Demo/Media/VIP - RPGToolkit Fo Sho Music Pak  EULA.doc");
assert.equal(doc.sectorSize, 512);
assert.ok(doc.directory.some(entry => entry.name === "WordDocument"));
const temp = artifacts.get("Demo/Boards/temp.___");
assert.deepEqual(temp.header, [0, 0, 0, 35, 23]);
assert.equal(temp.records.length, 280);
assert.deepEqual(temp.records[0], { tileName: "default.tst80", values: [-30, -30, -30] });
assert.ok(connections.outgoing.get(temp.path).some(edge => edge.tile === 80 && edge.line === 6));

const { readCompoundDocument, readGif, readJpeg, readMidi, readWave } = await import("../media.mjs");
for (const [read, artifact] of [[readGif, gif], [readJpeg, jpeg], [readWave, wave], [readMidi, midi], [readCompoundDocument, doc]]) {
  const bytes = await zip.file(artifact.path).async("uint8array");
  assert.throws(() => read(bytes.subarray(0, 8)));
}
const titleOne = artifacts.get("Demo/Media/VIP - Title1.mid");
assert.equal(titleOne.tracks.length, 1);
const openingParts = titleOne.tracks[0].parts.slice(0, 3);
assert.deepEqual(openingParts.map(({ channel, instrument, noteCount, lowestNote, highestNote }) =>
  [channel, instrument, noteCount, lowestNote, highestNote]), [
  [1, "String Ensemble 2", 164, 55, 84],
  [2, "Orchestral Harp", 862, 39, 87],
  [7, "Clarinet", 269, 60, 84],
]);
for (const { type, tracks } of artifacts.values()) {
  if (type === "mid") {
    assert.ok(tracks.every(track => track.noteOnEvents === track.parts.reduce((sum, part) => sum + part.noteCount, 0)));
  }
}
const midiBytes = (format, ...tracks) => Uint8Array.from([
  77, 84, 104, 100, 0, 0, 0, 6, 0, format, 0, tracks.length, 0, 96,
  ...tracks.flatMap(track => [77, 84, 114, 107, 0, 0, 0, track.length + 4, ...track, 0, 255, 47, 0]),
]);
const programTrack = [0, 0xc0, 71, 10, 0xc0, 46];
const noteTrack = [0, 0x90, 60, 80, 1, 61, 0, 10, 64, 80, 0, 0x99, 35, 90];
const shared = readMidi(midiBytes(1, programTrack, noteTrack)).tracks;
assert.equal(shared[0].parts.length, 0);
assert.deepEqual(shared[1].parts.map(part => [part.instrument, part.noteCount, part.lowestNote]), [
  ["Clarinet", 1, 60], ["Orchestral Harp", 1, 64], ["Percussion", 1, 35],
]);
assert.equal(readMidi(midiBytes(2, programTrack, noteTrack)).tracks[1].parts[0].instrument, "Acoustic Grand Piano");
console.log("Media smoke passed: image headers, WAV timing, MIDI tracks, compound directory, and observed temporary text records.");

const { animationFrames, battleBackground, enemySprite, itemSprites, keyFrameColor, standaloneTilePixels } = await import("../sprites.mjs");
const larva = enemySprite(artifacts.get("Demo/Enemy/larva.ene"), artifacts, connections);
assert.deepEqual([larva.width, larva.height, larva.parts.length, larva.missing.length], [128, 64, 8, 0]);
const enemySet = artifacts.get("Demo/Tiles/enemy.tst");
for (const { x, y, edge } of larva.parts) {
  const tile = tilePixels(enemySet, 17 + x * 2 + y);
  assert.equal(edge.tile, 17 + x * 2 + y);
  for (let row = 0; row < 32; row++) {
    const start = ((y * 32 + row) * larva.width + x * 32) * 4;
    assert.deepEqual(larva.pixels.subarray(start, start + 128), tile.subarray(row * 128, (row + 1) * 128));
  }
}
const kid = itemSprites(artifacts.get("Demo/Item/kid1.itm"), artifacts, connections);
assert.deepEqual([kid.rest.width, kid.rest.height, kid.rest.parts[0].edge.tile], [32, 32, 33]);
assert.deepEqual(kid.walking.map(sequence => sequence.direction), ["South", "East", "North", "West"]);
assert.ok(kid.walking.every(sequence => sequence.frames.length === 4 && sequence.frames.every(frame => !frame.missing.length)));
assert.deepEqual(kid.walking[0].frames.map(frame => frame.parts[0].edge.tile), [33, 34, 33, 34]);
const key = itemSprites(artifacts.get("Demo/Item/keystone.itm"), artifacts, connections);
assert.equal(key.rest.parts[0].edge.to, "Demo/Tiles/key.gph");
assert.deepEqual(key.rest.pixels, standaloneTilePixels(artifacts.get("Demo/Tiles/key.gph")));
assert.ok(key.rest.pixels.some((value, i) => i % 4 === 3 && value === 0));
assert.ok(key.rest.pixels.some((value, i) => i % 4 === 3 && value === 255));
const herb = itemSprites(artifacts.get("Demo/Item/herb1.itm"), artifacts, connections);
assert.equal(herb.rest, null);
assert.ok(herb.walking.every(sequence => sequence.frames.every(frame => frame === null)));
for (const artifact of artifacts.values()) {
  if (artifact.type !== "ene") continue;
  const sprite = enemySprite(artifact, artifacts, connections);
  const expectedMissing = /\/Evthing2?\.ene$/.test(artifact.path) ? 18 : 0;
  assert.equal(sprite.missing.length, expectedMissing, artifact.path);
  assert.ok(sprite.missing.every(part => part.edge?.status === "Missing"));
}
console.log("Sprite smoke passed: assembled enemy pixels, all directions for Kid1, standalone tile transparency, and an item without graphics.");

const temple = artifacts.get("Demo/Bkrounds/temple.bkg");
const backdrop = battleBackground(temple, artifacts, connections);
assert.deepEqual([backdrop.width, backdrop.height, backdrop.parts.length, backdrop.missing.length], [608, 352, 209, 0]);
const shaded = backdrop.parts.find(part => part.x === 2 && part.y === 2);
assert.equal(shaded.edge.tile, 60);
assert.deepEqual(shaded.shade, [-30, -30, -30]);
const sourcePixel = tilePixels(artifacts.get(shaded.edge.to), shaded.edge.tile).slice(0, 4);
const shadedOffset = ((2 * 32) * backdrop.width + 2 * 32) * 4;
assert.deepEqual(backdrop.pixels.slice(shadedOffset, shadedOffset + 4),
  new Uint8ClampedArray([sourcePixel[0] - 30, sourcePixel[1] - 30, sourcePixel[2] - 30, sourcePixel[3]]));
assert.ok(connections.outgoing.get(temple.path).some(edge =>
  edge.evidence === "Music" && edge.status === "Missing" && edge.value === "VIP - Battle2.mid"));

const explosion = artifacts.get("Demo/Misc/explode.anm");
const explosionFrames = animationFrames(explosion.frames);
assert.deepEqual([explosion.width, explosion.height, explosionFrames.length], [180, 135, 8]);
assert.equal(explosionFrames[1].sound, "bang.wav");
assert.ok(connections.outgoing.get(explosion.path).some(edge =>
  edge.evidence === "Frame 2 sound" && edge.to === "Demo/Media/bang.wav"));
const framePixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
keyFrameColor(framePixels, 255);
assert.deepEqual([...framePixels], [255, 0, 0, 0, 0, 0, 255, 255]);
const move = artifacts.get("Demo/SpcMove/attackall.spc");
assert.deepEqual(move.storedUseFlags, [0, 1]);
assert.equal(move.battle, true);
assert.equal(move.board, false);
const moveRecord = artifactRecord(move, connections);
assert.equal(moveRecord.data.program, "spc_attackall.prg");
assert.ok(moveRecord.references.outgoing.some(edge => edge.target.$ref === "rpgtk:/Demo/Prg/spc_attackall.prg"));
assert.ok(connections.outgoing.get(move.path).some(edge => edge.to === explosion.path));
console.log("Inspector smoke passed: shaded battle backdrop, frame and sound references, color key, and editor-verified special-move flags.");
