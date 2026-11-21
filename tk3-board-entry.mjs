export { boardEntryBinding } from "./tk3-behavior-bindings.mjs";
import { callTk3Program, resumeTk3Transfer, rejectTk3Effect } from "./tk3-script-slice.mjs";

// Same decoded binding/reference as Explorer; no filename or program-shape rules.
export function enterTk3Board(state, scene, artifacts) {
  const binding = scene.boardEntry;
  if (!binding || binding.status === "unset")
    return state.execution ? resumeTk3Transfer(state) : {status:"completed",state};
  const path = binding.path ?? scene.projectRoot + "Prg/" + binding.value;
  const program = artifacts.get(path);
  if (binding.status !== "resolved" || !program?.program?.rows || program.error)
    return rejectTk3Effect(state, {path,line:1}, "Board entry program is " + binding.status + ".");
  return callTk3Program(state, program.program.rows.map(row=>row.line).join("\n"), path,
    {artifacts, projectRoot:scene.projectRoot, sourceBoardPath:scene.boardPath});
}
