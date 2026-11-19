import { mainFileBindings } from "./model.mjs";
import { initialTk3ScriptState, startTk3Script }
  from "./tk3-script-slice.mjs";

// Resolve the configured entry and use the same runtime as later triggers.
// Pinned source: trans3/app/winmain.cpp setUpGame() lines 293-339.
// The browser host handles yielded effects after committing its scene.
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

  const binding = new Map(mainFileBindings(main, artifacts, scene.projectRoot))
    .get("Configured startup");
  // Native setUpGame simply skips the startup stage when the GAM field is
  // empty, then opens its configured initial board normally.
  if (binding?.status === "unset") {
    return { ok: true, status: "skipped", startupPath: null,
      scriptSession: initialTk3ScriptState() };
  }

  // When a root-level GAM names a missing startup PRG, its board
  // binding still establishes the game's asset root. Use that evidence
  // in the displayed path rather than guessing "Prg/" at ZIP root.
  const boardRoot = scene.boardPath?.match(/^(.*\/)Boards\/[^/]+\.brd$/i)?.[1];
  const mainRoot = main.path.includes("/") ?
    main.path.slice(0, main.path.lastIndexOf("/") + 1) : "";
  const fallback = (scene.projectRoot ?? boardRoot ?? mainRoot) +
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
  const step = startTk3Script(initialTk3ScriptState(), source, path,
    { artifacts, projectRoot: scene.projectRoot });
  if (step.status === "error") return { ok: false, diagnostic: step.state.diagnostic };
  return { ok: true, status: step.status, startupPath: path,
    scriptSession: step.state, step };
}
