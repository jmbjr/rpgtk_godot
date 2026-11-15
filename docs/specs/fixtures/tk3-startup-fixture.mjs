import { buildScriptFixtureZip } from "./tk3-script-interaction-fixtures.mjs";

// Third independent, wholly synthetic TK3 Script Lab. Existing Harbor
// two-board ending and Grove first/repeat regression ZIPs are unchanged.
export const startupLabSpec = Object.freeze({
  id: "startup", root: "LanternLab", main: "LanternLab.gam",
  title: "Lantern Startup Lab", startup: "lantern_boot.prg",
  board: "twilight.brd", character: "nia.tem", characterName: "Nia",
  item: "lantern.itm", itemName: "Lantern", script: "lantern_answer.prg",
  position: Object.freeze({ x: 78, y: 45, layer: 1 }),
  variable: "lantern_checked",
  first: "Nia: A lantern waits in the twilight.",
  repeat: "Nia: The lantern still waits.",
  bootVariable: "lantern_ready",
  startedText: "Nia: The watch is ready. Startup lit the lantern.",
  directText: "Nia: The lantern is dark. Startup was skipped.",
});

export function sourceForStartupLab(spec = startupLabSpec) {
  return [
    "// The GAME ZIP provides this RPGCode, never the browser.",
    "if (" + spec.bootVariable + " == 1)",
    "{",
    "  mwin(" + JSON.stringify(spec.startedText) + ")",
    "  wait()",
    "  mwinCls()",
    "}",
    "else",
    "{",
    "  mwin(" + JSON.stringify(spec.directText) + ")",
    "  wait()",
    "  mwinCls()",
    "}",
    "",
  ].join("\n");
}

export function sourceForStartupPrg(spec = startupLabSpec) {
  return [
    "// Set a global scalar before the initial board is opened.",
    spec.bootVariable + " = 1",
    "",
  ].join("\n");
}

export async function buildStartupLabZip(spec = startupLabSpec) {
  const zip = await buildScriptFixtureZip(spec);
  zip.file(spec.root + "/Prg/" + spec.startup, sourceForStartupPrg(spec));
  zip.file(spec.root + "/Prg/" + spec.script, sourceForStartupLab(spec));
  return zip;
}
