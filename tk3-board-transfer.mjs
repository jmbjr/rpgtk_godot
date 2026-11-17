import { resolveAsset } from "./model.mjs";
import { buildPlayableScene } from "./playable-scene.mjs";
import { rejectTk3Transfer, resumeTk3Transfer } from "./tk3-script-slice.mjs";

// Pure, UI-free, transactional Send() bridge. The current board is retained
// whenever a destination is missing/ambiguous/unsupported or invalid.
// Native Source: trans3/rpgcode/functions.cpp::send; coords.cpp::tileToPixel
// and CProgram.cpp::run (the loop continues after Send).
export function resolveTk3BoardTransfer(response, currentScene, artifacts, graph,
  { deferResume = false } = {}) {
  if (response?.status !== "transfer" || !response.transfer)
    return { ...response, scene: currentScene };
  const transfer = response.transfer;
  const fail = detail => ({
    ...rejectTk3Transfer(response.state, transfer, "Send(): " + detail),
    scene: currentScene,
  });
  const rootMatch = currentScene?.boardPath?.match(/^(.*\/)?Boards\/[^/]+\.brd$/i);
  if (!currentScene?.ok || !rootMatch) return fail("Source board is not a valid archive BRD path.");
  const file = transfer.file;
  if (typeof file !== "string" || !/^[^\\/:*?"<>|]+\.brd$/i.test(file) ||
      file === "." || file.includes(".."))
    return fail("Destination must name one ordinary .brd file in the game Boards folder.");
  // resolveAsset is the same archive resolver used by mainFileBindings.
  // The project root follows the current source board, so a duplicate
  // basename from a different included game cannot hijack a Send().
  const root = currentScene.projectRoot ?? rootMatch[1] ?? "";
  const resolved = resolveAsset([...artifacts.keys()], "Boards", file, root);
  if (resolved.status !== "resolved")
    return fail("Destination " + JSON.stringify(file) + " is " + resolved.status + ".");
  const board = artifacts.get(resolved.path);
  if (board?.type !== "brd" || board.decodeStatus !== "decoded" || board.error)
    return fail("Destination " + resolved.path + " is unsupported or could not be decoded.");
  // coords::tileToPixel() with PX_ABSOLUTE (type 4) does not alter x/y;
  // native Send casts to int first, so use truncation. Reject instead
  // of Toolkit's x/y=32 fallback, to keep the current scene intact.
  if (board.coordinateType !== 4)
    return fail("Destination " + resolved.path + " uses unsupported non-absolute coordinates.");
  const values = [transfer.x, transfer.y, transfer.layer];
  if (values.some(x => typeof x !== "number" || !Number.isFinite(x)))
    return fail("Position and layer must evaluate to finite numeric values.");
  const [x, y, layer] = values.map(Math.trunc);
  if (layer < 1 || layer > board.layers)
    return fail("Layer " + layer + " is outside destination layer range 1.." + board.layers + ".");
  if (x < 1 || x > board.width * 32 || y < 1 || y > board.height * 32)
    return fail("Coordinates (" + x + ", " + y + ") are outside destination bounds.");
  const main = artifacts.get(currentScene.mainPath);
  const next = buildPlayableScene(artifacts, graph, main,
    { projectRoot: currentScene.projectRoot, boardPath: resolved.path, start: { x, y, layer } });
  if (!next.ok) return fail("Destination " + resolved.path +
    " is not playable: " + next.issues.map(i => i.detail).join("; "));
  const continued = deferResume ? response : resumeTk3Transfer(response.state);
  return {
    ...continued, scene: next,
    fromBoardPath: currentScene.boardPath,
    toBoardPath: resolved.path,
    spawn: { x, y, layer },
    transferred: true,
  };
}
