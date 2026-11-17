import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { openGameArchive } from "../archive.mjs";
import { buildPlayableScene, ZERO_DELAY_ANIMATION_SECONDS } from "../playable-scene.mjs";
import { initialMovementState, circleBlocked, stepMovement, ACTOR_RADIUS }
  from "../experiments/movement-sandbox/engine.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { character28, nativeAnims, testTileset }
  from "../docs/specs/fixtures/native-character-28-fixtures.mjs";

const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
zip.file("BSTW/Prg/menuTitle.prg", "# synthetic only\n");
zip.file("BSTW/Boards/start.brd", board24Fixtures.standard);
zip.file("BSTW/Chrs/bruce.tem", character28);
zip.file("BSTW/Tiles/test-characters.tst", testTileset);
zip.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
for (const [name, bytes] of nativeAnims) zip.file("BSTW/Misc/" + name, bytes);

const { artifacts } = await readArtifacts(zip, {});
const graph = buildReferences(artifacts);
const scene = buildPlayableScene(artifacts, graph);
assert.equal(scene.ok, true, JSON.stringify(scene.issues));
assert.equal(scene.mainPath, "BSTW.gam");
assert.equal(scene.boardPath, "BSTW/Boards/start.brd");
assert.equal(scene.characterPath, "BSTW/Chrs/bruce.tem");
assert.equal(scene.board.width, 3);
assert.equal(scene.board.height, 2);
assert.equal(scene.board.layers, 2);
assert.deepEqual(scene.start, { x: 19, y: 27, layer: 1 });
assert.ok(scene.board.runs.length > 0);
assert.ok(scene.board.runs.every(run => run.tile?.path && run.tile.tile >= 1));
assert.ok(scene.board.runs.every(run => run.offset < 12 && run.length > 0));
assert.deepEqual(Object.keys(scene.walking), ["south", "north", "east", "west"]);
for (const direction of ["south", "north", "east", "west"]) {
  assert.equal(scene.walking[direction].frames.length, 2, direction);
  assert.ok(scene.walking[direction].pauseSeconds > 0);
  assert.ok(scene.walking[direction].frames.every(frame =>
    frame.path.endsWith(".tst") && frame.tile >= 1));
}
assert.deepEqual(scene.walking.south.frames.map(frame => frame.tile), [14, 15]);
assert.equal(scene.walking.south.nativePauseSeconds, 0.15);
assert.equal(ZERO_DELAY_ANIMATION_SECONDS, 1 / 60);

// Some genuine TK3.1 ANM 2.3 files store 0 seconds between walking
// frames. Exercise the actual binary archive -> native decoder -> source
// graph -> playable scene, not merely an injected scene object.
for (const direction of ["south", "north", "east", "west"]) {
  const filename = "test_" + direction + ".anm";
  const bytes = Buffer.from(nativeAnims.get(filename));
  bytes.writeDoubleLE(0, bytes.length - 8);
  zip.file("BSTW/Misc/" + filename, bytes);
}
const zeroRead = await readArtifacts(zip, {});
const zeroArtifacts = zeroRead.artifacts;
const zeroGraph = buildReferences(zeroArtifacts);
const zeroScene = buildPlayableScene(zeroArtifacts, zeroGraph);
assert.equal(zeroScene.ok, true, JSON.stringify(zeroScene.issues));
for (const direction of ["south", "north", "east", "west"]) {
  assert.equal(zeroScene.walking[direction].nativePauseSeconds, 0);
  assert.equal(zeroScene.walking[direction].pauseSeconds,
    ZERO_DELAY_ANIMATION_SECONDS);
  assert.deepEqual(zeroScene.walking[direction].frames,
    scene.walking[direction].frames,
    "Zero delay is a timing property; source artwork stays unchanged.");
}
const badDelay = new Map(zeroArtifacts);
badDelay.set("BSTW/Misc/test_north.anm", {
  ...zeroArtifacts.get("BSTW/Misc/test_north.anm"), pauseSeconds: -0.1,
});
assert.ok(buildPlayableScene(badDelay, zeroGraph).issues
  .some(issue => issue.code === "unsupported-animation"),
  "A negative delay is still invalid.");

assert.ok(scene.world.rows.every(row => row === "..."));
assert.match(scene.collisionPolicy, /bounds-only/);

