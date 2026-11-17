import { activateInn, nearInn } from "./inn-dialogue.mjs";

// Adapt only the unique, source-resolved mwininn.prg BRD placement to the
// existing scenario dialogue machine. Never interpret RPGCode or accept
// a generic door.itm based on its filename.
export function findAuthoredInn(scene, programPath = null) {
  if (!scene?.ok) return null;
  const candidates = scene.placements.filter(placement =>
    placement.programSource === "board" && placement.programStatus === "resolved" &&
    (programPath ? placement.programPath.toLowerCase() === programPath.toLowerCase() :
      /(?:^|\/)mwininn\.prg$/i.test(placement.programPath)));
  if (candidates.length !== 1) return null;
  const door = candidates[0];
  return door.positionStatus === "valid" ? door : null;
}

export function authoredInnWorld(scene) {
  const door = findAuthoredInn(scene);
  return door ? { landmark: { ...door.position } } : null;
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
