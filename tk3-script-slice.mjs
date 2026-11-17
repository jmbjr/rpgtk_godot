import { resolveAsset } from "./model.mjs";

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

export function compileTk3Interaction(source, path, { artifacts, projectRoot } = {}) {
  if (!path || typeof path !== "string" || typeof source !== "string")
    return { ok: false, diagnostic: issue(path || "(unresolved program)", 1,
      "Program source is unavailable.") };
  const methods = new Map();
  const activeFiles = new Set();
  const loadedFiles = new Set();
  const root = projectRoot ?? path.match(/^(.*\/)?Prg\/[^/]+$/i)?.[1] ?? "";

  function parseFile(source, path, included = false) {
    const lines = source.split(/\r\n?|\n/);
    if (lines.length > MAX_LINES)
      throw issue(path, MAX_LINES + 1, "Program exceeds the 300-line subset limit.");
    const rows = lines.map((raw, index) => ({
      line: index + 1, text: raw.trim().replace(/;$/, "")
        .replace(/^#(?=[A-Za-z_])/, ""),
    })).filter(row => row.text && !/^(?:\/\/|\*|\/\*)/.test(row.text));
    let offset = 0;
    const current = () => rows[offset];
    function fail(row, message) { throw issue(path, row?.line ?? lines.length, message); }

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
        const include = s.match(/^include\s*\(\s*"([^"]+)"\s*\)$/i);
        const method = s.match(/^method\s+([A-Za-z_]\w*)\s*\(\s*\)$/i);
        if (include && artifacts && nesting === 0) {
          const file = include[1];
          if (!/^[A-Za-z0-9_. -]+\.prg$/i.test(file) || file.includes(".."))
            fail(row, "An include must name one project PRG file.");
          const found = resolveAsset([...artifacts.keys()], "Prg", file, root);
          if (found.status !== "resolved") fail(row, "Included PRG " + file + " is " + found.status + ".");
          if (activeFiles.has(found.path)) fail(row, "Cyclic include: " + found.path + ".");
          if (!loadedFiles.has(found.path)) {
            if (loadedFiles.size >= 16 || activeFiles.size >= MAX_DEPTH)
              fail(row, "Include limit exceeded.");
            const asset = artifacts.get(found.path);
            if (asset?.type !== "prg" || asset.decodeStatus !== "decoded" ||
                asset.error || !Array.isArray(asset.program?.rows))
              fail(row, "Included PRG " + found.path + " has no decoded source.");
            loadedFiles.add(found.path);
            parseFile(asset.program.rows.map(r => r.line).join("\n"), found.path, true);
          }
          offset++;
          continue;
        }
        if (method && artifacts && nesting === 0) {
          const name = method[1].toLowerCase();
          if (methods.has(name)) fail(row, "Duplicate free method: " + method[1] + "().");
          if (rows[++offset]?.text !== "{") fail(current() || row, "Expected { after method declaration.");
          offset++;
          const body = parseBlock(nesting + 1, true);
          if (methods.has(name)) fail(row, "Duplicate free method: " + method[1] + "().");
          methods.set(name, body);
          continue;
        }
        if (included && nesting === 0)
          fail(row, "Included PRGs may declare free methods and includes only.");
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
          nodes.push({ op: "if", cond, thenBody, elseBody, path, line: row.line });
          continue;
        }
        if (/^if\b/i.test(s)) fail(row, "Unsupported if syntax; use if (value == value).");
        const message = s.match(/^mwin\s*\(\s*("[^"]*")\s*\)$/i);
        const wait = /^wait\s*\(\s*\)$/i.test(s);
        const clear = /^mwincls\s*\(\s*\)$/i.test(s);
        const send = s.match(/^send\s*\(\s*("[^"]*")\s*,\s*([^,()]+)\s*,\s*([^,()]+)\s*(?:,\s*([^,()]+)\s*)?\)$/i);
        const fight = s.match(/^fightEnemy\s*\(\s*("[^"]*")\s*,\s*("[^"]*")\s*\)$/i);
        const erase = s.match(/^eraseItem\s*\(\s*("[^"]*")\s*\)$/i);
        const assignment = s.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
        if (message) nodes.push({ op: "mwin", value: expression(message[1], path, row.line), line: row.line });
        else if (wait) nodes.push({ op: "wait", line: row.line });
        else if (clear) nodes.push({ op: "clear", line: row.line });
        else if (send) nodes.push({ op: "send",
          file: expression(send[1], path, row.line),
          x: expression(send[2], path, row.line),
          y: expression(send[3], path, row.line),
          layer: send[4] ? expression(send[4], path, row.line) :
            { kind: "number", value: 1 }, line: row.line });
        else if (fight) nodes.push({ op: "fight",
          enemy: expression(fight[1], path, row.line),
          background: expression(fight[2], path, row.line), line: row.line });
        else if (erase) nodes.push({ op: "erase",
          alias: expression(erase[1], path, row.line), line: row.line });
        else if (assignment) nodes.push({ op: "assign", name: assignment[1].toLowerCase(),
          value: expression(assignment[2], path, row.line), line: row.line });
        else if (artifacts && /^[A-Za-z_]\w*\s*\(\s*\)$/.test(s))
          nodes.push({ op: "call", name: s.slice(0, s.indexOf("(")).trim().toLowerCase(), line: row.line });
        else fail(row, "Unsupported RPGCode statement: " + s);
        nodes.at(-1).path = path;
        offset++;
      }
      if (closeRequired) fail(rows.at(-1), "Unclosed { block.");
      return nodes;
    }
    activeFiles.add(path);
    const nodes = parseBlock(0);
    activeFiles.delete(path);
    return nodes;
  }

  try {
    const nodes = parseFile(source, path);
    const instructions = [];
    const calls = new Set();
    let expanded = 0;
    function emit(sequence) {
      for (const node of sequence) {
        if (++expanded >= MAX_STEPS)
          throw issue(node.path, node.line, "Expanded program exceeds the instruction budget.");
        if (node.op === "call") {
          const body = methods.get(node.name);
          if (!body || calls.has(node.name) || calls.size >= MAX_DEPTH)
            throw issue(node.path, node.line, "Unsupported RPGCode statement: " +
              node.name + "() (missing, recursive, or too deeply nested free method).");
          calls.add(node.name);
          emit(body);
          calls.delete(node.name);
          continue;
        }
        if (node.op !== "if") { instructions.push(node); continue; }
        const test = instructions.length;
        instructions.push({ op: "if", cond: node.cond, path: node.path, line: node.line, jump: -1 });
        emit(node.thenBody);
        if (node.elseBody.length) {
          const jump = instructions.length;
          instructions.push({ op: "jump", jump: -1, path: node.path, line: node.line });
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
  let exec = { ...state.execution };
  const scriptStack = [...(state.scriptStack ?? [])];
  let message = state.message;
  for (let steps = 0; steps < MAX_STEPS; steps++) {
    if (exec.pc >= exec.instructions.length) {
      if (scriptStack.length) {
        exec = { ...scriptStack.pop() };
        continue;
      }
      return { status: "completed", state: { ...state, variables: vars,
        message, execution: null, scriptStack: [],
        runs: state.runs + 1, diagnostic: null } };
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
    else if (node.op === "send") {
      // The native Send() changes the active board synchronously but does
      // not call CProgram::end(). Yield a transfer request to the caller
      // and resume the same program counter on successful scene swap.
      return { status: "transfer", state: { ...state, variables: vars,
        message, execution: exec, scriptStack, diagnostic: null }, transfer: {
        path: node.path ?? exec.path, line: node.line, file: evaluate(node.file, vars),
        x: evaluate(node.x, vars), y: evaluate(node.y, vars),
        layer: evaluate(node.layer, vars),
      } };
    } else if (node.op === "fight") {
      const encounter = {
        path: node.path ?? exec.path, line: node.line,
        enemy: evaluate(node.enemy, vars),
        background: evaluate(node.background, vars),
      };
      return { status: "fight", encounter,
        state: { ...state, variables: vars, message,
          execution: exec, scriptStack,
          pendingFight: encounter, diagnostic: null } };
    } else if (node.op === "erase") {
      const effect = { kind: "erase-item", alias: evaluate(node.alias, vars),
        path: node.path ?? exec.path, line: node.line,
        sourceItemSlot: exec.sourceItemSlot ?? null,
        sourceBoardPath: exec.sourceBoardPath ?? null };
      return { status: "effect", effect,
        state: { ...state, variables: vars,
          message, execution: exec, scriptStack, diagnostic: null } };
    } else if (node.op === "wait") {
      exec.waiting = true;
      return { status: "waiting", state: { ...state, variables: vars,
        message, execution: exec, scriptStack, diagnostic: null }, line: node.line };
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

export function startTk3Script(state, source, path, context = {}) {
  if (state.execution || state.pendingFight) return { status: "busy", state };
  const compiled = compileTk3Interaction(source, path, context);
  if (!compiled.ok) return { status: "error", state: { ...state,
    message: "", diagnostic: compiled.diagnostic, execution: null } };
  return run({ ...state, message: "", diagnostic: null,
    execution: { path, instructions: compiled.instructions, pc: 0,
      waiting: false, sourceItemSlot: context.sourceItemSlot ?? null,
      sourceBoardPath: context.sourceBoardPath ?? null } });
}

// Resume after an approved outside effect, such as erasing the
// triggering item. Unlike Send(), no board remount is involved.
export function resumeTk3Effect(state) {
  if (!state.execution || state.execution.waiting || state.pendingFight)
    return { status: "inactive", state };
  return run(state);
}

// A battle outcome is explicit. Running its victory program is an
// external decision: the interpreter never guesses the native plugin result.
export function finishTk3Fight(state, victory = null) {
  if (!state.pendingFight || !state.execution)
    return { status: "inactive", state };
  if (victory?.path && Array.isArray(victory.instructions)) {
    const parent = state.execution;
    return run({ ...state, pendingFight: null,
      execution: { path: victory.path, instructions: victory.instructions,
        pc: 0, waiting: false, sourceItemSlot: parent.sourceItemSlot,
        sourceBoardPath: parent.sourceBoardPath },
      scriptStack: [...(state.scriptStack ?? []), parent],
      message: "", diagnostic: null });
  }
  return run({ ...state, pendingFight: null, diagnostic: null });
}

export function abandonTk3Fight(state) {
  if (!state.pendingFight) return { status: "inactive", state };
  return { status: "aborted", state: { ...state,
    execution: null, pendingFight: null, scriptStack: [],
    message: "", diagnostic: null } };
}

export function advanceTk3Script(state) {
  if (!state.execution?.waiting) return { status: "inactive", state };
  return run({ ...state, execution: { ...state.execution, waiting: false } });
}

// Resume only after the outer scene owner has validated and committed Send.
// The script continues at the statement *after* Send, on the new board.
export function resumeTk3Transfer(state) {
  if (!state.execution || state.execution.waiting) return { status: "inactive", state };
  return run(state);
}

// A failed destination is a script diagnostic, not an aborted board session.
// Keep all variables already assigned before Send, but discard the program
// counter so the actor can talk, move and retry from the current board.
export function rejectTk3Transfer(state, transfer, message) {
  const diagnostic = issue(transfer.path, transfer.line, message);
  return { status: "error", state: { ...state, execution: null, scriptStack: [],
    message: "", diagnostic } };
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
  return { ...startTk3Script(state, source, target.programPath,
    { artifacts, projectRoot: scene.projectRoot, sourceItemSlot: target.slot, sourceBoardPath: scene.boardPath }), target };
}
