import { mainFileBindings } from "./model.mjs";
import { mapBoardPlacements } from "./placed-sprites.mjs";
import { ACTOR_RADIUS, circleBlocked } from "./experiments/movement-sandbox/engine.mjs";
import { compileBoardVectorCollision } from "./vector-collision.mjs";

// Source-only scene mapping. Never runs the GAM startup program, RPGCode,
// native vector blocking, DLLs or plugins. UI consumers must check ok first.
const HEADINGS = ["South", "North", "East", "West"];
// Toolkit 3.1 allows 0-second ANM delays and renders them at its current
// frame cadence. The browser must avoid dividing by 0 when animating.
export const ZERO_DELAY_ANIMATION_SECONDS = 1 / 60;
const decoded = (asset, type) =>
  asset?.type === type && asset.decodeStatus === "decoded" && !asset.error;

export function buildPlayableScene(artifacts, graph, selectedMain = null, options = {}) {
  const issues = [];
  const fail = (code, detail) => issues.push({ code, detail });
  const mains = [...artifacts.values()].filter(a => decoded(a, "gam"));
  const main = selectedMain ?? (mains.length === 1 ? mains[0] : null);
  if (!decoded(main, "gam") || main.minor !== 9) {
    fail("unsupported-main", "A unique, decoded native GAM 2.9 Main File is required.");
    return { ok: false, issues };
  }

  const bindings = new Map(mainFileBindings(main, [...artifacts.keys()]));
  const linked = (label, type) => {
    const binding = bindings.get(label);
    const asset = artifacts.get(binding?.path);
    if (binding?.status !== "resolved" || !decoded(asset, type)) {
      fail("missing-" + type, label + ": " + (binding?.value || "(not set)") +
        " is missing, ambiguous, or unsupported.");
      return null;
    }
    return asset;
  };
  // The ordinary first launch uses GAM bindings exactly as before. Only a
  // validated Send() caller may override the active board and source-pixel
  // spawn; character/art resolver stays unchanged.
  const board = options.boardPath ?
    artifacts.get(options.boardPath) : linked("Opening board", "brd");
  if (options.boardPath && !decoded(board, "brd"))
    fail("missing-brd", "Destination board is missing or unsupported.");
  const character = linked("Initial character", "tem");
  if (!board || !character) return { ok: false, issues };

  if (!board.vectors || board.coordinateType !== 4 ||
      !Number.isInteger(board.width) || !Number.isInteger(board.height) ||
      board.width < 1 || board.height < 1 || board.width > 64 ||
      board.height > 64 || !Number.isInteger(board.layers) ||
      board.layers < 1 || board.layers > 8) {
    fail("unsupported-board", "Only native BRD 2.4 orthogonal pixel boards (code 4, up to 64×64×8) are playable.");
  }
  const start = options.start ?? board.start;
  if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y) ||
      !Number.isInteger(start.layer) || start.layer < 1 ||
      start.layer > board.layers || start.x < ACTOR_RADIUS ||
      start.y < ACTOR_RADIUS || start.x > board.width * 32 - ACTOR_RADIUS ||
      start.y > board.height * 32 - ACTOR_RADIUS) {
    fail("invalid-spawn", "The stored start position or layer is outside the playable map bounds.");
  }
  if (issues.length) return { ok: false, issues };

  const edges = graph.outgoing.get(board.path) ?? [];
  const boardIndex = new Map(edges.filter(e => Number.isInteger(e.index))
    .map(e => [e.index, e]));
  const tileFrom = (edge, label) => {
    let chosen = edge;
    if (artifacts.get(chosen?.to)?.type === "tan") {
      // The static viewer uses the first TAN frame for a still board tile.
      chosen = (graph.outgoing.get(chosen.to) ?? []).find(e => e.tile !== undefined);
    }
    const set = artifacts.get(chosen?.to);
    if (chosen?.status !== "Resolved" || !decoded(set, "tst") ||
        !set.bytes || !Number.isInteger(chosen.tile) ||
        chosen.tile < 1 || chosen.tile > set.count) {
      fail("unresolved-tile", label + " has no supported, decoded TST tile.");
      return null;
    }
    return { path: set.path, tile: chosen.tile };
  };

  const tiles = new Map();
  for (const run of board.runs ?? []) {
    if (!tiles.has(run.index)) {
      tiles.set(run.index, tileFrom(boardIndex.get(run.index),
        "Board lookup " + run.index + " (" + (board.lookup?.[run.index] ?? "") + ")"));
    }
  }
  const walks = {};
  for (const heading of HEADINGS) {
    const named = character.walkingAnimations?.find(item => item.direction === heading);
    const edge = (graph.outgoing.get(character.path) ?? [])
      .find(item => item.evidence === "Walk " + heading + " animation");
    const animation = artifacts.get(edge?.to);
    if (!named?.value || edge?.status !== "Resolved" || !decoded(animation, "anm") ||
        animation.width !== 32 || animation.height !== 32) {
      fail("unsupported-animation", heading + " has no decoded 32×32 ANM walking animation.");
      continue;
    }
    const imageEdges = new Map((graph.outgoing.get(animation.path) ?? [])
      .map(e => [e.evidence, e]));
    const frames = [];
    for (const [index, frame] of animation.frames.entries()) {
      if (!frame.image) continue; // Native ANM reserves many empty slots.
      const tile = tileFrom(imageEdges.get("Frame " + (index + 1) + " image"),
        heading + " frame " + (index + 1));
      if (tile) frames.push({ ...tile, transparentColor: frame.transparentColor });
    }
    if (!frames.length || !Number.isFinite(animation.pauseSeconds) ||
        animation.pauseSeconds < 0) {
      fail("unsupported-animation", heading +
        " has no playable frames or valid nonnegative animation pause.");
    }
    walks[heading.toLowerCase()] = {
      path: animation.path, frames,
      // Positive authored delays are exact. Native delay==0 means the next
      // frame can render immediately; use one 60-Hz display frame in the
      // browser to preserve valid source animation without infinite FPS.
      pauseSeconds: animation.pauseSeconds === 0 ?
        ZERO_DELAY_ANIMATION_SECONDS : animation.pauseSeconds,
      nativePauseSeconds: animation.pauseSeconds,
    };
  }
  if (issues.length) return { ok: false, issues };

  const placements = mapBoardPlacements(board, artifacts, graph);
  const innTargets = placements.filter(placement => placement.isInnDoor);
  const innDoor = innTargets.length === 1 ? {
    slot: innTargets[0].slot, position: { ...innTargets[0].position },
    itemPath: innTargets[0].itemPath, programPath: innTargets[0].programPath,
  } : null;

  let vectorCollision = compileBoardVectorCollision(board, start.layer);
  const world = {
    tileSize: 32, width: board.width, height: board.height,
    rows: Array.from({ length: board.height }, () => ".".repeat(board.width)),
    spawn: { x: start.x, y: start.y },
    vectorCollision,
  };
  // The browser's circle can overlap geometry that native Toolkit's
  // player base does not. Make a safe bounds-only fallback explicit.
  if (circleBlocked(world, start.x, start.y)) {
    vectorCollision = {
      ...vectorCollision, status: "bounds-only",
      reason: "Stored spawn overlaps a solid; bounds-only fallback.",
      skippedSolidSlots: vectorCollision.solids.map(vector => vector.slot),
      solids: [],
    };
    world.vectorCollision = vectorCollision;
  }

  return {
    ok: true, issues: [],
    mainPath: main.path, boardPath: board.path, characterPath: character.path,
    characterName: character.name, coordinateType: board.coordinateType,
    start: { x: start.x, y: start.y, layer: start.layer },
    board: {
      width: board.width, height: board.height, layers: board.layers,
      background: board.background, ambient: board.ambient ?? [0, 0, 0],
      // Preserve the decoded source run order and one-based board layer order.
      runs: board.runs.map(run => ({ ...run, tile: tiles.get(run.index) })),
    },
    walking: walks,
    placements, innDoor,
    innStatus: innTargets.length === 1 ? "resolved" :
      innTargets.length ? "ambiguous" : "missing",
    // Pure sandbox stepper sees only verified TT_SOLID geometry.
    world,
    collisionPolicy: vectorCollision.status + "; 9px circle; " + vectorCollision.reason,
  };
}
