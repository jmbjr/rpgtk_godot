import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import {
  VECTOR_SOLID, VECTOR_UNDER, MAX_COLLISION_POINTS,
  compileBoardVectorCollision, circleBlockedByVectors,
} from "../vector-collision.mjs";
import {
  WALK_SPEED, MAX_FRAME_SECONDS, ACTOR_RADIUS,
  initialMovementState, circleBlocked, stepMovement,
} from "../experiments/movement-sandbox/engine.mjs";
import { nearAuthoredInn, activateAuthoredInn }
  from "../experiments/movement-sandbox/imported-inn.mjs";
import { initialInnState, advanceInn }
  from "../experiments/movement-sandbox/inn-dialogue.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";

assert.deepEqual([VECTOR_SOLID, VECTOR_UNDER, ACTOR_RADIUS], [1, 2, 9]);
assert.ok(MAX_COLLISION_POINTS >= 31);
const rectangle = (left, top, right, bottom) => [
  { x: left, y: top }, { x: right, y: top },
  { x: right, y: bottom }, { x: left, y: bottom },
];
const source = {
  coordinateType: 4, width: 8, height: 6, layers: 2,
  vectors: [
    { slot: 0, tileType: 1, layer: 1, closed: -1, attributes: 12,
      points: rectangle(40, 40, 80, 80) },
    { slot: 1, tileType: 2, layer: 1, closed: -1,
      points: rectangle(10, 10, 38, 38) },
    { slot: 2, tileType: 1, layer: 2, closed: -1,
      points: rectangle(160, 80, 200, 120) },
    { slot: 3, tileType: 1, layer: 1, closed: 0,
      points: [{ x: 120, y: 30 }, { x: 120, y: 90 }] },
    { slot: 4, tileType: 3, layer: 1, closed: -1,
      points: rectangle(140, 10, 180, 40) },
    { slot: 5, tileType: 1, layer: 1, closed: -1,
      points: [{ x: 210, y: 80 }, { x: 250, y: 120 },
        { x: 210, y: 120 }, { x: 250, y: 80 }] },
    { slot: 6, tileType: 4, layer: 1, closed: 0,
      points: [{ x: 50, y: 90 }, { x: 90, y: 90 }] },
  ],
};
const collision = compileBoardVectorCollision(source, 1);
assert.equal(collision.status, "partial");
assert.deepEqual(collision.solids.map(v => v.slot), [0, 3]);
assert.deepEqual(collision.ignored.map(v => v.slot), [1, 2, 6]);
assert.deepEqual(collision.unsupported.map(v => v.slot), [4, 5]);
assert.equal(collision.solids[0].closed, true);
assert.equal(collision.solids[1].closed, false);
assert.equal(circleBlockedByVectors(collision, 60, 60, 9), true,
  "A closed solid polygon blocks its own interior");
assert.equal(circleBlockedByVectors(collision, 31, 60, 9), false,
  "Tangential contact is permitted");
assert.equal(circleBlockedByVectors(collision, 32, 60, 9), true,
  "Radius 9 overlaps polygon from outside");
assert.equal(circleBlockedByVectors(collision, 110, 60, 9), false);
assert.equal(circleBlockedByVectors(collision, 112, 60, 9), true,
  "Open solid polyline has no interior but obstructs crossings");
assert.equal(circleBlockedByVectors(collision, 20, 20, 9), false,
  "Under vector does not block");
assert.equal(circleBlockedByVectors(collision, 168, 99, 9), false,
  "Other-layer solid does not block");
assert.equal(circleBlockedByVectors(collision, 150, 20, 9), false,
  "Ambiguous mixed tile type cannot create an invented solid");

const higher = compileBoardVectorCollision(source, 2);
assert.deepEqual(higher.solids.map(v => v.slot), [2]);
assert.equal(circleBlockedByVectors(higher, 168, 99, 9), true);
assert.equal(circleBlockedByVectors(higher, 60, 60, 9), false);
const unsupportedCoordinates = compileBoardVectorCollision({
  ...source, coordinateType: 6,
}, 1);
assert.equal(unsupportedCoordinates.status, "bounds-only");
assert.equal(unsupportedCoordinates.solids.length, 0);
assert.match(unsupportedCoordinates.reason, /orthogonal/);
assert.equal(compileBoardVectorCollision({ ...source, vectors: [] }, 1).status,
  "bounds-only");