const start = initialMovementState(scene.world);
assert.deepEqual([start.x, start.y], [19, 27]);
for (const [x, y, facing] of [[1, 0, "east"], [-1, 0, "west"],
  [0, 1, "south"], [0, -1, "north"]]) {
  const next = stepMovement(start, { x, y }, 1 / 60, scene.world);
  assert.equal(next.facing, facing);
  assert.ok(next.moving, facing + " must move within test bounds");
  assert.equal(circleBlocked(scene.world, next.x, next.y), false);
}
let edge = start;
for (let i = 0; i < 150; i++) edge = stepMovement(edge, { x: -1, y: 0 }, 1 / 60, scene.world);
assert.ok(edge.x >= ACTOR_RADIUS);
assert.equal(edge.blocked, true);
assert.equal(circleBlocked(scene.world, edge.x, edge.y), false);

const rejected = (assets, code) => {
  const result = buildPlayableScene(assets, graph);
  assert.equal(result.ok, false, "Expected unsupported/missing scene");
  assert.ok(result.issues.some(issue => issue.code === code),
    "Expected " + code + ", got " + JSON.stringify(result.issues));
};
const missingMain = new Map(artifacts);
missingMain.delete("BSTW.gam");
rejected(missingMain, "unsupported-main");
const missingBoard = new Map(artifacts);
missingBoard.delete(scene.boardPath);
rejected(missingBoard, "missing-brd");
const missingActor = new Map(artifacts);
missingActor.delete(scene.characterPath);
rejected(missingActor, "missing-tem");
const unsupportedBoard = new Map(artifacts);
unsupportedBoard.set(scene.boardPath, { ...artifacts.get(scene.boardPath), coordinateType: 2 });
rejected(unsupportedBoard, "unsupported-board");
const invalidSpawn = new Map(artifacts);
invalidSpawn.set(scene.boardPath, {
  ...artifacts.get(scene.boardPath), start: { x: -5, y: 10, layer: 99 },
});
rejected(invalidSpawn, "invalid-spawn");
const noTiles = new Map(artifacts);
noTiles.delete("BSTW/Tiles/two-tiles.tst");
rejected(noTiles, "unresolved-tile");
const noWalk = new Map(artifacts);
noWalk.delete("BSTW/Misc/test_south.anm");
rejected(noWalk, "unsupported-animation");
const wrongSize = new Map(artifacts);
wrongSize.set("BSTW/Misc/test_south.anm", {
  ...artifacts.get("BSTW/Misc/test_south.anm"), width: 64,
});
rejected(wrongSize, "unsupported-animation");
const noFrameset = new Map(artifacts);
noFrameset.delete("BSTW/Tiles/test-characters.tst");
rejected(noFrameset, "unresolved-tile");

const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
const browser = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
assert.match(page, /id="play-launch"/);
assert.match(page, /id="play-direct"/);
assert.match(page, /id="play-canvas"/);
assert.match(page, /id="play-close"/);
assert.match(page, /id="play-reset"/);
for (const direction of ["north", "south", "east", "west"])
  assert.match(page, new RegExp('data-move="' + direction + '"'));
assert.match(browser, /createTk3PlayContext/);
assert.match(browser, /mountAuthoredBoard/);
assert.match(browser, /playableScene\.ok/);

// Optional and local only: original game remains outside Git and CI.
// Verify SHA before treating the archive as the owner's source of truth.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  const sha = createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha, "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300",
    "Only the inspected original owner ZIP is accepted for this optional check");
  const realZip = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const real = (await readArtifacts(realZip, {})).artifacts;
  const realScene = buildPlayableScene(real, buildReferences(real));
  assert.equal(realScene.ok, true, JSON.stringify(realScene.issues));
  assert.deepEqual([realScene.boardPath, realScene.characterPath],
    ["BSTW/Boards/start.brd", "BSTW/Chrs/bruce.tem"]);
  assert.deepEqual([realScene.board.width, realScene.board.height, realScene.board.layers],
    [20, 15, 2]);
  assert.deepEqual(realScene.start, { x: 107, y: 78, layer: 1 });
  assert.deepEqual(realScene.walking.south.frames.map(f => [f.path, f.tile]),
    [["BSTW/Tiles/FLcharacters.tst", 14], ["BSTW/Tiles/FLcharacters.tst", 15]]);
  assert.ok(realScene.board.runs.every(run => run.tile && real.get(run.tile.path)?.bytes));
  for (const dir of ["south", "north", "east", "west"])
    assert.equal(realScene.walking[dir].frames.length, 2);
  const realStart = initialMovementState(realScene.world);
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.ok(stepMovement(realStart, { x, y }, 1 / 60, realScene.world).moving);
  }
  console.log("Original BSTW SHA-checked: source GAM → start.brd 20×15×2 → Bruce (107,78,L1) → 2 frames per direction; all four movement steps within bounds.");
}

console.log("Playable-scene synthetic check passed: GAM → authored BRD runs/layers → TEM/ANM/TST, four-way movement, bounds and unsupported/missing assets.");
