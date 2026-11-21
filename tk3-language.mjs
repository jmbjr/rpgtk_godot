import { archiveInventory } from "./archive-inventory.mjs";
import { resolveAsset } from "./model.mjs";

// Source-backed scalar RPGCode grammar. No eval or generated JavaScript.
export const languageLimits = Object.freeze({
  sourceBytes: 1048576,
  tokens: 100000,
  instructions: 100000,
  nesting: 64,
  includes: 32,
  calls: 64,
  values: 8192,
  stringLength: 65536,
  memoryChars: 1048576,
  sliceSteps: 20000,
  totalSteps: 250000,
});
export const scriptIssue = (path, line, message) => ({
  path,
  line,
  message,
  text: path + ":" + line + ": " + message,
});
const builtinArity = new Map(
  Object.entries({
    mwin: [1],
    wait: [0],
    thread: [2,3], killthread: [1], getthreadid: [0,1], threadsleep: [2], threadwake: [1],
    mwincls: [0],
    send: [3, 4],
    fightenemy: [2],
    eraseitem: [1],
    pushitem:[2,3], itemlocation:[4], itemspeed:[2],
    end: [0],
    done: [0],
    fontsize: [1],
    bold: [1],
    clear: [0, 1],
    text: [3, 4],
    pixeltext: [3, 4],
    createcanvas: [2, 3],
    killcanvas: [1],
    setimage: [5, 6],
    setimagetransparent: [8, 9],
    drawcanvas: [3, 5, 6],
    getpixel: [5, 6],
    fillrect: [4, 5],
    setpixel: [2, 3],
    mousestatus: [1],
    keydown: [1, 2],
    colorrgb: [3],
    menugraphic: [1],
    fightmenugraphic: [1],
    wingraphic: [1],
    spritetranslucency: [0, 1],
    mediaplay: [1],
    mediastop: [0],
    createcursormap: [0],
    cursormapadd: [3],
    cursormaprun: [1],
    killcursormap: [1],
    windows: [0],
    dirsav: [1],
    load: [1],
  }),
);
const binaryPrecedence = {
  "=": 1,
  "+=": 1,
  "-=": 1,
  "*=": 1,
  "/=": 1,
  "%=": 1,
  "^=": 1,
  "&=": 1,
  "|=": 1,
  "`=": 1,
  "<<=": 1,
  ">>=": 1,
  "||": 3,
  "&&": 4,
  "|": 5,
  "`": 6,
  "&": 7,
  "==": 8,
  "~=": 8,
  ">": 9,
  "<": 9,
  ">=": 9,
  "<=": 9,
  "<<": 10,
  ">>": 10,
  "+": 11,
  "-": 11,
  "*": 12,
  "/": 12,
  "%": 12,
  "^": 13,
};