const world = {
  tileSize: 32, width: 8, height: 6, spawn: { x: 20, y: 60 },
  rows: Array.from({ length: 6 }, () => ".".repeat(8)),
  vectorCollision: collision,
};
assert.deepEqual([initialMovementState(world).x, initialMovementState(world).y], [20, 60]);
assert.throws(() => initialMovementState({ ...world, spawn: { x: 60, y: 60 } }),
  /solid tile/, "Imported source spawn inside a solid must be detected");
let east = initialMovementState(world);
for (let i = 0; i < 120; i++) east = stepMovement(east, { x: 1, y: 0 }, 1 / 60, world);
assert.equal(east.blocked, true);
assert.ok(east.x <= 31.001 && east.x >= 28, "No tunneling into the solid polygon");
assert.equal(circleBlocked(world, east.x, east.y), false);
const largeDt = stepMovement(initialMovementState(world), { x: 1, y: 0 }, 5, world);
const cappedDt = stepMovement(initialMovementState(world), { x: 1, y: 0 },
  MAX_FRAME_SECONDS, world);
assert.deepEqual(largeDt, cappedDt, "Large frame deltas remain capped at 50ms");
assert.ok(largeDt.x - 20 <= WALK_SPEED * MAX_FRAME_SECONDS + 0.001);
const slideWorld = { ...world, spawn: { x: 30, y: 60 } };
let sliding = initialMovementState(slideWorld);
sliding = stepMovement(sliding, { x: 1, y: -1 }, 0.05, slideWorld);
assert.ok(sliding.y < 60 && sliding.x <= 31.001,
  "Independent axes preserve movement along a blocked wall");
assert.equal(circleBlocked(slideWorld, sliding.x, sliding.y), false);
const boundsOnly = { ...world, vectorCollision: unsupportedCoordinates };
assert.equal(circleBlocked(boundsOnly, 60, 60), false,
  "Fallback leaves source geometry nonblocking but still enforces map bounds");
assert.equal(circleBlocked(boundsOnly, 0, 60), true);

// All nine original board vectors in the source sample have known
// semantics. Synthetic malformed geometry must be isolated, not crash
// the viewer or accidentally make non-solid vectors solid.
const boardZip = new JSZip();
boardZip.file("BSTW/Boards/standard.brd", board24Fixtures.standard);
const board = (await readArtifacts(boardZip, {})).artifacts.get("BSTW/Boards/standard.brd");
assert.equal(board.decodeStatus, "decoded", board.error);
const native = compileBoardVectorCollision(board, 1);
assert.equal(native.status, "active");
assert.deepEqual(native.solids.map(v => v.slot), [0]);
assert.equal(compileBoardVectorCollision(board, 2).status, "bounds-only",
  "The synthetic type-2 open vector is TT_UNDER, not a wall");
