import { mainFileBindings } from "./model.mjs";
import { compileTk3Interaction, initialTk3ScriptState, startTk3Script }
  from "./tk3-script-slice.mjs";

// A deliberately bounded, UI-independent approximation of the normal
// Toolkit 3.1 launch order: GAM startup runs before first-board gameplay.
// Pinned source: trans3/app/winmain.cpp setUpGame() lines 293-339.
// Only synchronous scalar assignment and basic if/else are accepted here.
// Runtime Wait, Send, Load, Run, object methods and plugins remain separate
// slices. Refuse them before *any* startup side effects take place.
const allowed = new Set(["assign", "if", "jump"]);
const diagnostic = (path, line, reason) => ({
  path, line, message: reason,
  text: path + ":" + line + ": " + reason,
});

export function executeGamStartup(artifacts, scene) {
  if (!scene?.ok) {
    return { ok: false, diagnostic: diagnostic("(opening scene)", 1,
      "A resolved opening board is required before starting this bounded session.") };
  }
  const main = artifacts.get(scene.mainPath);
  if (main?.type !== "gam" || main.decodeStatus !== "decoded") {
    return { ok: false, diagnostic: diagnostic(scene.mainPath || "(Main File)", 1,
      "The source GAM is missing or unsupported.") };
  }

  const binding = new Map(mainFileBindings(main, [...artifacts.keys()]))
    .get("Configured startup");
  // Native setUpGame simply skips the startup stage when the GAM field is
  // empty, then opens its configured initial board normally.
  if (binding?.status === "unset") {
    return { ok: true, status: "skipped", startupPath: null,
      scriptSession: initialTk3ScriptState() };
  }

  const fallback = (main.path.includes("/") ?
    main.path.slice(0, main.path.lastIndexOf("/") + 1) : "") +
    "Prg/" + (main.startup || "(unset).prg");
  const path = binding?.path || fallback;
  if (binding?.status !== "resolved") {
    return { ok: false, diagnostic: diagnostic(path, 1,
      "GAM startup program is " + (binding?.status || "unresolved") +
      ": " + String(main.startup || "(unset)") + ".") };
  }
  const program = artifacts.get(path);
  if (program?.type !== "prg" || program.decodeStatus !== "decoded" ||
      program.error || !Array.isArray(program.program?.rows)) {
    return { ok: false, diagnostic: diagnostic(path, 1,
      "GAM startup program does not have decoded RPGCode source.") };
  }
  const source = program.program.rows.map(row => row.line).join("\n");
  const compiled = compileTk3Interaction(source, path);
  if (!compiled.ok) return { ok: false, diagnostic: compiled.diagnostic };

  const forbidden = compiled.instructions.find(node => !allowed.has(node.op));
  if (forbidden) return { ok: false, diagnostic: diagnostic(path, forbidden.line,
    "Startup statement " + forbidden.op + " requires lifecycle support not yet implemented; " +
    "only synchronous variable assignments and if/else are supported.") };

  const completed = startTk3Script(initialTk3ScriptState(), source, path);
  if (completed.status !== "completed") {
    return { ok: false, diagnostic: completed.state.diagnostic ??
      diagnostic(path, 1, "Startup did not complete synchronously.") };
  }
  return { ok: true, status: "completed", startupPath: path,
    scriptSession: completed.state };
}
