import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { openGameArchive } from "../archive.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { resolveInitialItemArtwork, mapBoardPlacements, spriteDrawOrder, spritePixelOrigin }
  from "../placed-sprites.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { character28, nativeAnims, animation23, testTileset }
  from "../docs/specs/fixtures/native-character-28-fixtures.mjs";
import { nativeItem27 } from "../docs/specs/fixtures/native-item-27-fixtures.mjs";
import { closedBitmap, nativeHouseAnimation }
  from "../docs/specs/fixtures/native-tbm-30-fixtures.mjs";

const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
zip.file("BSTW/Prg/menuTitle.prg", "Synthetic test");
zip.file("BSTW/Boards/start.brd", board24Fixtures.standard);
zip.file("BSTW/Chrs/bruce.tem", character28);
zip.file("BSTW/Item/jim.itm", nativeItem27());
zip.file("BSTW/Item/door.itm", nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Prg/mwininn.prg", "Synthetic locked inn");
zip.file("BSTW/Prg/sideDoor.prg", "Synthetic other door");
zip.file("BSTW/Tiles/test-characters.tst", testTileset);
zip.file("BSTW/Tiles/sample.tst", testTileset);
zip.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
zip.file("BSTW/Bitmap/synthetic_closed.tbm", closedBitmap);
zip.file("BSTW/Misc/synthetic_house.anm", nativeHouseAnimation);
for (const [name, bytes] of nativeAnims) zip.file("BSTW/Misc/" + name, bytes);
for (const [name, tile] of [["native_south.anm", 14], ["rest_native.anm", 15]]) {
  zip.file("BSTW/Misc/" + name, animation23([
    "test-characters.tst" + tile], 0, 0.2));
}

const { artifacts } = await readArtifacts(zip, {});
const baseline = artifacts.get("BSTW/Boards/start.brd");
const board = {
  ...baseline, sprites: baseline.sprites.map(sprite => ({ ...sprite })),
  refs: baseline.refs.map(ref => ({ ...ref })),
};
board.sprites[1].activationProgram = "mwininn.prg";
board.refs = board.refs.map(ref =>
  ref.evidence === "Native sprite activation program · slot 1" ?
    { ...ref, value: "mwininn.prg" } : ref);
// Another door looks identical but its configured script is not the inn.
board.sprites.push({ ...board.sprites[1], slot: 2, position: { x: 45, y: 27, layer: 1 },
  activationProgram: "sideDoor.prg" });
board.refs.push(
  { value: "door.itm", evidence: "Native board sprite · slot 2" },
  { value: "sideDoor.prg", evidence: "Native sprite activation program · slot 2" },
);
// One native ITM points to a larger 3×3 TBM first frame, to test the
// existing bitmap artwork compositor instead of inventing sprite pixels.
const jim = artifacts.get("BSTW/Item/jim.itm");
const house = {
  ...jim, path: "BSTW/Item/house_3x3.itm", name: "Synthetic House",
  directionalAnimations: jim.directionalAnimations.map(e => e.direction === "South" ?
    { ...e, value: "synthetic_house.anm" } : e),
  refs: jim.refs.map(ref => ref.evidence === "Walk South animation" ?
    { ...ref, value: "synthetic_house.anm" } : ref),
};
board.sprites.push({ ...board.sprites[0], slot: 3, filename: "house_3x3.itm",
  position: { x: 65, y: 58, layer: 2 } });
board.refs.push({ value: "house_3x3.itm", evidence: "Native board sprite · slot 3" });
artifacts.set(board.path, board);
artifacts.set(house.path, house);
const graph = buildReferences(artifacts);
const scene = buildPlayableScene(artifacts, graph);
assert.equal(scene.ok, true, JSON.stringify(scene.issues));
assert.equal(scene.placements.length, 4);
assert.deepEqual(scene.placements.map(p => p.slot), [0, 1, 2, 3]);
assert.deepEqual(scene.placements.map(p => p.itemStatus),
  ["resolved", "resolved", "resolved", "resolved"]);
assert.deepEqual(scene.placements.map(p => p.artStatus),
  ["resolved", "unset", "unset", "resolved"]);
assert.deepEqual(scene.placements.map(p => p.artwork?.kind ?? null),
  ["tst", null, null, "tbm"]);
assert.equal(scene.placements[0].artwork.tile, 14);
assert.deepEqual([scene.placements[3].artwork.width, scene.placements[3].artwork.height],
  [96, 96]);
assert.equal(scene.placements[3].artSource, "Walk South animation");
assert.deepEqual(scene.placements.map(p => p.isInnDoor), [false, true, false, false]);
assert.equal(scene.placements[1].programStatus, "resolved");
assert.equal(scene.placements[2].programStatus, "resolved");
assert.deepEqual(scene.innDoor, {
  slot: 1, position: { x: 68, y: 90, layer: 2 },
  itemPath: "BSTW/Item/door.itm", programPath: "BSTW/Prg/mwininn.prg",
});
assert.equal(scene.innStatus, "resolved");

const layer1 = spriteDrawOrder(scene.placements, { x: 42, y: 35, layer: 1 }, 1);
assert.deepEqual(layer1.map(entry => entry.kind === "player" ? "player" : entry.slot),
  [2, "player", 0], "same layer sorted by Y (and stable X/slot ties)");
const layer2 = spriteDrawOrder(scene.placements, { x: 42, y: 35, layer: 1 }, 2);
assert.deepEqual(layer2.map(entry => entry.slot), [3, 1],
  "higher-layer items draw separately after lower-layer tiles/sprites");
assert.deepEqual(spritePixelOrigin({ x: 207, y: 349 }, 32, 32), { x: 191, y: 318 });
assert.deepEqual(spritePixelOrigin({ x: 120, y: 120 }, 96, 96), { x: 72, y: 25 });

// Missing artwork must NOT mark the native item as missing or prevent play.
const noArt = new Map(artifacts);
noArt.delete("BSTW/Misc/native_south.anm");
noArt.delete("BSTW/Misc/rest_native.anm");
const fallback = buildPlayableScene(noArt, buildReferences(noArt));
assert.equal(fallback.ok, true);
assert.equal(fallback.placements[0].itemStatus, "resolved");
assert.equal(fallback.placements[0].artStatus, "missing");
assert.equal(fallback.placements[0].artwork, null);
assert.equal(fallback.innDoor.slot, 1);
// Missing ITM keeps a diagnosable placement and still finds the inn
// from its board activation program.
const withoutItem = new Map(artifacts);
withoutItem.delete("BSTW/Item/door.itm");
const noItem = buildPlayableScene(withoutItem, buildReferences(withoutItem));
assert.equal(noItem.ok, true);
assert.equal(noItem.placements[1].itemStatus, "missing");
assert.equal(noItem.placements[1].artStatus, "missing");
assert.equal(noItem.innDoor.slot, 1);
const withoutBitmap = new Map(artifacts);
withoutBitmap.delete("BSTW/Tiles/sample.tst");
const noBitmap = buildPlayableScene(withoutBitmap, buildReferences(withoutBitmap));
assert.equal(noBitmap.ok, true);
assert.equal(noBitmap.placements[3].itemStatus, "resolved");
assert.equal(noBitmap.placements[3].artStatus, "resolved");
assert.equal(noBitmap.placements[3].artSource, "Rest animation",
  "Missing native bitmap may fall back to an authored Rest ANM frame");
const missingScript = new Map(artifacts);
missingScript.delete("BSTW/Prg/mwininn.prg");
const noScript = buildPlayableScene(missingScript, buildReferences(missingScript));
assert.equal(noScript.ok, true);
assert.equal(noScript.innDoor, null);
assert.equal(noScript.placements[1].programStatus, "missing");
// A second resolved mwininn link cannot silently choose the wrong door.
const ambiguous = new Map(artifacts);
const secondBoard = { ...board,
  sprites: board.sprites.map(p => p.slot === 2 ?
    { ...p, activationProgram: "mwininn.prg" } : p),
  refs: board.refs.map(r => r.evidence === "Native sprite activation program · slot 2" ?
    { ...r, value: "mwininn.prg" } : r),
};
ambiguous.set(board.path, secondBoard);
const twoInns = buildPlayableScene(ambiguous, buildReferences(ambiguous));
assert.equal(twoInns.ok, true);
assert.equal(twoInns.innStatus, "ambiguous");
assert.equal(twoInns.innDoor, null);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const client = await readFile(new URL(
  "../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
assert.match(html, /id="play-inn"/);
assert.match(html, /id="play-placements"/);
assert.match(client, /spriteDrawOrder/);
assert.match(client, /spritePixelOrigin/);
assert.match(client, /tileBitmapSprite/);
assert.match(client, /INN DOOR/);

// Optional production-JS check of owner's original ZIP, NEVER CI input.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const realZip = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const real = (await readArtifacts(realZip, {})).artifacts;
  const realScene = buildPlayableScene(real, buildReferences(real));
  assert.equal(realScene.ok, true, JSON.stringify(realScene.issues));
  assert.equal(realScene.placements.length, 7);
  assert.deepEqual(realScene.innDoor?.position, { x: 207, y: 349, layer: 1 });
  assert.equal(realScene.innDoor?.slot, 3);
  const inn = realScene.placements.find(p => p.isInnDoor);
  assert.equal(inn.filename.toLowerCase(), "door.itm");
  assert.equal(inn.programPath, "BSTW/Prg/mwininn.prg");
  assert.ok(realScene.placements.filter(p => p.filename.toLowerCase() === "door.itm").length >= 2);
  assert.ok(realScene.placements
    .filter(p => p.filename.toLowerCase() === "door.itm" && p.slot !== 3)
    .every(p => !p.isInnDoor));
  console.log("Read-only BSTW production-JS placements:", realScene.placements.map(p =>
    [p.slot, p.filename, p.position, p.itemStatus, p.artStatus, p.isInnDoor]));
}

console.log("Placed sprites passed: ITM/ANM/TST and TBM first frames, source anchors, layer/Y order, no-art resilience and inn identification by resolved PRG.");
