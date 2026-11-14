import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ACTOR_RADIUS, WALK_SPEED, MAX_FRAME_SECONDS,
  circleBlocked, initialMovementState, stepMovement, distanceToLandmark,
} from "../experiments/movement-sandbox/engine.mjs";
import { SANDBOX_WORLD, TILE_SIZE, tileAt, solidAt }
  from "../experiments/movement-sandbox/world.mjs";

const world = SANDBOX_WORLD;
assert.equal(TILE_SIZE, 32);
assert.deepEqual([world.width, world.height], [16, 11]);
assert.equal(world.rows.length, 11);
assert.ok(world.rows.every(row => row.length === 16));
assert.deepEqual([world.landmark.x, world.landmark.y], [432, 48]);
assert.deepEqual(world.spawn, { x: 80, y: 304 });
assert.equal(tileAt(world, -1, 5), "#");
assert.equal(tileAt(world, 16, 5), "#");
assert.equal(tileAt(world, 13, 1), "I");
assert.equal(solidAt(world, 13, 1), false);
assert.equal(solidAt(world, 0, 0), true);
assert.equal(circleBlocked(world, 80, 304), false);
assert.equal(circleBlocked(world, -10, 60), true);
assert.equal(circleBlocked(world, NaN, 60), true);
assert.equal(circleBlocked(world, 128, 272, ACTOR_RADIUS), true);

const start = initialMovementState();
assert.deepEqual(start, {
  x: 80, y: 304, facing: "south", moving: false,
  distance: 0, frame: 0, blocked: false,
});
const noInput = stepMovement(start, { x: 0, y: 0 }, 1);
assert.deepEqual(noInput, start);
assert.notStrictEqual(noInput, start, "Movement update returns a new immutable-like state");
assert.equal(stepMovement(start, { x: 1, y: 0 }, 0).distance, 0);
assert.equal(stepMovement(start, { x: 1, y: 0 }, NaN).moving, false);
assert.equal(stepMovement(start, { x: 0, y: 1 }, -1).distance, 0);
assert.ok(Math.abs(stepMovement(start, { x: 1, y: 0 }, 100).x - start.x -
  WALK_SPEED * MAX_FRAME_SECONDS) < 1e-7, "Clamp a stalled frame, never teleport");

for (const [input, facing, px, py] of [
  [{ x: 1, y: 0 }, "east", 1, 0],
  [{ x: -1, y: 0 }, "west", -1, 0],
  [{ x: 0, y: -1 }, "north", 0, -1],
  [{ x: 0, y: 1 }, "south", 0, 1],
]) {
  const moved = stepMovement(start, input, 1 / 60);
  assert.equal(moved.facing, facing, facing);
  assert.ok(moved.moving, facing + " should visibly move on this start tile");
  // The starting point has a solid boundary immediately south of it:
  // only the north/east/west motions are unrestricted.
  if (facing !== "south") {
    assert.ok(Math.abs((moved.x - start.x) - px * (WALK_SPEED / 60)) < 1e-8, facing + " x");
    assert.ok(Math.abs((moved.y - start.y) - py * (WALK_SPEED / 60)) < 1e-8, facing + " y");
  }
  assert.equal(circleBlocked(world, moved.x, moved.y), false);
}
let east = start;
for (let i = 0; i < 60; i++) east = stepMovement(east, { x: 1, y: 0 }, 1 / 60);
assert.ok(Math.abs(east.x - 192) < 1e-7);
assert.equal(east.y, start.y);
assert.equal(east.facing, "east");
assert.equal(east.frame, Math.floor((east.distance) / 12) % 2);
assert.equal(east.distance > 110, true);
assert.equal(start.x, 80, "The stepper never mutates its input state");

const diagonal = stepMovement(start, { x: 1, y: -1 }, 1 / 60);
assert.ok(Math.abs(diagonal.distance - WALK_SPEED / 60) < 1e-7,
  "Normalized diagonal speed must equal cardinal speed");
assert.equal(diagonal.facing, "north");
assert.ok(diagonal.x > start.x && diagonal.y < start.y);
assert.equal(circleBlocked(world, diagonal.x, diagonal.y), false);
const cancelled = stepMovement(start, { x: 0, y: 0 }, 1 / 60);
assert.equal(cancelled.moving, false);
assert.equal(cancelled.facing, "south", "Idle keeps the previous heading");

let wall = {
  ...start, x: 112, y: 272, facing: "east",
};
for (let i = 0; i < 120; i++) {
  wall = stepMovement(wall, { x: 1, y: 0 }, 1 / 60);
  assert.equal(circleBlocked(world, wall.x, wall.y), false);
}
assert.ok(wall.x <= 128 - ACTOR_RADIUS + 1e-8);
assert.equal(wall.blocked, true);
assert.ok(wall.x >= 117, "Move up to the collision boundary before stopping");
const slide = stepMovement(wall, { x: 1, y: -1 }, 1 / 30);
assert.ok(slide.y < wall.y, "Wall sliding preserves free vertical motion");
assert.equal(circleBlocked(world, slide.x, slide.y), false);

let south = start;
for (let i = 0; i < 60; i++) south = stepMovement(south, { x: 0, y: 1 }, 1 / 60);
assert.ok(south.y <= TILE_SIZE * 10 - ACTOR_RADIUS);
assert.equal(south.blocked, true);
assert.equal(circleBlocked(world, south.x, south.y), false);
assert.ok(distanceToLandmark(start) > 350);
assert.ok(distanceToLandmark({ ...start, ...world.landmark }) < 1e-8);
assert.deepEqual(initialMovementState(), start, "Reset always returns the source-owned spawn");

// Ensure a hypothetical malformed world cannot hide a solid spawn under a
// visually empty map or accidentally accept out-of-bounds movement.
assert.throws(() => initialMovementState({
  ...world, spawn: { x: 0, y: 0 },
}), /spawn/i);

// Static UI acceptance: discoverability, touch target semantics,
// collision overlay and explicit non-imported-game warning. Browser
// input/render behavior still requires manual/mobile acceptance.
const page = await readFile(new URL("../sandbox.html", import.meta.url), "utf8");
const home = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL(
  "../experiments/movement-sandbox/sandbox.mjs", import.meta.url), "utf8");
for (const direction of ["north", "south", "east", "west"]) {
  assert.match(page, new RegExp('data-move="' + direction + '"'));
}
assert.match(home, /href="\.\/sandbox\.html"/);
assert.match(page, /id="sandbox-canvas"/);
assert.match(page, /id="sandbox-reset"/);
assert.match(page, /id="sandbox-collision"/);
assert.match(page, /synthetic/i);
assert.match(script, /pointercancel/);
assert.match(script, /lostpointercapture/);
assert.match(script, /visibilitychange/);
assert.match(script, /KeyboardEvent|keydown/);
console.log("Movement sandbox passed: 16×11 source-owned map, four cardinal inputs, normalized diagonals, " +
  "swept solid collision, wall sliding, delta clamp, reset, and HTML/mobile control contract.");
