// Bounded Toolkit 3 RPGCode subset: one statement per line, braces on
// separate lines, case-insensitive names, simple scalar expressions.
// This is a deliberately small interpreter, not a full RPGCode runtime.
// Source evidence: pinned trans3 lex.txt/yacc.txt, CProgram.cpp,
// functions.cpp (mwin/wait/mwincls), and CSprite::programTest.
export const TK3_INTERACTION_RADIUS = 46; // Browser policy, NOT native activation geometry.
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const QUOTED = /^"[^"]*"$/;
const MAX_LINES = 300;
const MAX_DEPTH = 8;
const MAX_STEPS = 1000;

const issue = (path, line, message) => ({
  path, line, message, text: path + ":" + line + ": " + message,
});

function expression(source, path, line) {
  const text = source.trim();
  // Exact Toolkit '+' supports numeric addition and string concatenation.
  const add = text.match(/^(.+?)\s+\+\s+(.+)$/);
  if (add) return { kind: "add", lhs: expression(add[1], path, line),
    rhs: expression(add[2], path, line) };
  if (NUMBER.test(text)) return { kind: "number", value: Number(text) };
  if (QUOTED.test(text)) return { kind: "string", value: text.slice(1, -1) };
  if (IDENT.test(text)) return { kind: "variable", name: text.toLowerCase() };
  throw issue(path, line, "Unsupported expression: " + source.trim());
}

