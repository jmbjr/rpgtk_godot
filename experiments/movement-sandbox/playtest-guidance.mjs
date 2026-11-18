// UI-free, source-derived presentation of a playable board for testing.
// These markers are overlays: they never replace or mutate authored artwork,
// collision geometry, placements or activation rules.
export const PLAYTEST_TALK_RADIUS = 46;

const boundedPercent = (value, extent) =>
  Math.max(0, Math.min(100, value / extent * 100));

function annotation(position, width, height) {
  return {
    xPct: boundedPercent(position.x, width),
    yPct: boundedPercent(position.y, height),
    labelLeft: position.x > width * 0.5,
    labelAbove: position.y > height * 0.55,
  };
}

const formatDirection = (dx, dy) => {
  const directions = [];
  if (Math.abs(dx) > 3) directions.push(dx > 0 ? "right" : "left");
  if (Math.abs(dy) > 3) directions.push(dy > 0 ? "down" : "up");
  return directions.join(" and ");
};

// Geometry is in original source pixels; labels are HTML/CSS at readable
// screen-pixel sizes, regardless of canvas scaling on desktop or Android.
export function describePlayableTargets(scene, actor) {
  const width = scene?.board?.width * 32;
  const height = scene?.board?.height * 32;
  if (!scene?.ok || !Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 ||
      !Number.isFinite(actor?.x) || !Number.isFinite(actor?.y) ||
      !Number.isInteger(actor?.layer)) {
    return { player: null, targets: [], hint: "No playable source board is selected." };
  }
  const player = {
    ...annotation(actor, width, height),
    label: String(scene.characterName || "Player") + " · YOU",
  };
  const targets = (scene.placements ?? [])
    .filter(p => p.itemStatus === "resolved" &&
      p.programStatus === "resolved" && p.positionStatus === "valid" &&
      p.position?.layer === actor.layer &&
      [p.position.x, p.position.y].every(Number.isFinite) &&
      p.position.x >= 0 && p.position.x <= width &&
      p.position.y >= 0 && p.position.y <= height)
    .map(p => {
      const dx = p.position.x - actor.x, dy = p.position.y - actor.y;
      const distance = Math.hypot(dx, dy);
      return {
        slot: p.slot,
        label: String(p.name || p.filename || "Object"),
        ...annotation(p.position, width, height),
        distance, inRange: distance <= PLAYTEST_TALK_RADIUS,
        dx, dy,
      };
    })
    .sort((a, b) => a.distance - b.distance || a.slot - b.slot);
  const nearest = targets[0] ?? null;
  let hint = "No resolved Talk objects on this layer.";
  if (nearest) {
    hint = nearest.inRange ?
      "Within Talk range of " + nearest.label +
        " (" + Math.round(nearest.distance) + " px away). Use Talk." :
      "Find " + nearest.label + ": " + Math.round(nearest.distance) +
        " px away. Move " + (formatDirection(nearest.dx, nearest.dy) ||
        "closer") + " until Talk activates.";
  }
  return { player, targets, hint, nearest };
}
