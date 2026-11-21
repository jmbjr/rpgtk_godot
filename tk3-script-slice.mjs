import {
  compileTk3Language,
  languageLimits,
  scriptIssue as issue,
} from "./tk3-language.mjs";
export { languageLimits } from "./tk3-language.mjs";
export const TK3_INTERACTION_RADIUS = 46; // Browser policy, NOT native activation geometry.
export const compileTk3Interaction = compileTk3Language;

export function initialTk3ScriptState() {
  return {
    variables: {},
    execution: null,
    message: "",
    diagnostic: null,
    runs: 0,
  };
}
const numeric = (value) =>
  typeof value === "number" ? value : parseFloat(value) || 0;
const literal = (value) => (value === undefined ? "" : String(value));
const isNumeric = (value) => value === undefined || typeof value === "number";
// Native getBool treats literal "off" (case-insensitively) as false.
const truth = (value) =>
  typeof value === "string"
    ? value.toLowerCase() !== "off"
    : numeric(value) !== 0;
function binary(op, a, b) {
  const x = numeric(a),
    y = numeric(b);
  const equal =
    isNumeric(a) && isNumeric(b) ? x === y : literal(a) === literal(b);
  switch (op) {
    case "+":
      return isNumeric(a) && isNumeric(b) ? x + y : literal(a) + literal(b);
    case "-":
      return x - y;
    case "*":
      return x * y;
    case "/":
      return x / y;
    case "%":
      return Math.trunc(x) % Math.trunc(y);
    case "^":
      return x ** y;
    case "==":
      return Number(equal);
    case "~=":
      return Number(!equal);
    case "<":
      return Number(x < y);
    case ">":
      return Number(x > y);
    case "<=":
      return Number(x <= y);
    case ">=":
      return Number(x >= y);
    case "&&":
      return Number(Boolean(x) && Boolean(y));
    case "||":
      return Number(Boolean(x) || Boolean(y));
    case "&":
      return x & y;
    case "|":
      return x | y;
    case "`":
      return x ^ y;
    case "<<":
      return x << y;
    case ">>":
      return x >> y;
    default:
      throw Error("Unsupported operator " + op + ".");
  }
}
function execution(path, instructions, context = {}) {
  return {
    path,
    cooperative: Boolean(context.cooperative),
    taskId: context.taskId ?? null,
    instructions,
    methods: Object.fromEntries(
      instructions.flatMap((node, pc) =>
        node.op === "method"
          ? [
              [
                node.name + "/" + node.params.length,
                { pc: pc + 1, params: node.params },
              ],
            ]
          : [],
      ),
    ),
    pc: 0,
    waiting: false,
    operandStack: [],
    callFrames: [],
    locals: {},
    steps: 0,
    sourceItemSlot: context.sourceItemSlot ?? null,
    sourceBoardPath: context.sourceBoardPath ?? null,
  };
}