function tokenize(source, path, budget) {
  budget.bytes += new TextEncoder().encode(source).length;
  if (budget.bytes > languageLimits.sourceBytes)
    throw scriptIssue(path, 1, "Source byte budget exceeded.");
  const tokens = [];
  let at = 0,
    line = 1,
    lineStart = true;
  const push = (type, value, row = line) => {
    if (++budget.tokens > languageLimits.tokens)
      throw scriptIssue(path, row, "Source token budget exceeded.");
    tokens.push({ type, value, line: row, path });
  };
  while (at < source.length) {
    const rest = source.slice(at),
      c = source[at];
    if (c === "\r") {
      at++;
      continue;
    }
    if (c === "\n") {
      push("nl", "\n");
      line++;
      at++;
      lineStart = true;
      continue;
    }
    if (/\s/.test(c)) {
      at++;
      continue;
    }
    if (/^_\s*\r?\n/.test(rest)) {
      at += rest.match(/^_\s*\r?\n/)[0].length;
      line++;
      continue;
    }
    if (rest.startsWith("//") || (lineStart && c === "*")) {
      while (at < source.length && source[at] !== "\n") at++;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", at + 2);
      if (end < 0) throw scriptIssue(path, line, "Unclosed block comment.");
      const comment = source.slice(at, end + 2);
      line += (comment.match(/\n/g) || []).length;
      at = end + 2;
      continue;
    }
    if (lineStart && c === "#") {
      at++;
      continue;
    }
    lineStart = false;
    if (c === '"') {
      const end = source.indexOf('"', at + 1);
      if (end < 0 || source.slice(at + 1, end).includes("\n"))
        throw scriptIssue(path, line, "Unclosed string literal.");
      const value = source.slice(at + 1, end);
      if (value.length > languageLimits.stringLength)
        throw scriptIssue(path, line, "String budget exceeded.");
      push("string", value);
      at = end + 1;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) {
      push("number", Number(number[0]));
      at += number[0].length;
      continue;
    }
    const id = rest.match(/^[A-Za-z_]\w*/);
    if (id) {
      push("id", id[0].toLowerCase());
      at += id[0].length;
      continue;
    }
    const op = rest.match(
      /^(?:<<=|>>=|\+\+|--|\+=|-=|\*=|\/=|%=|\^=|&=|\|=|`=|==|~=|<=|>=|&&|\|\||<<|>>|[(){}\[\],;?:+*/%\-~!<>=&|^`])/,
    );
    if (!op) throw scriptIssue(path, line, "Unsupported source token: " + c);
    push("op", op[0]);
    at += op[0].length;
  }
  push("eof", "");
  return tokens;
}

