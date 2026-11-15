// Orthogonal native BRD 2.4 collision subset. Toolkit 3.1 source:
// vc/tkCommon/board/conversion.h: TT_SOLID=1, TT_UNDER=2.
// vc/trans3/movement/CSprite/CSprite.cpp::boardCollisions: the target
// sprite base is intersected with same-layer vectors; TT_UNDER is skipped.
// vc/trans3/movement/CVector/CVector.cpp::contains: open edges intersect,
// closed polygons also contain sprites fully inside.
// Browser approximation: a radius-9 circle rather than the native
// player-defined polygon; axis sliding remains in the existing stepper.
export const VECTOR_SOLID = 1;
export const VECTOR_UNDER = 2;
export const MAX_COLLISION_POINTS = 256;

const finitePoint = point =>
  Number.isFinite(point?.x) && Number.isFinite(point?.y);
const same = (a, b) => a.x === b.x && a.y === b.y;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) -
  (b.y - a.y) * (c.x - a.x);

function polygonArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function isSimple(points, closed) {
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (same(a, b)) return false;
    for (let j = i + 2; j < count; j++) {
      if (closed && i === 0 && j === count - 1) continue;
      const c = points[j], d = points[(j + 1) % points.length];
      const abC = cross(a, b, c), abD = cross(a, b, d);
      const cdA = cross(c, d, a), cdB = cross(c, d, b);
      // Reject proper intersections and collinear contact/touching.
      if (abC * abD < 0 && cdA * cdB < 0) return false;
      const between = (p, q, r) =>
        Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x) &&
        Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y);
      if ((abC === 0 && between(a, b, c)) ||
          (abD === 0 && between(a, b, d)) ||
          (cdA === 0 && between(c, d, a)) ||
          (cdB === 0 && between(c, d, b))) return false;
    }
  }
  return true;
}

export function compileBoardVectorCollision(board, layer) {
  const ignored = [];
  const unsupported = [];
  const solids = [];
  if (board?.coordinateType !== 4 ||
      !Number.isInteger(layer) || layer < 1 ||
      layer > board?.layers || !Array.isArray(board.vectors)) {
    return {
      status: "bounds-only", layer, solids, ignored, unsupported,
      reason: "No verified orthogonal pixel BRD 2.4 vector layout.",
    };
  }
  for (const [index, vector] of board.vectors.entries()) {
    const slot = Number.isInteger(vector?.slot) ? vector.slot : index;
    if (vector?.layer !== layer) {
      ignored.push({ slot, reason: "different layer" });
      continue;
    }
    if (vector.tileType === VECTOR_UNDER) {
      ignored.push({ slot, reason: "TT_UNDER is not blocking" });
      continue;
    }
    if (vector.tileType !== VECTOR_SOLID) {
      const known = [0, 4, 8, 16].includes(vector.tileType);
      (known ? ignored : unsupported).push({
        slot, reason: "non-solid or unsupported vector type " + vector.tileType,
      });
      continue;
    }
    const points = vector.points;
    if (!Array.isArray(points) || points.length < 2 ||
        points.length > MAX_COLLISION_POINTS || !points.every(finitePoint)) {
      unsupported.push({ slot, reason: "invalid/oversize solid vector points" });
      continue;
    }
    const closed = vector.closed !== 0;
    // Source close(true) adds the first vertex; normalize an already
    // repeated final vertex if an author stored it explicitly.
    const shape = closed && points.length > 2 && same(points[0], points.at(-1)) ?
      points.slice(0, -1) : points;
    if ((closed && (shape.length < 3 || Math.abs(polygonArea(shape)) < 0.000001)) ||
        !isSimple(shape, closed)) {
      unsupported.push({ slot, reason: "degenerate or intersecting solid geometry" });
      continue;
    }
    solids.push({
      slot, layer, closed, points: shape.map(point => ({ x: point.x, y: point.y })),
      minX: Math.min(...shape.map(p => p.x)),
      maxX: Math.max(...shape.map(p => p.x)),
      minY: Math.min(...shape.map(p => p.y)),
      maxY: Math.max(...shape.map(p => p.y)),
    });
  }
  return {
    status: solids.length ? (unsupported.length ? "partial" : "active") : "bounds-only",
    layer, solids, ignored, unsupported,
    reason: !solids.length ?
      (unsupported.length ? "No supported solids; unverified vectors ignored." :
        "No solid vectors on the starting layer.") :
      (unsupported.length ? "Only supported solid geometry blocks; other vectors are ignored." :
        "Same-layer TT_SOLID closed polygons and open segments."),
  };
}

function squaredDistanceToSegment(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const divisor = dx * dx + dy * dy;
  const t = divisor ? Math.max(0, Math.min(1,
    ((x - a.x) * dx + (y - a.y) * dy) / divisor)) : 0;
  const px = a.x + dx * t, py = a.y + dy * t;
  return (px - x) ** 2 + (py - y) ** 2;
}

function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) &&
        x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Returns whether a circle touches a supported solid vector on this
// world's actor layer. Tangential contacts mirror the stepper's
// original strict overlap (distance < radius) rather than adding
// arbitrary padding to authored coordinates.
export function circleBlockedByVectors(collision, x, y, radius) {
  if (!collision?.solids?.length) return false;
  for (const vector of collision.solids) {
    if (x + radius < vector.minX || x - radius > vector.maxX ||
        y + radius < vector.minY || y - radius > vector.maxY) continue;
    const points = vector.points;
    if (vector.closed && insidePolygon(points, x, y)) return true;
    const edges = vector.closed ? points.length : points.length - 1;
    for (let i = 0; i < edges; i++) {
      if (squaredDistanceToSegment(x, y, points[i],
        points[(i + 1) % points.length]) < radius * radius) return true;
    }
  }
  return false;
}