export function compileTk3Interaction(source, path) {
  if (!path || typeof path !== "string" || typeof source !== "string")
    return { ok: false, diagnostic: issue(path || "(unresolved program)", 1,
      "Program source is unavailable.") };
  const lines = source.replace(/\r\n?|\n/g, "\n").split("\n");
  if (lines.length > MAX_LINES)
    return { ok: false, diagnostic: issue(path, MAX_LINES + 1,
      "Program exceeds the 300-line subset limit.") };
  const rows = lines.map((raw, index) => ({
    line: index + 1, text: raw.trim().replace(/^#(?=[A-Za-z_])/, ""),
  })).filter(row => row.text && !/^(?:\/\/|\*|\/\*)/.test(row.text));
  let offset = 0;
  const current = () => rows[offset];
  function fail(row, message) { throw issue(path, row?.line ?? lines.length,
    message); }

  function parseBlock(nesting, closeRequired = false) {
    if (nesting > MAX_DEPTH) fail(current(), "Too many nested blocks.");
    const nodes = [];
    while (offset < rows.length) {
      const row = current();
      const s = row.text;
      if (s === "}") {
        if (!closeRequired) fail(row, "Unexpected closing brace.");
        offset++;
        return nodes;
      }
      if (/^else\b/i.test(s) || s === "{") fail(row,
        "Unexpected block token: " + s);
      const conditional = s.match(/^if\s*\(\s*(.+?)\s*==\s*(.+?)\s*\)$/i);
      if (conditional) {
        const cond = { lhs: expression(conditional[1], path, row.line),
          rhs: expression(conditional[2], path, row.line) };
        offset++;
        const opening = current();
        if (opening?.text !== "{") fail(opening || row,
          "Expected { on the line after if(...).");
        offset++;
        const thenBody = parseBlock(nesting + 1, true);
        let elseBody = [];
        if (/^else$/i.test(current()?.text || "")) {
          const otherwise = current();
          offset++;
          if (current()?.text !== "{") fail(current() || otherwise,
            "Expected { on the line after else.");
          offset++;
          elseBody = parseBlock(nesting + 1, true);
        }
        nodes.push({ op: "if", cond, thenBody, elseBody, line: row.line });
        continue;
      }
      if (/^if\b/i.test(s)) fail(row, "Unsupported if syntax; use if (value == value).");
      const message = s.match(/^mwin\s*\(\s*("[^"]*")\s*\)$/i);
      const wait = /^wait\s*\(\s*\)$/i.test(s);
      const clear = /^mwincls\s*\(\s*\)$/i.test(s);
      const assignment = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (message) nodes.push({ op: "mwin", value: expression(message[1], path, row.line), line: row.line });
      else if (wait) nodes.push({ op: "wait", line: row.line });
      else if (clear) nodes.push({ op: "clear", line: row.line });
      else if (assignment) nodes.push({ op: "assign", name: assignment[1].toLowerCase(),
        value: expression(assignment[2], path, row.line), line: row.line });
      else fail(row, "Unsupported RPGCode statement: " + s);
      offset++;
    }
    if (closeRequired) fail(rows.at(-1), "Unclosed { block.");
    return nodes;
  }
  try {
    const nodes = parseBlock(0);
    const instructions = [];
    function emit(sequence) {
      for (const node of sequence) {
        if (node.op !== "if") { instructions.push(node); continue; }
        const test = instructions.length;
        instructions.push({ op: "if", cond: node.cond, line: node.line, jump: -1 });
        emit(node.thenBody);
        if (node.elseBody.length) {
          const jump = instructions.length;
          instructions.push({ op: "jump", jump: -1, line: node.line });
          instructions[test].jump = instructions.length;
          emit(node.elseBody);
          instructions[jump].jump = instructions.length;
        } else instructions[test].jump = instructions.length;
      }
    }
    emit(nodes);
    return { ok: true, path, instructions };
  } catch (error) {
    return { ok: false, diagnostic: error?.path && error?.line ?
      error : issue(path, 1, error?.message || String(error)) };
  }
}

export function initialTk3ScriptState() {
  return { variables: {}, execution: null, message: "", diagnostic: null, runs: 0 };
}

function evaluate(node, vars) {
  if (node.kind === "number" || node.kind === "string") return node.value;
  if (node.kind === "variable") return Object.hasOwn(vars, node.name) ? vars[node.name] : 0;
  if (node.kind === "add") {
    const left = evaluate(node.lhs, vars), right = evaluate(node.rhs, vars);
    return typeof left === "number" && typeof right === "number" ?
      left + right : String(left) + String(right);
  }
  throw Error("Unsupported compiled expression.");
}

function run(state) {
  const vars = { ...state.variables };
  const exec = { ...state.execution };
  let message = state.message;
  for (let steps = 0; steps < MAX_STEPS; steps++) {
    if (exec.pc >= exec.instructions.length) {
      return { status: "completed", state: { ...state, variables: vars,
        message, execution: null, runs: state.runs + 1, diagnostic: null } };
    }
    const node = exec.instructions[exec.pc++];
    if (node.op === "assign") vars[node.name] = evaluate(node.value, vars);
    else if (node.op === "mwin") {
      const line = String(evaluate(node.value, vars));
      message = message ? message + "\n" + line : line;
    } else if (node.op === "clear") message = "";
    else if (node.op === "if") {
      const a = evaluate(node.cond.lhs, vars), b = evaluate(node.cond.rhs, vars);
      if (!(typeof a === "number" && typeof b === "number" ?
        a === b : String(a) === String(b))) exec.pc = node.jump;
    } else if (node.op === "jump") exec.pc = node.jump;
    else if (node.op === "wait") {
      exec.waiting = true;
      return { status: "waiting", state: { ...state, variables: vars,
        message, execution: exec, diagnostic: null }, line: node.line };
    } else {
      return { status: "error", state: { ...state, variables: vars,
        message, execution: null, diagnostic: issue(exec.path, node.line,
          "Unknown compiled instruction.") } };
    }
  }
  const diagnostic = issue(exec.path, exec.instructions[Math.min(exec.pc,
    exec.instructions.length - 1)]?.line ?? 1, "Instruction budget exceeded.");
  return { status: "error", state: { ...state, variables: vars,
    message, execution: null, diagnostic } };
}

export function startTk3Script(state, source, path) {
  if (state.execution) return { status: "busy", state };
  const compiled = compileTk3Interaction(source, path);
  if (!compiled.ok) return { status: "error", state: { ...state,
    message: "", diagnostic: compiled.diagnostic, execution: null } };
  return run({ ...state, message: "", diagnostic: null,
    execution: { path, instructions: compiled.instructions, pc: 0, waiting: false } });
}

export function advanceTk3Script(state) {
  if (!state.execution?.waiting) return { status: "inactive", state };
  return run({ ...state, execution: { ...state.execution, waiting: false } });
}

// Find the nearest source-resolved, on-layer board item with a PRG.
// No game-specific or script-name exclusions belong in this generic selector.
// The browser may route individual placements to an established adapter
// before invoking the subset interpreter; this selector does not decide it.
export function selectTk3ScriptTarget(scene, actor, radius = TK3_INTERACTION_RADIUS) {
  if (!scene?.ok || !Number.isFinite(actor?.x) || !Number.isFinite(actor?.y) ||
      !Number.isInteger(actor.layer)) return null;
  return (scene.placements ?? [])
    .filter(p => p.positionStatus === "valid" &&
      p.itemStatus === "resolved" && p.programStatus === "resolved" &&
      p.programPath && /\.prg$/i.test(p.programPath) &&
      p.position?.layer === actor.layer)
    .map(p => ({ placement: p,
      distance: Math.hypot(p.position.x - actor.x, p.position.y - actor.y) }))
    .filter(p => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.placement.slot - b.placement.slot)[0]?.placement ?? null;
}

export function startPlacedTk3Script(state, scene, actor, artifacts) {
  const target = selectTk3ScriptTarget(scene, actor);
  if (!target) return { status: "out-of-range", state };
  const program = artifacts.get(target.programPath);
  if (program?.type !== "prg" || program.decodeStatus !== "decoded" ||
      !program.program?.rows) {
    const diagnostic = issue(target.programPath, 1, "Resolved activation program has no decoded source.");
    return { status: "error", target, state: { ...state, diagnostic, execution: null, message: "" } };
  }
  const source = program.program.rows.map(row => row.line).join("\n");
  return { ...startTk3Script(state, source, target.programPath), target };
}
