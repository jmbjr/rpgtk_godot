import { activateInn, nearInn } from "./inn-dialogue.mjs";

// Adapt only the unique, source-resolved mwininn.prg BRD placement to the
// existing scenario dialogue machine. Never interpret RPGCode or accept
// a generic door.itm based on its filename.
export function authoredInnWorld(scene) {
  const door = scene?.innDoor;
  const position = door?.position;
  if (!scene?.ok || scene.innStatus !== "resolved" ||
      !door?.programPath || !/\/mwininn\.prg$/i.test(door.programPath) ||
      !Number.isInteger(door.slot) ||
      ![position?.x, position?.y].every(Number.isFinite) ||
      !Number.isInteger(position?.layer) || position.layer < 1 ||
      position.layer > scene.board?.layers) return null;

  const matching = (scene.placements ?? []).filter(placement =>
    placement.isInnDoor && placement.programStatus === "resolved" &&
    placement.slot === door.slot &&
    placement.programPath === door.programPath &&
    placement.positionStatus === "valid" &&
    placement.position?.x === position.x &&
    placement.position?.y === position.y &&
    placement.position?.layer === position.layer);
  if (matching.length !== 1) return null;
  return {
    landmark: { x: position.x, y: position.y, layer: position.layer },
  };
}

// Same-layer gate is intentional: the original sandbox has no layers.
// The radius is the sandbox's existing inclusive 46px Euclidean policy,
// measured between the player origin and the stored item pixel origin.
export function nearAuthoredInn(actor, scene) {
  const world = authoredInnWorld(scene);
  return Boolean(world && actor?.layer === world.landmark.layer &&
    nearInn(actor, world));
}

export function activateAuthoredInn(state, actor, tickMs, scene) {
  const world = authoredInnWorld(scene);
  if (!world) return { state, outcome: "unavailable" };
  if (actor?.layer !== world.landmark.layer) {
    return { state, outcome: "out-of-range" };
  }
  return activateInn(state, actor, tickMs, world);
}
