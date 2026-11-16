import { mainFileBindings } from "./model.mjs";
import { startTk3Script } from "./tk3-script-slice.mjs";

// A GAM-declared runtime hotkey calls a PRG via the same source interpreter.
// Pinned Toolkit 3.1: trans3/common/mainfile.cpp 129-164,
// trans3/input/input.cpp 243-252. Browser keyboard/touch presentation is
// intentionally separate from DirectInput scan-code fidelity.
function error(path, line, message) {
  return { path, line, message, text: path + ":" + line + ": " + message };
}
function readableKey(raw) {
  if (!Number.isInteger(raw) || raw < 1 || raw > 255) return null;
  if (raw === 13) return "Enter";
  if (raw === 32) return "Space";
  if (raw >= 65 && raw <= 90 || raw >= 97 && raw <= 122)
    return String.fromCharCode(raw).toUpperCase();
  if (raw >= 48 && raw <= 57) return String.fromCharCode(raw);
  return null;
}

export function listTk3RuntimeKeys(scene, artifacts) {
  const main = artifacts?.get(scene?.mainPath);
  if (main?.type !== "gam" || main.decodeStatus !== "decoded" ||
      !main.configuration?.runtimeKeys) return [];
  const config = main.configuration;
  const refs = new Map(mainFileBindings(main, [...artifacts.keys()]));
  const rows = [
    { slot: -1, key: config.runtimeKeys.runKey,
      program: config.runtimeProgram, evidence: "Runtime program" },
    ...config.runtimeKeys.extended.map(entry => ({
      slot: entry.slot, key: entry.key, program: entry.program,
      evidence: "Runtime key · slot " + entry.slot,
    })),
  ];
  return rows.filter(row => row.program)
    .map(row => {
      const binding = refs.get(row.evidence);
      const archivePath = binding?.path ?? null;
      const source = archivePath ? artifacts.get(archivePath) : null;
      const status = binding?.status === "resolved" && source?.type === "prg" &&
        source.decodeStatus === "decoded" && !source.error &&
        Array.isArray(source.program?.rows) ? "resolved" :
        binding?.status === "resolved" ? "unsupported" :
        binding?.status || "missing";
      return { ...row, label: readableKey(row.key),
        path: archivePath, status };
    });
}

export function startTk3RuntimeKey(state, action, artifacts) {
  if (state.execution) return { status: "busy", state };
  const path = action.path || ("Prg/" + action.program);
  if (action.status !== "resolved")
    return { status: "error", state: { ...state, message: "", execution: null,
      diagnostic: error(path, 1, "GAM runtime program is " + action.status + ".") } };
  const source = artifacts.get(path);
  if (source?.type !== "prg" || !Array.isArray(source.program?.rows))
    return { status: "error", state: { ...state, message: "", execution: null,
      diagnostic: error(path, 1, "GAM runtime script has no decoded source.") } };
  return startTk3Script(state, source.program.rows.map(row => row.line).join("\n"), path);
}