const malformed = compileBoardVectorCollision({
  ...board, vectors: [{ slot: 9, layer: 1, tileType: 1, closed: -1,
    points: [{ x: 10, y: 10 }, { x: 10, y: 10 }] }],
}, 1);
assert.equal(malformed.status, "bounds-only");
assert.equal(malformed.unsupported.length, 1);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const runtime = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
const movement = await readFile(new URL("../experiments/movement-sandbox/engine.mjs", import.meta.url), "utf8");
const mapper = await readFile(new URL("../playable-scene.mjs", import.meta.url), "utf8");
assert.match(html, /id="play-collision"/);
assert.match(html, /id="play-vector-overlay"/);
assert.match(runtime, /vectorOverlay\.addEventListener\("change", draw/);
assert.match(runtime, /collision\?\.solids/);
assert.match(movement, /circleBlockedByVectors/);
assert.match(mapper, /compileBoardVectorCollision/);

// Optional production-JS archive test, never included in Git or CI.
// Verify the exact owner's ZIP before interpreting its decoded BRD.
// The BFS uses the production browser circleBlocked function and
// stepMovement rather than an invented passage through the solid.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const zip = await openGameArchive(bytes, payload => JSZip.loadAsync(payload));
  const artifacts = (await readArtifacts(zip, {})).artifacts;
  const scene = buildPlayableScene(artifacts, buildReferences(artifacts));
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  assert.deepEqual(scene.start, { x: 107, y: 78, layer: 1 });
  assert.deepEqual(scene.innDoor?.position, { x: 207, y: 349, layer: 1 });
  assert.equal(scene.innDoor?.slot, 3);
  assert.equal(scene.world.vectorCollision.status, "active");
  assert.deepEqual(scene.world.vectorCollision.solids.map(v => v.slot),
    [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(scene.world.vectorCollision.ignored.map(v => v.slot), [0, 1, 2]);
  assert.equal(scene.world.vectorCollision.unsupported.length, 0);
  assert.equal(circleBlocked(scene.world, scene.start.x, scene.start.y), false);
  assert.equal(circleBlocked(scene.world, 207, 300), true,
    "Solid inn-building interior is blocked");
  assert.equal(circleBlocked(scene.world, 207, 370), false,
    "The accessible south side of the inn is walkable");
  assert.equal(nearAuthoredInn({ x: 207, y: 370, layer: 1 }, scene), true);

  // Search only the world grid, not original assets. An 8px scan
  // yields a conservative route with 9px radius clearance.
  const size = 8;
  const world = scene.world;
  const spawn = world.spawn;
  const key = point => point.join(",");
  const xy = cell => ({ x: spawn.x + size * cell[0], y: spawn.y + size * cell[1] });
  const start = [0, 0];
  const cells = new Map([[key(start), null]]);
  const queue = [start];
  let goal = null;
  for (let head = 0; head < queue.length && goal === null; head++) {
    const cell = queue[head];
    const at = xy(cell);
    if (nearAuthoredInn({ ...at, layer: scene.start.layer }, scene)) {
      goal = cell;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [cell[0] + dx, cell[1] + dy];
      const id = key(next);
      if (cells.has(id)) continue;
      const location = xy(next);
      if (location.x < ACTOR_RADIUS || location.y < ACTOR_RADIUS ||
          location.x > world.width * 32 - ACTOR_RADIUS ||
          location.y > world.height * 32 - ACTOR_RADIUS ||
          circleBlocked(world, location.x, location.y)) continue;
      cells.set(id, cell);
      queue.push(next);
    }
  }
  assert.ok(goal, "Must be able to reach the authored inn from Bruce's spawn");
  const route = [];
  for (let cell = goal; cell; cell = cells.get(key(cell))) route.unshift(cell);
  let actor = initialMovementState(world);
  for (const [index, cell] of route.entries()) {
    if (!index) continue;
    const before = xy(route[index - 1]), after = xy(cell);
    const direction = { x: Math.sign(after.x - before.x), y: Math.sign(after.y - before.y) };
    for (let step = 0; step < 2; step++) {
      const result = stepMovement(actor, direction, (size / 2) / WALK_SPEED, world);
      assert.ok(result.moving, "Expected move to remain unblocked along BFS path");
      actor = result;
    }
    assert.ok(Math.hypot(actor.x - after.x, actor.y - after.y) < 0.02);
  }
  assert.equal(nearAuthoredInn({ ...actor, layer: scene.start.layer }, scene), true);
  let inn = activateAuthoredInn(initialInnState(),
    { ...actor, layer: scene.start.layer }, 0, scene);
  assert.equal(inn.outcome, "opened");
  for (let i = 0; i < 4; i++) {
    inn = advanceInn(inn.state, i + 1);
  }
  assert.equal(inn.outcome, "completed");
  assert.equal(inn.state.clues, 1);
  console.log("Original BSTW production JS: 9 vectors → 6 solid L1 and 3 under L2, spawn clear, verified wall blocking, " +
    route.length + " valid 8px grid stops to the reachable inn, first dialogue earns 1 clue.");
}
console.log("Vector collision passed: native TT_SOLID/TT_UNDER, open/closed, layer and geometry gates, swept bounds, sliding and fallback.");
