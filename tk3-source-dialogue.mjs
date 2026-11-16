import { mainFileBindings, resolveAsset } from "./model.mjs";

// A narrow source-driven projection of TK3's multi-window dialogue pattern.
// It does NOT execute arbitrary included classes, render Mwin/profile images,
// run plugins, or interpret method bodies. Unsupported statements are rejected
// with the original PRG/line instead of silently having side effects.
// Pinned TK3: CItem::open activation; CSprite::programTest; CProgram global
// variables; functions.cpp getTickCount. Browser interaction range remains 46px.
const error = (path, line, message) => ({
  path, line, message, text: path + ":" + line + ": " + message,
});
const ident = "[A-Za-z_][A-Za-z_0-9]*";
const quotes = source => {
  try { return JSON.parse(source); } catch { return null; }
};
const sourceOf = asset => asset?.type === "prg" &&
  asset.decodeStatus === "decoded" && Array.isArray(asset.program?.rows) ?
    asset.program.rows.map(r => r.line).join("\n") : null;

// Strip only real // comments outside strings. Split one source-specific
// trailing } after a call, e.g. Close()} (legitimate Toolkit syntax).
function normalized(source) {
  const rows = [];
  source.replace(/\r\n?|\n/g, "\n").split("\n").forEach((raw, index) => {
    let quote = false, escaped = false, cleaned = "";
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (!quote && c === "/" && raw[i + 1] === "/") break;
      cleaned += c;
      if (quote && c === "\\" && !escaped) { escaped = true; continue; }
      if (c === '"' && !escaped) quote = !quote;
      escaped = false;
    }
    const value = cleaned.trim();
    if (!value) return;
    const trailing = value.match(/^(.*\))\s*(\})$/);
    if (trailing) {
      rows.push({ line: index + 1, text: trailing[1] });
      rows.push({ line: index + 1, text: "}" });
    } else rows.push({ line: index + 1, text: value });
  });
  return rows;
}

