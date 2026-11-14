import { tileBitmapSprite } from "./sprites.mjs";

// Native Toolkit 3.1 item setup selects MV_S (South) initially.
// Keep one authored first frame; no script, activation, or item movement.
const valid = (asset, type) =>
  asset?.type === type && asset.decodeStatus === "decoded" && !asset.error;
const basename = path => (path || "").replaceAll("\\", "/").split("/").at(-1).toLowerCase();

export function resolveInitialItemArtwork(item, artifacts, graph) {
  if (!valid(item, "itm")) return { status: "missing", reason: "ITM not decoded" };
  if (item.version !== 7) return { status: "unsupported", reason: "Not a native ITM 2.7 item" };
  const south = item.directionalAnimations?.find(a => a.direction === "South");
  const idle = item.standingAnimations?.find(a => a.direction === "South");
  const candidates = [south, item.restAnimation, idle].filter(a => a?.value);
  if (!candidates.length) return { status: "unset", reason: "No authored South, Rest or Idle animation" };

  const itemEdges = graph.outgoing.get(item.path) ?? [];
  const failures = [];
  for (const candidate of candidates) {
    const edge = itemEdges.find(e =>
      e.evidence === candidate.evidence && e.value === candidate.value);
    const animation = artifacts.get(edge?.to);
    if (edge?.status !== "Resolved" || !valid(animation, "anm")) {
      failures.push(candidate.evidence + ": ANM unavailable");
      continue;
    }
    const first = animation.frames?.findIndex(frame => frame.image) ?? -1;
    if (first < 0) {
      failures.push(candidate.evidence + ": no image frames");
      continue;
    }
    const frame = animation.frames[first];
    const ref = (graph.outgoing.get(animation.path) ?? [])
      .find(e => e.evidence === "Frame " + (first + 1) + " image");
    const image = artifacts.get(ref?.to);
    if (ref?.status !== "Resolved" || !image) {
      failures.push(candidate.evidence + ": first artwork file not resolved");
      continue;
    }
    if (valid(image, "tst") && image.bytes && Number.isInteger(ref.tile) &&
        ref.tile >= 1 && ref.tile <= image.count &&
        animation.width === 32 && animation.height === 32) {
      return {
        status: "resolved", source: candidate.evidence, animationPath: animation.path,
        artwork: { kind: "tst", path: image.path, tile: ref.tile, width: 32, height: 32,
          transparentColor: frame.transparentColor },
      };
    }
    if (valid(image, "tbm")) {
      const composed = tileBitmapSprite(image, artifacts, graph);
      if (composed && composed.parts.length &&
          composed.width === animation.width && composed.height === animation.height) {
        return {
          status: composed.missing.length ? "partial" : "resolved",
          source: candidate.evidence, animationPath: animation.path,
          reason: composed.missing.length ? composed.missing.length + " unresolved bitmap tiles" : "",
          artwork: { kind: "tbm", path: image.path,
            width: composed.width, height: composed.height,
            transparentColor: frame.transparentColor },
        };
      }
      failures.push(candidate.evidence + ": bitmap has missing or unsupported tiles/dimensions");
      continue;
    }
    failures.push(candidate.evidence + ": unsupported first frame type or dimensions");
  }
  return { status: "missing", reason: failures.join("; ") };
}

export function mapBoardPlacements(board, artifacts, graph) {
  const edges = graph.outgoing.get(board.path) ?? [];
  return (board.sprites ?? []).filter(sprite => sprite.filename || sprite.activationProgram)
    .map(sprite => {
      const itemEdge = edges.find(e => e.evidence === "Native board sprite · slot " + sprite.slot);
      const item = artifacts.get(itemEdge?.to);
      const itemResolved = itemEdge?.status === "Resolved" && valid(item, "itm");
      const itemStatus = itemResolved ? "resolved" :
        item?.type === "itm" && item.decodeStatus === "error" ? "unsupported" : "missing";
      const art = itemResolved ?
        resolveInitialItemArtwork(item, artifacts, graph) :
        { status: "missing", reason: "ITM source unavailable" };
      const scriptEdge = edges.find(e =>
        e.evidence === "Native sprite activation program · slot " + sprite.slot);
      const program = artifacts.get(scriptEdge?.to);
      const programResolved = scriptEdge?.status === "Resolved" && valid(program, "prg");
      // Only a resolved script edge with the exact named target identifies
      // the inn. A similarly named door ITM is not sufficient.
      const isInnDoor = programResolved &&
        basename(sprite.activationProgram) === "mwininn.prg" &&
        basename(program.path) === "mwininn.prg";
      const { x, y, layer } = sprite.position ?? {};
      const positionValid = Number.isFinite(x) && Number.isFinite(y) &&
        Number.isInteger(layer) && layer >= 1 && layer <= board.layers;
      return {
        slot: sprite.slot, filename: sprite.filename, name: itemResolved ? item.name : sprite.filename,
        itemPath: itemResolved ? item.path : itemEdge?.to ?? null, itemStatus,
        position: sprite.position, positionStatus: positionValid ? "valid" : "invalid",
        activationProgram: sprite.activationProgram ?? "",
        programPath: programResolved ? program.path : scriptEdge?.to ?? null,
        programStatus: programResolved ? "resolved" :
          sprite.activationProgram ? "missing" : "unset",
        isInnDoor, artStatus: art.status, artReason: art.reason ?? "",
        artSource: art.source ?? null, animationPath: art.animationPath ?? null,
        artwork: art.artwork ?? null,
      };
    });
}

// The native renderer z-orders overlapping sprite collision bases. We
// approximate the unresolved base-vector precedence by stored Y and X,
// and break ties deterministically with original slot order.
export function spriteDrawOrder(placements, actor, layer) {
  const entities = placements
    .filter(p => p.positionStatus === "valid" && p.position.layer === layer)
    .map(p => ({ kind: "item", x: p.position.x, y: p.position.y, slot: p.slot, placement: p }));
  if (actor && actor.layer === layer) {
    entities.push({ kind: "player", x: actor.x, y: actor.y, slot: -1 });
  }
  return entities.sort((a, b) => a.y - b.y || a.x - b.x ||
    (a.kind === b.kind ? a.slot - b.slot : a.kind === "item" ? -1 : 1));
}

// Pinned Toolkit 3 CSprite::render places a 2D animation at
// (round(position.x) - width/2, round(position.y) + 1 - height).
export function spritePixelOrigin(position, width, height) {
  return {
    x: Math.round(position.x) - Math.floor(width / 2),
    y: Math.round(position.y) + 1 - height,
  };
}
