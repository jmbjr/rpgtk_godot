import { tileBitmapSprite } from "./sprites.mjs";

// Native Toolkit 3.1 item setup selects MV_S (South) initially.
// Retain first-frame fallback alongside authored directional animation frames.
const valid = (asset, type) =>
  asset?.type === type && asset.decodeStatus === "decoded" && !asset.error;

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
          composed.width === animation.width && composed.height === animation.height &&
          composed.missing.length < composed.parts.length) {
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


export function resolveItemAnimations(item, artifacts, graph) {
  const result={};
  if(!valid(item,"itm") || item.version!==7)return result;
  for(const field of item.directionalAnimations ?? []) {
    const edge=(graph.outgoing.get(item.path) ?? []).find(e=>e.evidence===field.evidence && e.value===field.value);
    const animation=artifacts.get(edge?.to);
    if(edge?.status!=="Resolved" || !valid(animation,"anm"))continue;
    const frames=[];
    for(const [i,frame] of animation.frames.entries()) {
      if(!frame.image)continue;
      const ref=(graph.outgoing.get(animation.path) ?? []).find(e=>e.evidence==="Frame "+(i+1)+" image");
      const image=artifacts.get(ref?.to);
      if(ref?.status!=="Resolved")break;
      if(valid(image,"tst") && ref.tile>=1 && ref.tile<=image.count && animation.width===32 && animation.height===32)
        frames.push({kind:"tst",path:image.path,tile:ref.tile,width:32,height:32,transparentColor:frame.transparentColor});
      else if(valid(image,"tbm")) {
        const sprite=tileBitmapSprite(image,artifacts,graph);
        if(!sprite || sprite.missing.length || sprite.width!==animation.width || sprite.height!==animation.height)break;
        frames.push({kind:"tbm",path:image.path,width:sprite.width,height:sprite.height,transparentColor:frame.transparentColor});
      } else break;
    }
    if(frames.length===animation.frames.filter(f=>f.image).length && frames.length)
      result[field.direction.toLowerCase()]={path:animation.path,pauseMs:Math.max(10,animation.pauseSeconds*1000),frames};
  }
  return result;
}

export function mapBoardPlacements(board, artifacts, graph) {
  const edges = graph.outgoing.get(board.path) ?? [];
  return (board.sprites ?? []).filter(sprite => sprite.filename || sprite.activationProgram)
    .map(sprite => {
      const itemEdge = edges.find(e => e.evidence === "Native board sprite · slot " + sprite.slot);
      const item = artifacts.get(itemEdge?.to);
      const itemResolved = itemEdge?.status === "Resolved" && valid(item, "itm");
      const itemStatus = itemResolved ? "resolved" :
        itemEdge?.to ? "unsupported" : itemEdge?.status.toLowerCase() ?? "missing";
      let art = { status: "missing", reason: "ITM source unavailable" };
      if (itemResolved) {
        try {
          art = resolveInitialItemArtwork(item, artifacts, graph);
        } catch (error) {
          // A broken optional placed sprite never stops board/player play.
          art = { status: "unsupported", reason: "Artwork inspection failed: " + error.message };
        }
      }
      // Toolkit 3.1 CItem::open(): the board's prgActivate overrides the
      // ITM's itmPrgPickUp; an *empty* board field inherits the ITM value.
      // Never fall back merely because an explicit board PRG is missing.
      const boardProgram = sprite.activationProgram || "";
      const itemProgram = itemResolved ?
        (item.programs?.["Pickup program"] || "") : "";
      const effectiveProgram = boardProgram || itemProgram;
      const programSource = boardProgram ? "board" :
        itemProgram ? "item" : "unset";
      const scriptEdge = programSource === "board" ?
        edges.find(e =>
          e.evidence === "Native sprite activation program · slot " + sprite.slot) :
        programSource === "item" ?
          (graph.outgoing.get(item.path) ?? []).find(e =>
            e.evidence === "Pickup program" && e.value === itemProgram) : null;
      const program = artifacts.get(scriptEdge?.to);
      const programResolved = scriptEdge?.status === "Resolved" && valid(program, "prg");
      const { x, y, layer } = sprite.position ?? {};
      const positionValid = Number.isFinite(x) && Number.isFinite(y) &&
        Number.isInteger(layer) && layer >= 1 && layer <= board.layers;
      return {
        slot: sprite.slot, filename: sprite.filename, name: itemResolved ? item.name : sprite.filename,
        itemPath: itemResolved ? item.path : itemEdge?.to ?? null, itemStatus,
        ...(itemEdge?.candidates ? { itemCandidates: itemEdge.candidates } : {}),
        position: sprite.position, positionStatus: positionValid ? "valid" : "invalid",
        activationProgram: effectiveProgram, boardActivationProgram: boardProgram,
        programSource,
        programPath: programResolved ? program.path : scriptEdge?.to ?? null,
        programStatus: programResolved ? "resolved" :
          scriptEdge?.to ? "unsupported" : scriptEdge?.status.toLowerCase() ??
            (effectiveProgram ? "missing" : "unset"),
        ...(scriptEdge?.candidates ? { programCandidates: scriptEdge.candidates } : {}),
        activation: { type: sprite.activationType, condition: sprite.activate,
          initialVariable: sprite.initialVariable, initialValue: sprite.initialValue,
          finalVariable: sprite.finalVariable, finalValue: sprite.finalValue,
          loadingVariable: sprite.loadingVariable, loadingValue: sprite.loadingValue },
        artStatus: art.status, artReason: art.reason ?? "",
        artSource: art.source ?? null, animationPath: art.animationPath ?? null,
        artwork: art.artwork ?? null,
        walking: itemResolved ? resolveItemAnimations(item,artifacts,graph) : {},
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
