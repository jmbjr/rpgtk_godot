import { SANDBOX_WORLD, solidAt } from "./world.mjs";

export const ACTOR_RADIUS = 9;
export const WALK_SPEED = 112; // Source-owned test policy, pixels per second.
export const MAX_FRAME_SECONDS = 0.05;
export const MAX_SUBSTEP_PIXELS = 4;

// Axis-aligned solid tiles, circle actor, outside-world is solid.
// This is *not* inferred Toolkit 3 vector collision behavior.
export function circleBlocked(world, x, y, radius = ACTOR_RADIUS) {
  if (![x, y, radius].every(Number.isFinite) || radius < 0) return true;
  const tile = world.tileSize;
  const minCol = Math.floor((x - radius) / tile);
  const maxCol = Math.floor((x + radius) / tile);
  const minRow = Math.floor((y - radius) / tile);
  const maxRow = Math.floor((y + radius) / tile);
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!solidAt(world, col, row)) continue;
      const nearestX = Math.max(col * tile, Math.min(x, (col + 1) * tile));
      const nearestY = Math.max(row * tile, Math.min(y, (row + 1) * tile));
      const dx = x - nearestX, dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

export function initialMovementState(world = SANDBOX_WORLD) {
  if (circleBlocked(world, world.spawn.x, world.spawn.y)) {
    throw Error("Movement sandbox spawn must not overlap a solid tile.");
  }
  return {
    x: world.spawn.x, y: world.spawn.y,
    facing: "south", moving: false,
    distance: 0, frame: 0, blocked: false,
  };
}

function axisInput(value) {
  return Number.isFinite(value) ? Math.sign(value) : 0;
}

// Deterministic pure update: input is {x, y} in {-1, 0, 1}, dt in
// seconds. Diagonals are normalized. Maximum 4 px swept substeps and
// independent axes enable sliding while preventing wall tunneling.
export function stepMovement(state, input, dt, world = SANDBOX_WORLD) {
  const x = axisInput(input?.x), y = axisInput(input?.y);
  const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(dt, MAX_FRAME_SECONDS)) : 0;
  if ((!x && !y) || !elapsed) {
    return { ...state, moving: false, blocked: false };
  }
  const length = Math.hypot(x, y);
  const vx = x / length, vy = y / length;
  const facing = Math.abs(y) >= Math.abs(x) && y ?
    (y > 0 ? "south" : "north") : x > 0 ? "east" : "west";
  const totalX = vx * WALK_SPEED * elapsed;
  const totalY = vy * WALK_SPEED * elapsed;
  const subdivisions = Math.max(1,
    Math.ceil(Math.hypot(totalX, totalY) / MAX_SUBSTEP_PIXELS));
  const incrementX = totalX / subdivisions;
  const incrementY = totalY / subdivisions;
  let nextX = state.x, nextY = state.y, blocked = false;
  for (let i = 0; i < subdivisions; i++) {
    if (!circleBlocked(world, nextX + incrementX, nextY)) nextX += incrementX;
    else if (incrementX) blocked = true;
    if (!circleBlocked(world, nextX, nextY + incrementY)) nextY += incrementY;
    else if (incrementY) blocked = true;
  }
  const traveled = Math.hypot(nextX - state.x, nextY - state.y);
  const distance = state.distance + traveled;
  return {
    x: nextX, y: nextY, facing,
    moving: traveled > 0.00001,
    distance, frame: Math.floor(distance / 12) % 2,
    blocked,
  };
}

export function distanceToLandmark(state, world = SANDBOX_WORLD) {
  return Math.hypot(state.x - world.landmark.x, state.y - world.landmark.y);
}