export function compileTk3Language(
  source,
  path,
  { artifacts, projectRoot } = {},
) {
  if (!path || typeof path !== "string" || typeof source !== "string")
    return {
      ok: false,
      diagnostic: scriptIssue(
        path || "(unresolved program)",
        1,
        "Program source is unavailable.",
      ),
    };
  const methods = new Map(),
    loaded = new Set([path]),
    active = new Set();
  const budget = { bytes: 0, tokens: 0 };
  const root =
    projectRoot ?? (artifacts ? archiveInventory(artifacts).ownerOf(path) : "");
  function parseFile(source, path, included = false) {
    active.add(path);
    const tokens = tokenize(source, path, budget);
    let offset = 0,
      depth = 0;
    const now = () => tokens[offset];
    const is = (value) =>
      ["op", "id"].includes(now().type) && now().value === value;
    const take = () => tokens[offset++];
    const fail = (row, message) => {
      throw scriptIssue(row.path, row.line, message);
    };
    const need = (value) => {
      if (!is(value)) fail(now(), "Expected " + value + ".");
      return take();
    };
    const skip = () => {
      while (now().type === "nl" || is(";")) take();
    };
    const newlines = () => {
      while (now().type === "nl") take();
    };
    const guard = (row) => {
      if (++depth > languageLimits.nesting)
        fail(row, "Source nesting budget exceeded.");
    };
    function args() {
      need("(");
      const out = [];
      if (!is(")")) {
        do {
          newlines();
          out.push(expr());
          newlines();
          if (!is(",")) break;
          take();
        } while (true);
      }
      need(")");
      return out;
    }
    function expr(min = 1) {
      const row = now();
      guard(row);
      let left;
      if (
        now().type === "op" &&
        ["!", "~", "-", "+", "++", "--"].includes(now().value)
      ) {
        const op = take().value;
        left = { kind: "unary", operator: op, value: expr(14), row };
      } else if (is("(")) {
        take();
        left = expr();
        need(")");
      } else if (now().type === "number" || now().type === "string") {
        const t = take();
        left = { kind: "literal", value: t.value, row };
      } else if (now().type === "id") {
        const name = take().value;
        if (["true", "false", "null"].includes(name))
          left = { kind: "literal", value: name === "true" ? 1 : 0, row };
        else if (is("(")) {
          const values = args();
          if (["local", "global"].includes(name)) {
            if (values.length !== 1 || values[0].kind !== "variable")
              fail(row, name + "() requires one scalar variable.");
            left = { ...values[0], scope: name, row };
          } else left = { kind: "call", name, args: values, row };
        } else left = { kind: "variable", name, scope: "auto", row };
      } else fail(row, "Expected an expression.");
      while (true) {
        if (is("[")) {
          const row = take();
          const index = expr();
          need("]");
          left = { kind: "index", base: left, index, row };
          continue;
        }
        if (is("++") || is("--")) {
          left = { kind: "postfix", operator: take().value, value: left, row };
          continue;
        }
        if (is("?") && min <= 2) {
          take();
          const yes = expr();
          need(":");
          left = { kind: "conditional", test: left, yes, no: expr(2), row };
          continue;
        }
        const op = now().value,
          precedence = now().type === "op" ? binaryPrecedence[op] : undefined;
        if (!precedence || precedence < min) break;
        take();
        const right = expr(precedence === 1 ? precedence : precedence + 1);
        left = {
          kind: precedence === 1 ? "assignment" : "binary",
          operator: op,
          left,
          right,
          row,
        };
      }
      depth--;
      return left;
    }
    function block() {
      newlines();
      need("{");
      guard(now());
      skip();
      const body = [];
      while (!is("}")) {
        if (now().type === "eof")
          fail(tokens[Math.max(0, offset - 1)], "Unclosed { block.");
        const node = statement(false);
        if (node) body.push(node);
        skip();
      }
      take();
      depth--;
      return body;
    }
    function condition() {
      need("(");
      const e = expr();
      need(")");
      return e;
    }
    function statement(top) {
      const row = now(),
        word = now().type === "id" ? now().value : undefined;
      guard(row);
      try {
        if (word === "include" && top) {
          take();
          let filename;
          if (is("(")) {
            const a = args();
            if (
              a.length === 1 &&
              a[0].kind === "literal" &&
              typeof a[0].value === "string"
            )
              filename = a[0].value;
          } else if (now().type === "string") filename = take().value;
          if (
            !artifacts ||
            !filename ||
            !/^[A-Za-z0-9_. -]+\.prg$/i.test(filename) ||
            filename.includes("..")
          )
            fail(
              row,
              "An include must name one project PRG file with archive context.",
            );
          const found = resolveAsset(artifacts, "Prg", filename, root);
          if (found.status !== "resolved")
            fail(row, "Included PRG " + filename + " is " + found.status + ".");
          if (active.has(found.path))
            fail(row, "Cyclic include: " + found.path + ".");
          if (!loaded.has(found.path)) {
            if (
              loaded.size >= languageLimits.includes ||
              active.size >= languageLimits.nesting
            )
              fail(row, "Include budget exceeded.");
            const asset = artifacts.get(found.path);
            if (
              asset?.type !== "prg" ||
              asset.decodeStatus !== "decoded" ||
              asset.error ||
              !Array.isArray(asset.program?.rows)
            )
              fail(
                row,
                "Included PRG " + found.path + " has no decoded source.",
              );
            loaded.add(found.path);
            parseFile(
              asset.program.rows.map((r) => r.line).join("\n"),
              found.path,
              true,
            );
          }
          return null;
        }
        if ((word === "method" || word === "function") && top) {
          take();
          const name = take();
          if (name.type !== "id") fail(name, "Expected method name.");
          need("(");
          const params = [];
          if (!is(")"))
            do {
              const p = take();
              if (p.type !== "id")
                fail(p, "Only scalar by-value parameters are supported.");
              if (params.includes(p.value)) fail(p, "Duplicate parameter.");
              params.push(p.value);
              if (!is(",")) break;
              take();
            } while (true);
          need(")");
          const key = name.value + "/" + params.length;
          if (methods.has(key))
            fail(row, "Duplicate free method: " + name.value + ".");
          const body = block();
          if (methods.has(key))
            fail(row, "Duplicate free method: " + name.value + ".");
          methods.set(key, { name: name.value, params, body, row });
          return null;
        }
        if (included && top)
          fail(
            row,
            "Included PRGs may declare free methods and includes only.",
          );
        if (word === "if" || word === "elseif") {
          take();
          const test = condition(),
            yes = block();
          let no = [];
          const saved = offset;
          skip();
          if (is("else")) {
            take();
            if (is("if")) no = [statement(false)];
            else no = block();
          } else if (is("elseif")) no = [statement(false)];
          else offset = saved;
          return { kind: "if", test, yes, no, row };
        }
        if (word === "while" || word === "until") {
          take();
          const test = condition();
          return {
            kind: "loop",
            test,
            until: word === "until",
            body: block(),
            row,
          };
        }
        if (word === "for") {
          take();
          need("(");
          const init = is(";") ? null : expr();
          need(";");
          const test = is(";") ? { kind: "literal", value: 1, row } : expr();
          need(";");
          const increment = is(")") ? null : expr();
          need(")");
          return { kind: "for", init, test, increment, body: block(), row };
        }
        if (word === "switch") {
          take();
          const value = condition();
          newlines();
          need("{");
          skip();
          const cases = [];
          while (!is("}")) {
            const row = take();
            if (!["case", "default"].includes(row.value))
              fail(row, "Expected case or default.");
            const test = row.value === "case" ? expr() : null;
            if (is(":")) take();
            const body = block();
            cases.push({ test, body, row });
            skip();
          }
          take();
          if (cases.filter((c) => !c.test).length > 1)
            fail(row, "Duplicate default case.");
          if (cases.slice(0, -1).some((c) => !c.test))
            fail(row, "Default must follow the numbered cases.");
          return { kind: "switch", value, cases, row };
        }
        if (word === "return" || word === "returnmethod") {
          take();
          const value =
            now().type === "nl" ||
            (now().type === "op" && [";", "}"].includes(now().value))
              ? { kind: "literal", value: 0, row }
              : expr();
          return { kind: "return", value, row };
        }
        const value = expr();
        if (
          !["eof", "nl"].includes(now().type) &&
          !(now().type === "op" && [";", "}"].includes(now().value))
        )
          fail(now(), "Expected statement separator.");
        return { kind: "expression", value, row };
      } finally {
        depth--;
      }
    }
    skip();
    const body = [];
    while (now().type !== "eof") {
      const node = statement(true);
      if (node) body.push(node);
      skip();
    }
    active.delete(path);
    return body;
  }
  try {
    const main = parseFile(source, path),
      instructions = [];
    const emit = (op, row, values = {}) => {
      if (instructions.length >= languageLimits.instructions)
        throw scriptIssue(
          row.path,
          row.line,
          "Compiled instruction budget exceeded.",
        );
      instructions.push({ op, path: row.path, line: row.line, ...values });
      return instructions.length - 1;
    };
    let referenceDepth = 0;
    function reference(n) {
      if (++referenceDepth > languageLimits.nesting)
        throw scriptIssue(
          n.row.path,
          n.row.line,
          "Indexed nesting budget exceeded.",
        );
      try {
        if (n.kind === "variable")
          emit("reference", n.row, { name: n.name, scope: n.scope });
        else if (n.kind === "index") {
          reference(n.base);
          value(n.index);
          emit("index", n.row);
        } else
          throw scriptIssue(
            n.row.path,
            n.row.line,
            "Expected an assignable variable.",
          );
      } finally {
        referenceDepth--;
      }
    }
    let expressionDepth = 0;
    function value(n) {
      const row = n.row;
      if (++expressionDepth > languageLimits.nesting)
        throw scriptIssue(
          row.path,
          row.line,
          "Expression nesting budget exceeded.",
        );
      try {
        if (n.kind === "literal") emit("push", row, { value: n.value });
        else if (n.kind === "variable" || n.kind === "index") {
          reference(n);
          emit("read", row);
        } else if (n.kind === "binary") {
          value(n.left);
          value(n.right);
          emit("binary", row, { operator: n.operator });
        } else if (n.kind === "assignment") {
          reference(n.left);
          value(n.right);
          emit("assign", row, { operator: n.operator });
        } else if (n.kind === "unary" || n.kind === "postfix") {
          if (["++", "--"].includes(n.operator)) {
            reference(n.value);
            emit("increment", row, {
              delta: n.operator === "++" ? 1 : -1,
              postfix: n.kind === "postfix",
            });
          } else {
            value(n.value);
            emit("unary", row, { operator: n.operator });
          }
        } else if (n.kind === "conditional") {
          // Toolkit's RPN tertiary operator evaluates all three operands.
          value(n.test);
          value(n.yes);
          value(n.no);
          emit("ternary", row);
        } else if (n.kind === "call") {
          const arity = builtinArity.get(n.name),
            key = n.name + "/" + n.args.length;
          if (!arity && !methods.has(key))
            throw scriptIssue(
              row.path,
              row.line,
              "Unsupported RPGCode statement: " +
                n.name +
                "() (missing free method or unsupported command).",
            );
          if (arity && !arity.includes(n.args.length))
            throw scriptIssue(
              row.path,
              row.line,
              "Invalid argument count for " + n.name + "().",
            );
          const outputs =
            n.name === "itemlocation" ? [1,2,3] : n.name === "getpixel"
              ? [2, 3, 4]
              : n.name === "thread" && n.args.length === 3 ? [2]
              : n.name === "getthreadid" && n.args.length === 1 ? [0]
              : n.name === "createcanvas" && n.args.length === 3
                ? [2]
                : [];
          for (const [index, arg] of n.args.entries()) {
            if (arity && outputs.includes(index)) reference(arg);
            else value(arg);
          }
          emit("call", row, {
            name: n.name,
            argc: n.args.length,
            native: Boolean(arity),
          });
        }
      } finally {
        expressionDepth--;
      }
    }
    const expression = (n) => {
      if (n) {
        value(n);
        emit("drop", n.row);
      }
    };
    function sequence(nodes) {
      for (const n of nodes) {
        const row = n.row;
        if (n.kind === "expression") expression(n.value);
        else if (n.kind === "return") {
          value(n.value);
          emit("return", row);
        } else if (n.kind === "if") {
          value(n.test);
          const test = emit("branch", row, { jump: 0 });
          sequence(n.yes);
          const jump = emit("jump", row, { jump: 0 });
          instructions[test].jump = instructions.length;
          sequence(n.no);
          instructions[jump].jump = instructions.length;
        } else if (n.kind === "loop" || n.kind === "for") {
          if (n.kind === "for") expression(n.init);
          const head = instructions.length;
          value(n.test);
          const test = emit("branch", row, {
            jump: 0,
            invert: Boolean(n.until),
          });
          sequence(n.body);
          if (n.kind === "for") expression(n.increment);
          emit("jump", row, { jump: head });
          instructions[test].jump = instructions.length;
        } else if (n.kind === "switch") {
          value(n.value);
          const ends = [];
          let fallback = null;
          for (const c of n.cases) {
            if (!c.test) {
              fallback = c;
              continue;
            }
            emit("duplicate", c.row);
            value(c.test);
            emit("binary", c.row, { operator: "==" });
            const test = emit("branch", c.row, { jump: 0 });
            emit("drop", c.row);
            sequence(c.body);
            ends.push(emit("jump", c.row, { jump: 0 }));
            instructions[test].jump = instructions.length;
          }
          emit("drop", row);
          if (fallback) sequence(fallback.body);
          for (const end of ends) instructions[end].jump = instructions.length;
        }
      }
    }
    sequence(main);
    emit("end", { path, line: source.split(/\r\n?|\n/).length });
    for (const method of methods.values()) {
      emit("method", method.row, { name: method.name, params: method.params });
      sequence(method.body);
      emit("push", method.row, { value: 0 });
      emit("return", method.row);
    }
    return { ok: true, path, instructions };
  } catch (error) {
    return {
      ok: false,
      diagnostic:
        error?.path && error?.line
          ? error
          : scriptIssue(path, 1, error.message || String(error)),
    };
  }
}