function run(state) {
  const vars = { ...state.variables };
  const copy = (frame) => ({
    ...frame,
    locals: { ...frame.locals },
    operandStack: [...(frame.operandStack ?? [])],
    callFrames: (frame.callFrames ?? []).map((f) => ({
      ...f,
      locals: { ...f.locals },
    })),
  });
  let exec = copy(state.execution);
  const scriptStack = [...(state.scriptStack ?? [])];
  let message = state.message;
  const screen = {
    active: false,
    fontSize: 20,
    bold: false,
    color: [255, 255, 255],
    texts: [],
    maps: {},
    nextMap: 1,
    settings: {},
    ...state.screen,
  };
  screen.texts = [...screen.texts];
  screen.maps = { ...screen.maps };
  screen.settings = { ...screen.settings };
  const locals = (frame) => [
    frame.locals,
    ...(frame.callFrames ?? []).map((f) => f.locals),
  ];
  const stores = [vars, ...locals(exec), ...scriptStack.flatMap(locals)].filter(
    Boolean,
  );
  let storedValues = stores.reduce(
    (sum, store) => sum + Object.keys(store).length,
    0,
  );
  const chars = (value) => (typeof value === "string" ? value.length : 0);
  let storedChars = stores.reduce(
    (sum, store) =>
      sum +
      Object.entries(store).reduce((n, [k, v]) => n + k.length + chars(v), 0),
    0,
  );
  let screenChars = screen.texts.reduce((n, t) => n + t.text.length, 0);
  let operandChars = exec.operandStack.reduce((n, v) => n + chars(v), 0);
  const checkMemory = (extra) => {
    if (
      storedChars + operandChars + screenChars + message.length + extra >
      languageLimits.memoryChars
    )
      throw Error("Session memory budget exceeded.");
  };
  const snapshot = () => ({
    ...state,
    variables: vars,
    message,
    execution: exec,
    scriptStack,
    screen,
    diagnostic: null,
  });
  const finish = () => ({
    status: "completed",
    state: {
      ...snapshot(),
      execution: null,
      scriptStack: [],
      screen: { ...screen, active: false },
      runs: state.runs + 1,
    },
  });
  const fail = (node, message) => ({
    status: "error",
    state: {
      ...snapshot(),
      execution: null,
      scriptStack: [],
      screen: { ...screen, active: false },
      diagnostic: issue(node.path ?? exec.path, node.line, message),
    },
  });
  const pop = () => {
    if (!exec.operandStack.length) throw Error("Invalid operand stack.");
    const value = exec.operandStack.pop();
    operandChars -= chars(value);
    return value;
  };
  const push = (value) => {
    if (exec.operandStack.length >= languageLimits.values)
      throw Error("Operand stack budget exceeded.");
    if (typeof value === "string" && value.length > languageLimits.stringLength)
      throw Error("String budget exceeded.");
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error("Non-finite numeric result.");
    checkMemory(chars(value));
    operandChars += chars(value);
    exec.operandStack.push(value);
  };
  const table = (ref) => (ref.scope === "local" ? exec.locals : vars);
  const read = (ref) =>
    Object.hasOwn(table(ref), ref.name) ? table(ref)[ref.name] : undefined;
  const write = (ref, value) => {
    if (!ref || typeof ref.name !== "string")
      throw Error("Invalid variable reference.");
    const existing = Object.hasOwn(table(ref), ref.name);
    if (!existing && storedValues >= languageLimits.values)
      throw Error("Variable storage budget exceeded.");
    const newChars =
      storedChars -
      chars(table(ref)[ref.name]) +
      chars(value) +
      (existing ? 0 : ref.name.length);
    checkMemory(newChars - storedChars);
    storedChars = newChars;
    if (!existing) storedValues++;
    if (typeof value === "string" && value.length > languageLimits.stringLength)
      throw Error("String budget exceeded.");
    if (typeof value === "number" && !Number.isFinite(value))
      throw Error("Non-finite numeric result.");
    Object.defineProperty(table(ref), ref.name, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  };
  if (exec.pendingService && Object.hasOwn(exec, "serviceResult")) {
    const pending = exec.pendingService,
      result = exec.serviceResult;
    try {
      if (!result || typeof result !== "object")
        throw Error("Missing service result.");
      const returned = result.value ?? 0;
      if (!["number", "string"].includes(typeof returned))
        throw Error("Invalid service return value.");
      const writes = result?.outputs ?? [];
      if (writes.length !== pending.outputs.length)
        throw Error("Incomplete service output values.");
      for (const output of pending.outputs) {
        const found = writes.find((item) => item.index === output.index);
        if (!found || !["number", "string"].includes(typeof found.value))
          throw Error("Invalid service output value.");
        write(output.ref, found.value);
      }
      pop();
      push(returned);
      if (result?.presented) screen.active = true;
      if (result?.frameYielded) exec.steps = 0;
      delete exec.pendingService;
      delete exec.serviceResult;
    } catch (error) {
      return fail(pending, error.message);
    }
  }
  let last = { path: exec.path, line: 1 };
  for (let steps = 0; steps < (exec.cooperative ? 512 : languageLimits.sliceSteps); steps++) {
    if (++exec.steps > languageLimits.totalSteps)
      return fail(last, "Total instruction budget exceeded.");
    if (exec.pc >= exec.instructions.length) {
      if (scriptStack.length) {
        for (const store of locals(exec)) {
          storedValues -= Object.keys(store).length;
          storedChars -= Object.entries(store).reduce(
            (n, [k, v]) => n + k.length + chars(v),
            0,
          );
        }
        exec = copy(scriptStack.pop());
        operandChars = exec.operandStack.reduce((n, v) => n + chars(v), 0);
        continue;
      }
      return finish();
    }
    const node = exec.instructions[exec.pc++];
    last = node;
    try {
      if (node.op === "push") push(node.value);
      else if (node.op === "reference") {
        const local =
          node.scope === "local" ||
          (node.scope === "auto" && Object.hasOwn(exec.locals, node.name));
        const ref = { name: node.name, scope: local ? "local" : "global" };
        if (node.scope === "local" && !Object.hasOwn(exec.locals, node.name))
          write(ref, undefined);
        push(ref);
      } else if (node.op === "index") {
        const index = pop(),
          ref = pop();
        if (!ref?.name || !["number", "string"].includes(typeof index))
          throw Error("Invalid indexed variable.");
        const name = ref.name + "[" + String(index) + "]";
        if (name.length > 1024) throw Error("Indexed name budget exceeded.");
        push({ ...ref, name });
      } else if (node.op === "read") push(read(pop()));
      else if (node.op === "assign") {
        const b = pop(),
          ref = pop();
        const result =
          node.operator === "="
            ? b
            : binary(node.operator.slice(0, -1), read(ref), b);
        write(ref, result);
        push(result);
      } else if (node.op === "increment") {
        const ref = pop(),
          before = numeric(read(ref)),
          after = before + node.delta;
        write(ref, after);
        push(node.postfix ? before : after);
      } else if (node.op === "binary") {
        const b = pop(),
          a = pop();
        push(binary(node.operator, a, b));
      } else if (node.op === "unary") {
        const a = pop();
        push(
          node.operator === "!"
            ? Number(!numeric(a))
            : node.operator === "~"
              ? ~numeric(a)
              : node.operator === "-"
                ? -numeric(a)
                : numeric(a),
        );
      } else if (node.op === "ternary") {
        const no = pop(),
          yes = pop(),
          test = pop();
        push(numeric(test) ? yes : no);
      } else if (node.op === "drop") pop();
      else if (node.op === "duplicate") {
        const a = pop();
        push(a);
        push(a);
      } else if (node.op === "jump") exec.pc = node.jump;
      else if (node.op === "branch") {
        const yes = Boolean(numeric(pop()));
        if (node.invert ? yes : !yes) exec.pc = node.jump;
      } else if (node.op === "return") {
        const result = pop();
        if (!exec.callFrames.length) exec.pc = exec.instructions.length;
        else {
          storedValues -= Object.keys(exec.locals).length;
          storedChars -= Object.entries(exec.locals).reduce(
            (n, [k, v]) => n + k.length + chars(v),
            0,
          );
          const caller = exec.callFrames.pop();
          exec.pc = caller.pc;
          exec.locals = caller.locals;
          operandChars -= exec.operandStack
            .splice(caller.stackBase)
            .reduce((n, v) => n + chars(v), 0);
          push(result);
        }
      } else if (node.op === "end") exec.pc = exec.instructions.length;
      else if (node.op === "call") {
        const args = exec.operandStack.splice(
            exec.operandStack.length - node.argc,
            node.argc,
          ),
          name = node.name;
        operandChars -= args.reduce((n, v) => n + chars(v), 0);
        const key = name + "/" + args.length;
        const method =
          !node.native && Object.hasOwn(exec.methods, key)
            ? exec.methods[key]
            : null;
        if (method) {
          if (exec.callFrames.length >= languageLimits.calls)
            throw Error("Method call depth budget exceeded.");
          exec.callFrames.push({
            pc: exec.pc,
            locals: exec.locals,
            stackBase: exec.operandStack.length,
          });
          exec.locals = Object.fromEntries(
            method.params.map((p, i) => [p, args[i]]),
          );
          storedValues += method.params.length;
          storedChars +=
            args.reduce((n, v) => n + chars(v), 0) +
            method.params.reduce((n, p) => n + p.length, 0);
          if (storedValues > languageLimits.values)
            throw Error("Method storage budget exceeded.");
          checkMemory(0);
          exec.pc = method.pc;
          continue;
        }
        if (name === "end" || name === "done") {
          exec.pc = exec.instructions.length;
          continue;
        }
        const canvasService =
          [
            "createcanvas",
            "killcanvas",
            "setimage",
            "setimagetransparent",
            "drawcanvas",
            "getpixel",
            "fillrect",
            "setpixel",
            "mousestatus",
            "keydown",
          ].includes(name) || ["thread","killthread","getthreadid","threadsleep","threadwake"].includes(name) ||
          (name === "clear" && args.length === 1) ||
          (["text", "pixeltext"].includes(name) && args.length === 4);
        if (canvasService) {
          const outputIndices =
            name === "getpixel"
              ? [2, 3, 4]
              : name === "thread" && args.length === 3 ? [2]
              : name === "getthreadid" && args.length === 1 ? [0]
              : name === "createcanvas" && args.length === 3
                ? [2]
                : [];
          const outputs = outputIndices.map((index) => ({
            index,
            ref: args[index],
          }));
          exec.pendingService = { path: node.path, line: node.line, outputs };
          push(0);
          return {
            status: "effect",
            state: snapshot(),
            effect: {
              kind: "runtime-service",
              name,
              args: args.map((value, index) =>
                outputIndices.includes(index) ? 0 : value,
              ),
              style: {
                fontSize: screen.fontSize,
                bold: screen.bold,
                color: screen.color,
              },
              path: node.path,
              line: node.line,
            },
          };
        }
        if (name === "mwin") {
          const text = literal(args[0]);
          message = message ? message + "\n" + text : text;
          if (message.length > languageLimits.stringLength)
            throw Error("Message budget exceeded.");
          push(0);
        } else if (name === "mwincls") {
          message = "";
          push(0);
        } else if (name === "wait") {
          exec.waiting = true;
          exec.inputKind = "wait";
          return { status: "waiting", state: snapshot(), line: node.line };
        } else if (name === "send") {
          push(0);
          return {
            status: "transfer",
            state: snapshot(),
            transfer: {
              path: node.path,
              line: node.line,
              file: args[0],
              x: args[1],
              y: args[2],
              layer: args[3] ?? 1,
            },
          };
        } else if (name === "fightenemy") {
          push(0);
          const encounter = {
            path: node.path,
            line: node.line,
            enemy: args[0],
            background: args[1],
          };
          return {
            status: "fight",
            encounter,
            state: { ...snapshot(), pendingFight: encounter },
          };
        } else if (name === "eraseitem") {
          push(0);
          return {
            status: "effect",
            state: snapshot(),
            effect: {
              kind: "erase-item",
              alias: args[0],
              path: node.path,
              line: node.line,
              sourceItemSlot: exec.sourceItemSlot,
              sourceBoardPath: exec.sourceBoardPath,
            },
          };
        } else if (name === "fontsize") {
          const size = Math.trunc(numeric(args[0]));
          if (size < 1 || size > 256)
            throw Error("Font size must be between 1 and 256.");
          screen.fontSize = size;
          push(0);
        } else if (name === "bold") {
          screen.bold = truth(args[0]);
          push(0);
        } else if (name === "colorrgb") {
          screen.color = args.map((v) =>
            Math.max(0, Math.min(255, Math.trunc(numeric(v)))),
          );
          push(0);
        } else if (name === "clear") {
          screen.active = true;
          screen.paintEpoch = (screen.paintEpoch ?? 0) + 1;
          screen.cleared = true;
          screen.texts = [];
          screenChars = 0;
          push(0);
        } else if (name === "text" || name === "pixeltext") {
          if (screen.texts.length >= 2048)
            throw Error("Screen text budget exceeded.");
          const factor = name === "text" ? screen.fontSize : 1,
            subtract = name === "text" ? screen.fontSize : 0;
          const x = numeric(args[0]) * factor - subtract,
            y = numeric(args[1]) * factor - subtract;
          if (!Number.isFinite(x) || !Number.isFinite(y))
            throw Error("Invalid text coordinates.");
          checkMemory(literal(args[2]).length);
          screenChars += literal(args[2]).length;
          screen.active = true;
          screen.texts.push({
            x,
            y,
            text: literal(args[2]),
            fontSize: screen.fontSize,
            bold: screen.bold,
            color: [...screen.color],
            path: node.path,
            line: node.line,
          });
          push(0);
        } else if (["menugraphic", "fightmenugraphic"].includes(name)) {
          screen.settings[name] = String(args[0]);
          push(0);
        } else if (name === "spritetranslucency") {
          if (args.length)
            screen.settings.spritetranslucency = Math.max(
              0,
              Math.min(100, numeric(args[0])),
            );
          push(screen.settings.spritetranslucency ?? 50);
        } else if (name === "createcursormap") {
          if (Object.keys(screen.maps).length >= 64)
            throw Error("Cursor map storage budget exceeded.");
          const id = screen.nextMap++;
          screen.maps[id] = [];
          push(id);
        } else if (name === "cursormapadd") {
          const id = args[2],
            points = screen.maps[id];
          if (!points) throw Error("Cursor map is unavailable.");
          if (points.length >= 128)
            throw Error("Cursor point budget exceeded.");
          const x = numeric(args[0]),
            y = numeric(args[1]);
          screen.maps[id] = [...points, { x, y }];
          push(0);
        } else if (name === "killcursormap") {
          if (!Object.hasOwn(screen.maps, args[0]))
            throw Error("Cursor map is unavailable.");
          delete screen.maps[args[0]];
          push(0);
        } else if (name === "cursormaprun") {
          const points = screen.maps[args[0]];
          if (!points?.length) throw Error("Cursor map has no points.");
          exec.waiting = true;
          exec.inputKind = "choice";
          exec.choiceCount = points.length;
          return {
            status: "choice",
            state: snapshot(),
            choice: { points, path: node.path, line: node.line },
          };
        } else if (["wingraphic", "mediaplay", "mediastop"].includes(name)) {
          push(0);
          return {
            status: "effect",
            state: snapshot(),
            effect: {
              kind: "runtime-service",
              name,
              args,
              path: node.path,
              line: node.line,
            },
          };
        } else if (name === "windows") {
          return {
            status: "exited",
            state: {
              ...snapshot(),
              execution: null,
              scriptStack: [],
              screen: { ...screen, active: false },
            },
          };
        } else
          throw Error(
            "Unsupported RPGCode command: " +
              name +
              "()" +
              (name === "dirsav" || name === "load"
                ? "; native save/load is not implemented."
                : "."),
          );
      } else throw Error("Unknown compiled instruction.");
    } catch (error) {
      return fail(node, error.message);
    }
  }
  if (exec.cooperative) return {status:"yielded",state:snapshot()};
  return fail(last, "Instruction slice budget exceeded.");
}

export function startTk3Script(state, source, path, context = {}) {
  if (state.execution || state.pendingFight) return { status: "busy", state };
  const compiled = compileTk3Interaction(source, path, context);
  if (!compiled.ok)
    return {
      status: "error",
      state: {
        ...state,
        message: "",
        diagnostic: compiled.diagnostic,
        execution: null,
      },
    };
  const prepared = {
    ...state,
    screen: {
      ...state.screen,
      active: false,
      texts: [],
      cleared: false,
      programId: (state.screen?.programId ?? 0) + 1,
    },
    message: "",
    diagnostic: null,
    transferCount: 0,
    execution: execution(path, compiled.instructions, context),
  };
  return context.defer ? {status:"prepared",state:prepared} : run(prepared);
}

// One bounded VM quantum per scheduler frame, with a shared global heap.
export function resumeTk3Task(state, result) {
  if (!state.execution) return {status:"completed",state};
  const next={...state, execution:{...state.execution,steps:0}};
  return result ? resumeTk3Effect(next,result) : run(next);
}

// Native synchronous nested CProgram: retain the caller's complete VM frame.
export function callTk3Program(state, source, path, context = {}) {
  if (state.execution?.waiting || state.pendingFight) return { status: "busy", state };
  if ((state.scriptStack?.length ?? 0) >= 16)
    return rejectTk3Effect(state, {path,line:1}, "Nested board-entry budget exceeded.");
  const compiled = compileTk3Interaction(source, path, context);
  if (!compiled.ok) return rejectTk3Effect(state, compiled.diagnostic, compiled.diagnostic.message);
  return run({ ...state, message:"", diagnostic:null,
    execution:execution(path, compiled.instructions, context),
    scriptStack:[...(state.scriptStack ?? []), ...(state.execution ? [state.execution] : [])] });
}

// Resume after an approved outside effect, such as erasing the
// triggering item. Unlike Send(), no board remount is involved.
export function resumeTk3Effect(state, result) {
  if (!state.execution || state.execution.waiting || state.pendingFight)
    return { status: "inactive", state };
  return run(
    state.execution.pendingService
      ? {
          ...state,
          execution: {
            ...state.execution,
            serviceResult: result,
          },
        }
      : state,
  );
}

// A battle outcome is explicit. Running its victory program is an
// external decision: the interpreter never guesses the native plugin result.
export function finishTk3Fight(state, victory = null) {
  if (!state.pendingFight || !state.execution)
    return { status: "inactive", state };
  if (victory?.path && Array.isArray(victory.instructions)) {
    const parent = state.execution;
    return run({
      ...state,
      pendingFight: null,
      execution: execution(victory.path, victory.instructions, parent),
      scriptStack: [...(state.scriptStack ?? []), parent],
      message: "",
      diagnostic: null,
    });
  }
  return run({ ...state, pendingFight: null, diagnostic: null });
}

export function abandonTk3Fight(state) {
  if (!state.pendingFight) return { status: "inactive", state };
  return {
    status: "aborted",
    state: {
      ...state,
      execution: null,
      pendingFight: null,
      scriptStack: [],
      message: "",
      diagnostic: null,
    },
  };
}

export function advanceTk3Script(state, key = "") {
  if (!state.execution?.waiting || state.execution.inputKind !== "wait")
    return { status: "inactive", state };
  return run({
    ...state,
    transferCount: 0,
    execution: {
      ...state.execution,
      waiting: false,
      operandStack: [...state.execution.operandStack, String(key)],
    },
  });
}

export function chooseTk3Cursor(state, index) {
  const exec = state.execution;
  if (!exec?.waiting || exec.inputKind !== "choice")
    return { status: "inactive", state };
  if (!Number.isInteger(index) || index < 0 || index >= exec.choiceCount)
    return { status: "invalid-choice", state };
  return run({
    ...state,
    transferCount: 0,
    execution: {
      ...exec,
      waiting: false,
      operandStack: [...exec.operandStack, index],
    },
  });
}

export function rejectTk3Effect(state, effect, message) {
  const diagnostic = issue(effect.path, effect.line, message);
  return {
    status: "error",
    state: {
      ...state,
      execution: null,
      scriptStack: [],
      screen: state.screen ? { ...state.screen, active: false } : undefined,
      diagnostic,
    },
  };
}

// Resume only after the outer scene owner has validated and committed Send.
// The script continues at the statement *after* Send, on the new board.
export function resumeTk3Transfer(state) {
  if (
    !state.execution ||
    state.execution.waiting ||
    state.execution.pendingService
  )
    return { status: "inactive", state };
  return run(state);
}

// A failed destination is a script diagnostic, not an aborted board session.
// Keep all variables already assigned before Send, but discard the program
// counter so the actor can talk, move and retry from the current board.
export function rejectTk3Transfer(state, transfer, message) {
  const diagnostic = issue(transfer.path, transfer.line, message);
  return {
    status: "error",
    state: {
      ...state,
      execution: null,
      scriptStack: [],
      message: "",
      diagnostic,
    },
  };
}

// Find the nearest source-resolved, on-layer board item with a PRG.
// No game-specific or script-name exclusions belong in this generic selector.
export function selectTk3ScriptTarget(
  scene,
  actor,
  radius = TK3_INTERACTION_RADIUS,
) {
  if (
    !scene?.ok ||
    !Number.isFinite(actor?.x) ||
    !Number.isFinite(actor?.y) ||
    !Number.isInteger(actor.layer)
  )
    return null;
  return (
    (scene.placements ?? [])
      .filter(
        (p) =>
          p.positionStatus === "valid" &&
          p.itemStatus === "resolved" &&
          p.programStatus === "resolved" &&
          p.programPath &&
          /\.prg$/i.test(p.programPath) &&
          p.position?.layer === actor.layer,
      )
      .map((p) => ({
        placement: p,
        distance: Math.hypot(p.position.x - actor.x, p.position.y - actor.y),
      }))
      .filter((p) => p.distance <= radius)
      .sort(
        (a, b) =>
          a.distance - b.distance || a.placement.slot - b.placement.slot,
      )[0]?.placement ?? null
  );
}

export function startPlacedTk3Script(state, scene, actor, artifacts) {
  const target = selectTk3ScriptTarget(scene, actor);
  if (!target) return { status: "out-of-range", state };
  const program = artifacts.get(target.programPath);
  if (
    program?.type !== "prg" ||
    program.decodeStatus !== "decoded" ||
    !program.program?.rows
  ) {
    const diagnostic = issue(
      target.programPath,
      1,
      "Resolved activation program has no decoded source.",
    );
    return {
      status: "error",
      target,
      state: { ...state, diagnostic, execution: null, message: "" },
    };
  }
  const source = program.program.rows.map((row) => row.line).join("\n");
  return {
    ...startTk3Script(state, source, target.programPath, {
      artifacts,
      projectRoot: scene.projectRoot,
      sourceItemSlot: target.slot,
      sourceBoardPath: scene.boardPath,
    }),
    target,
  };
}
