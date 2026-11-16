import { resolveAsset } from "./model.mjs";
import { startTk3Script } from "./tk3-script-slice.mjs";

// Native Toolkit 3.1 BRD_PROGRAM: board program vector + PRG filename or
// inline RPGCode. Source: CSprite::programTest, board.h PRG_KEYPRESS/REPEAT.
// Only a source-authored unconditional closed-vector, single-entry trigger
// is interpreted. Unsupported activation policies never run speculatively.
export const PRG_KEYPRESS = 1;
export const PRG_REPEAT = 2;
export const PRG_STOPS_MOVEMENT = 4;
const pathFor = (board, slot) => board.path + "#board-program-" + slot;

const diagnostic = (path, line, message) => ({
  path, line, message, text: path + ":" + line + ": " + message,
});

export function mapTk3BoardPrograms(board, artifacts) {
  const root = board?.path?.match(/^(.*\/)Boards\/[^/]+\.brd$/i)?.[1] ?? null;
  return (board?.nativePrograms ?? []).filter(record => record?.filename)
    .map(record => {
      const raw = record.filename;
      const points = record.vectorBase?.points ?? [];
      const closed = Boolean(record.vectorBase?.closed);
      const flags = record.activationType;
      const keypress = Boolean(flags & PRG_KEYPRESS);
      const kind = keypress ? "keypress" : "step";
      const path = pathFor(board, record.slot);
      let status = "resolved", reason = "", source = raw, programPath = path;
      if (!Number.isInteger(flags) || flags < 0 ||
          flags & ~(PRG_KEYPRESS | PRG_STOPS_MOVEMENT)) {
        status = "unsupported";
        reason = "Repeat or unknown board activation flags are not implemented.";
      } else if (record.activate !== 0 || !closed || points.length < 3 ||
          points.length > 100 ||
          points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
        status = "unsupported";
        reason = "Conditional activation or open/invalid native program vector.";
      } else if (typeof raw !== "string" || raw.length > 12000) {
        status = "unsupported";
        reason = "Unusable native program source.";
      }
      // Toolkit first checks for an existing PRG file; if none exists,
      // it executes the BRD string as inline RPGCode (loadFromString).
      // Keep missing '*.prg' references diagnostic, not invented code.
      if (/^[^\\/:"*?<>|]+\.prg$/i.test(raw)) {
        const found = resolveAsset([...artifacts.keys()], "Prg", raw, root);
        if (found.status === "resolved") {
          programPath = found.path;
          const file = artifacts.get(found.path);
          if (file?.type === "prg" && file.decodeStatus === "decoded" &&
              Array.isArray(file.program?.rows)) {
            source = file.program.rows.map(row => row.line).join("\n");
          } else {
            status = "unsupported";
            reason = "Resolved PRG has no decoded source.";
          }
        } else {
          status = found.status;
          reason = "Source board program PRG " + raw + " is " + found.status + ".";
        }
      }
      const bounds = points.length ? {
        minX: Math.min(...points.map(p => p.x)),
        maxX: Math.max(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
        maxY: Math.max(...points.map(p => p.y)),
      } : null;
      return { slot: record.slot, layer: record.layer,
        kind, flags, programPath, source, raw, status, reason,
        activate: record.activate, points, closed, bounds };
    });
}

function onSegment(a, b, point) {
  const cross = (point.x - a.x) * (b.y - a.y) -
    (point.y - a.y) * (b.x - a.x);
  return Math.abs(cross) <= 1e-7 &&
    point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y);
}

export function insideTk3BoardProgram(program, actor) {
  if (!program?.closed || program.points.length < 3 ||
      !Number.isFinite(actor?.x) || !Number.isFinite(actor?.y) ||
      actor.layer !== program.layer) return false;
  const { x, y } = actor;
  if (program.bounds && (x < program.bounds.minX || x > program.bounds.maxX ||
      y < program.bounds.minY || y > program.bounds.maxY)) return false;
  // Browser policy: actor's foot point, not Toolkit's full authored collision
  // base polygon. Include the vector boundary to avoid missing thin doors.
  let inside = false;
  const points = program.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (onSegment(a, b, actor)) return true;
    if ((a.y > y) !== (b.y > y) &&
        x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export function selectTk3BoardStep(scene, before, after) {
  if (!scene?.ok) return null;
  return (scene.boardPrograms ?? []).find(program =>
    program.status === "resolved" && program.kind === "step" &&
    !insideTk3BoardProgram(program, before) &&
    insideTk3BoardProgram(program, after)) ?? null;
}

export function selectTk3BoardKey(scene, actor) {
  if (!scene?.ok) return null;
  return (scene.boardPrograms ?? []).find(program =>
    program.status === "resolved" && program.kind === "keypress" &&
    insideTk3BoardProgram(program, actor)) ?? null;
}

export function startTk3BoardProgram(state, program) {
  if (state?.execution) return { status: "busy", state };
  if (!program || program.status !== "resolved") {
    const path = program?.programPath ?? "(board program)";
    return { status: "error", state: { ...state, execution: null, message: "",
      diagnostic: diagnostic(path, 1, program?.reason || "Unresolved board program.") } };
  }
  return { ...startTk3Script(state, program.source, program.programPath),
    boardProgram: program };
}