function sourcePath(artifacts, currentPath, filename) {
  const root = currentPath.match(/^(.*\/)Prg\/[^/]+\.prg$/i)?.[1] ?? null;
  if (!/^[^\\/:"*?<>|]+\.prg$/i.test(filename) || filename.includes(".."))
    return { status: "unsupported" };
  return resolveAsset([...artifacts.keys()], "Prg", filename, root);
}

// Discover numeric definitions through the actual GAM startup include graph.
// This is static symbol gathering, NOT the execution of InitVar()/classes.
export function readLegacyDialogueDefinitions(artifacts, scene) {
  const main = artifacts.get(scene?.mainPath);
  const startup = main && new Map(mainFileBindings(main, [...artifacts.keys()]))
    .get("Configured startup");
  const visited = new Map(), constants = new Map(), collisions = new Set();
  function scan(path, depth) {
    if (depth > 12 || visited.size > 32 || visited.has(path)) return;
    const source = sourceOf(artifacts.get(path));
    if (source === null) return;
    visited.set(path, source);
    for (const row of normalized(source)) {
      const inc = row.text.match(/^#include\s*\(\s*"([^"]+)"\s*\)\s*;?$/i);
      if (inc) {
        const found = sourcePath(artifacts, path, inc[1]);
        if (found.status === "resolved") scan(found.path, depth + 1);
      }
      const num = row.text.match(new RegExp("^("+ident+")\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;?$"));
      if (num) {
        const key = num[1].toLowerCase(), value = Number(num[2]);
        if (constants.has(key) && constants.get(key) !== value) collisions.add(key);
        else constants.set(key, value);
      }
    }
  }
  if (startup?.status === "resolved") scan(startup.path, 0);
  for (const key of collisions) constants.delete(key);
  const all = Object.fromEntries(constants);
  return {
    startupPath: startup?.path ?? null,
    sourcePaths: [...visited.keys()],
    constants: all,
    supported: Number.isInteger(all.maxclues) && all.maxclues > 0 &&
      all.maxclues <= 100 && Number.isFinite(all.itemtalkthreshold) &&
      all.itemtalkthreshold >= 0,
  };
}

// Source list of class methods and free functions is verification evidence:
// we do not pretend calling them can reproduce all graphics and audio.
function checkIncludeMethods(artifacts, path, rows, methods) {
  const includes = [];
  for (const row of rows) {
    const inc = row.text.match(/^#include\s*\(\s*"([^"]+)"\s*\)\s*;?$/i);
    if (!inc) continue;
    const found = sourcePath(artifacts, path, inc[1]);
    if (found.status !== "resolved")
      throw error(path, row.line, "Included RPGCode " + inc[1] +
        " is " + found.status + ".");
    const text = sourceOf(artifacts.get(found.path));
    if (text === null) throw error(path, row.line,
      "Included RPGCode is not decoded: " + found.path);
    includes.push({ path: found.path, text });
  }
  for (const name of methods) {
    if (!includes.some(inc => new RegExp("\\bmethod\\s+" +
      name + "\\s*\\(", "i").test(inc.text)))
      throw error(path, rows[0]?.line ?? 1, "Helper method " + name +
        "() not declared by resolved #include PRGs.");
  }
  return includes;
}

function bodyAt(rows, conditionalIndex) {
  const opening = rows[conditionalIndex + 1];
  if (opening?.text !== "{") throw error(rows[conditionalIndex]?.path || "",
    opening?.line ?? rows[conditionalIndex]?.line, "Expected { on following line.");
  let level = 1;
  for (let i = conditionalIndex + 2; i < rows.length; i++) {
    if (rows[i].text === "{") level++;
    else if (rows[i].text === "}" && --level === 0)
      return { start: conditionalIndex + 2, end: i, next: i + 1 };
  }
  throw Error("Unclosed dialogue branch.");
}

function extractLines(rows, start, end, path) {
  const lines = [], portraits = new Map(), frozen = new Map();
  const speaker = slot =>
    portraits.get(slot.toLowerCase()) ||
      (slot.replace(/mwinid\d*$/i, "") || slot);
  const flush = (slot, fallbackLine) => {
    const key = slot.toLowerCase(), entry = frozen.get(key);
    if (!entry) return;
    if (entry.text) lines.push({ speaker: speaker(slot), text: entry.text,
      path, line: entry.line ?? fallbackLine });
    frozen.delete(key);
  };
  for (let i = start; i < end; i++) {
    const row = rows[i];
    const text = row.text;
    const slotArt = text.match(new RegExp("^"+ident+"->setMwin\\s*\\(\\s*("+ident+")\\s*,\\s*(\"[^\"]*\")\\s*\\)\\s*;?$", "i"));
    if (slotArt) {
      const name = quotes(slotArt[2]);
      if (name) portraits.set(slotArt[1].toLowerCase(),
        name.replace(/.*[\\/]/, "").replace(/\.[^.]+$/, "").replace(/^mwin/i, ""));
    }
    const freeze = text.match(new RegExp("^"+ident+"->freezeMwin\\s*\\(\\s*("+ident+")\\s*,\\s*([01])\\s*\\)\\s*;?$", "i"));
    if (freeze) {
      if (freeze[2] === "1") frozen.set(freeze[1].toLowerCase(),
        { text: "", line: null });
      else flush(freeze[1], row.line);
      continue;
    }
    const say = text.match(new RegExp("^"+ident+"->setTxt\\s*\\(\\s*("+ident+")\\s*,\\s*(\"(?:[^\"\\\\]|\\\\.)*\"|eNewLine)\\s*(?:,\\s*eSkipEOT\\s*)?\\)\\s*;?$", "i"));
    if (!say) continue;
    const message = /^enewline$/i.test(say[2]) ? "\n" : quotes(say[2]);
    if (message === null) throw error(path, row.line, "Unsupported dialogue string.");
    const active = frozen.get(say[1].toLowerCase());
    if (active) {
      active.text += message;
      if (active.line === null) active.line = row.line;
    } else lines.push({ speaker: speaker(say[1]), text: message,
      path, line: row.line });
  }
  if (frozen.size) throw error(path, rows[end - 1]?.line ?? 1,
    "Unclosed frozen message window.");
  return lines;
}

const knownStatements = [
  /^#include\s*\(\s*"[^"]+"\s*\)\s*;?$/i,
  new RegExp("^"+ident+"->(?:setMwin|setProfile|setTextMode|setDelay|freezeMwin)\\s*\\(.*\\)\\s*;?$", "i"),
  new RegExp("^"+ident+"->setTxt\\s*\\(\\s*"+ident+"\\s*,\\s*(?:\"(?:[^\"\\\\]|\\\\.)*\"|eNewLine)\\s*(?:,\\s*eSkipEOT\\s*)?\\)\\s*;?$", "i"),
  new RegExp("^"+ident+"->Close\\s*\\(\\s*\\)\\s*;?$", "i"),
  /^clues\s*\+\+\s*;?$/i,
  new RegExp("^"+ident+"\\s*\\+\\+\\s*;?$", "i"),
  new RegExp("^"+ident+"\\s*\\[\\s*"+ident+"\\s*\\]\\s*\\+\\+\\s*;?$", "i"),
  new RegExp("^"+ident+"\\s*=\\s*getTickCount\\s*\\(\\s*\\)\\s*;?$", "i"),
  new RegExp("^"+ident+"\\s*=\\s*getTickCount\\s*\\(\\s*\\)\\s*-\\s*"+ident+"\\s*;?$", "i"),
  new RegExp("^"+ident+"\\s*=\\s*-?\\d+\\s*;?$", "i"),
  new RegExp("^if\\s*\\(\\s*"+ident+"\\s*>\\s*"+ident+"\\s*\\)\\s*$", "i"),
  new RegExp("^if\\s*\\(\\s*"+ident+"\\s*\\[\\s*"+ident+"\\s*\\]\\s*==\\s*0\\s*\\)\\s*$", "i"),
  /^(?:\{|\}|else)$/i,
  new RegExp("^"+ident+"\\s*\\(\\s*\"(?:[^\"\\\\]|\\\\.)*\"\\s*\\)\\s*;?$", "i"),
  new RegExp("^local\\s*\\(\\s*"+ident+"\\s*\\)\\s*;?$", "i"),
  new RegExp("^playerLocation\\s*\\(\\s*\"[^\"]+\"\\s*,\\s*"+ident+"\\s*,\\s*"+ident+"\\s*,\\s*"+ident+"\\s*\\)\\s*;?$", "i"),
  /^send\s*\(\s*"[^"]+\.brd"\s*,\s*[A-Za-z_]\w*\s*,\s*[A-Za-z_]\w*\s*,\s*[A-Za-z_]\w*\s*\)\s*;?$/i,
];

export function compileLegacyDialogue(program, artifacts, definitions, scene = null) {
  const path = program?.path ?? "(unresolved PRG)";
  const source = sourceOf(program);
  if (source === null) return { ok: false, diagnostic: error(path, 1, "No decoded dialogue PRG.") };
  const rows = normalized(source);
  try {
    if (rows.length > 220) throw error(path, 221, "Dialogue subset limited to 220 lines.");
    const inc = checkIncludeMethods(artifacts, path, rows, ["setTxt", "updateClues"]);
    for (const row of rows) {
      if (!knownStatements.some(re => re.test(row.text)))
        throw error(path, row.line, "Unsupported legacy dialogue statement: " + row.text);
    }
    const checked = rows.findIndex(row =>
      /^if\s*\(\s*[A-Za-z_]\w*\s*\[\s*[A-Za-z_]\w*\s*\]\s*==\s*0\s*\)$/i.test(row.text));
    let first, repeat = [], event = null, checkName = null, lastTick = null, threshold = 0, once = null;
    if (checked !== -1) {
      const m = rows[checked].text.match(/^if\s*\(\s*(\w+)\s*\[\s*(\w+)\s*\]\s*==\s*0\s*\)$/i);
      checkName = m[1].toLowerCase();
      event = m[2].toLowerCase();
      const index = definitions.constants[event];
      if (!Number.isInteger(index) || index < 0 || index >= definitions.constants.maxclues)
        throw error(path, rows[checked].line, "Event index " + event + " is not defined by source startup.");
      const firstBlock = bodyAt(rows, checked);
      const elseRow = rows[firstBlock.next];
      if (elseRow?.text?.toLowerCase() !== "else") throw error(path,
        elseRow?.line ?? rows[checked].line, "Missing repeat dialogue branch.");
      const repeatBlock = bodyAt(rows, firstBlock.next);
      first = extractLines(rows, firstBlock.start, firstBlock.end, path);
      repeat = extractLines(rows, repeatBlock.start, repeatBlock.end, path);
      const delta = rows.find(row => /=\s*getTickCount\(\)\s*-/.test(row.text));
      const tail = rows.find(row => /\w+\s*=\s*getTickCount\(\)/.test(row.text) &&
        !row.text.includes("-"));
      const guard = rows.find(row => /^if\s*\(\s*\w+\s*>\s*\w+\s*\)$/i.test(row.text));
      if (!delta || !tail || !guard ||
          !new RegExp("^"+m[1]+"\\s*\\[\\s*"+m[2]+"\\s*\\]\\s*\\+\\+\\s*;?$", "i")
            .test(rows.find(row => new RegExp("^"+m[1]+"\\s*\\[", "i").test(row.text) &&
              /(\+\+)\s*;?$/.test(row.text))?.text || "")) {
        throw error(path, rows[checked].line, "Incomplete source cooldown / visit mutation.");
      }
      const deltaMatch = delta.text.match(/=\s*getTickCount\(\)\s*-\s*(\w+)/);
      const guardMatch = guard.text.match(/>\s*(\w+)\s*\)/);
      const tailMatch = tail.text.match(/^(\w+)\s*=/);
      if (deltaMatch?.[1]?.toLowerCase() !== tailMatch?.[1]?.toLowerCase())
        throw error(path, delta.line, "Talk clock read/write variables differ.");
      lastTick = tailMatch[1].toLowerCase();
      const key = guardMatch?.[1]?.toLowerCase();
      threshold = definitions.constants[key];
      if (!Number.isFinite(threshold) || threshold < 0)
        throw error(path, guard.line, "Talk threshold " + key + " not initialized from startup.");
    } else {
      first = extractLines(rows, 0, rows.length, path);
      const onceRow = rows.find(row => /^([A-Za-z_]\w*)\s*=\s*1\s*;?$/.test(row.text));
      if (!onceRow) throw error(path, rows[0]?.line ?? 1,
        "Ungated opening dialogue needs a source one-time assignment.");
      once = onceRow.text.match(/^(\w+)/)[1].toLowerCase();
      // The special case from source is a self-transfer using the
      // current player's position. Do not silently skip other transfers.
      const send = rows.find(row => /^send\s*\(/i.test(row.text));
      if (send) {
        const args = send.text.match(/^send\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)\s*;?$/i);
        const playerLoc = rows.find(row => /^playerLocation\s*\(/i.test(row.text));
        const pos = playerLoc?.text.match(/^playerLocation\s*\(\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)\s*;?$/i);
        const root = scene?.boardPath?.match(/^(.*\/)Boards\/[^/]+\.brd$/i)?.[1];
        const dest = args && root ?
          resolveAsset([...artifacts.keys()], "Boards", args[1], root) : null;
        if (!args || !pos || !scene?.ok || !root ||
            pos[1].toLowerCase() !== scene.characterName?.toLowerCase() ||
            args.slice(2).some((value, i) => value.toLowerCase() !==
              pos[i + 2].toLowerCase()) ||
            dest?.status !== "resolved" || dest.path !== scene.boardPath)
          throw error(path, send.line, "Opening Send must use the current player's sourced location and the same resolved board.");
      }
    }
    if (!first.length || (checked !== -1 && !repeat.length))
      throw error(path, rows[0]?.line ?? 1, "Missing first/repeat SetTxt dialogue.");
    const clueLine = rows.find(row => /^clues\s*\+\+\s*;?$/i.test(row.text));
    const clueCall = rows.find(row => /^updateClues\s*\(/i.test(row.text));
    if (!clueLine || !clueCall)
      throw error(path, rows[0]?.line ?? 1, "No source clue increment and updateClues call.");
    const clueText = clueCall.text.match(/^updateClues\s*\(\s*("(?:[^"\\]|\\.)*")\s*\)\s*;?$/i);
    if (!clueText || quotes(clueText[1]) === null)
      throw error(path, clueCall.line, "Unsupported source clue text expression.");
    if (checked !== -1) {
      const firstRegion = bodyAt(rows, checked);
      if (rows.indexOf(clueLine) < firstRegion.start || rows.indexOf(clueLine) >= firstRegion.end)
        throw error(path, clueLine.line, "Source clue increment is outside first-visit branch.");
    }
    const helper = inc.find(entry => /\bmethod\s+updateClues\s*\(/i.test(entry.text));
    const win = helper?.text.match(/if\s*\(\s*remainingclues\s*==\s*0\s*\)[\s\S]*?\b([A-Za-z_]\w*)\s*=\s*1\b/i);
    return {
      ok: true, path, first, repeat, checked: checkName, event,
      eventIndex: event === null ? null : definitions.constants[event],
      lastTick, threshold, once, clueText: quotes(clueText[1]),
      awardFlag: win?.[1]?.toLowerCase() ?? null,
      sourceLines: { clue: clueLine.line, update: clueCall.line },
      // No arbitrary plugin/helper/class function is executed.
    };
  } catch (e) {
    return { ok: false, diagnostic: e?.path && e?.line ? e :
      error(path, rows[0]?.line ?? 1, e?.message || String(e)) };
  }
}

export function initialLegacyDialogueState(definitions, previousVariables = {}) {
  const max = definitions.constants.maxclues;
  return {
    variables: { ...previousVariables, clues: 0, maxclues: max,
      checked: Array(max).fill(0) },
    lastTalk: {}, dialogue: null, clueMessage: null, diagnostic: null,
  };
}

export function currentLegacyDialogue(state) {
  const dialogue = state?.dialogue;
  return dialogue?.lines[dialogue.index] ?? null;
}

export function openLegacyDialogue(state, plan, now) {
  if (!plan?.ok) return { status: "unsupported", state };
  if (state.dialogue) return { status: "busy", state };
  if (!Number.isFinite(now) || now < 0)
    return { status: "error", state: { ...state,
      diagnostic: error(plan.path, 1, "Invalid monotonic clock.") } };
  const previous = plan.lastTick === null ? null : state.lastTalk[plan.lastTick];
  if (previous !== undefined && previous !== null && now - previous <= plan.threshold)
    return { status: "cooldown", state, remainingMs:
      Math.max(1, Math.floor(plan.threshold - (now - previous)) + 1) };
  if (plan.once && state.variables[plan.once]) return { status: "already-visited", state };
  const first = plan.eventIndex === null || !(state.variables[plan.checked]?.[plan.eventIndex] ?? 0);
  const lines = first ? plan.first : plan.repeat;
  return { status: "waiting", state: { ...state, clueMessage: null, diagnostic: null,
    dialogue: { path: plan.path, plan, first, lines, index: 0 } } };
}

export function advanceLegacyDialogue(state, now) {
  const d = state.dialogue;
  if (!d) return { status: "inactive", state };
  if (d.index + 1 < d.lines.length) return {
    status: "waiting", state: { ...state,
      dialogue: { ...d, index: d.index + 1 } },
  };
  const vars = { ...state.variables };
  if (d.plan.once) vars[d.plan.once] = 1;
  if (d.plan.eventIndex !== null) {
    const current = [...(vars[d.plan.checked] ?? [])];
    current[d.plan.eventIndex] = (current[d.plan.eventIndex] ?? 0) + 1;
    vars[d.plan.checked] = current;
  }
  if (d.first) {
    vars.clues = (Number(vars.clues) || 0) + 1;
    if (d.plan.awardFlag && vars.clues === vars.maxclues)
      vars[d.plan.awardFlag] = 1;
  }
  return { status: "completed", clueGained: d.first,
    state: { ...state, variables: vars, dialogue: null,
      lastTalk: d.plan.lastTick ? { ...state.lastTalk,
        [d.plan.lastTick]: now } : state.lastTalk,
      clueMessage: d.first ? d.plan.clueText : null },
  };
}
