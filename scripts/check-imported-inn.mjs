import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { initialMovementState, stepMovement } from "../experiments/movement-sandbox/engine.mjs";
import {
  INN_TALK_RANGE_PIXELS, INN_TALK_THRESHOLD_MS,
  initialInnState, currentInnMessage, conversationMessages, advanceInn,
} from "../experiments/movement-sandbox/inn-dialogue.mjs";
import {
  authoredInnWorld, nearAuthoredInn, activateAuthoredInn,
} from "../experiments/movement-sandbox/imported-inn.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { character28, nativeAnims, testTileset }
  from "../docs/specs/fixtures/native-character-28-fixtures.mjs";
import { nativeItem27 } from "../docs/specs/fixtures/native-item-27-fixtures.mjs";

const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
zip.file("BSTW/Prg/menuTitle.prg", "# synthetic source");
zip.file("BSTW/Boards/start.brd", board24Fixtures.standard);
zip.file("BSTW/Chrs/bruce.tem", character28);
zip.file("BSTW/Item/jim.itm", nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Item/door.itm", nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Prg/mwininn.prg", "# synthetic script only");
zip.file("BSTW/Prg/sideDoor.prg", "# another synthetic script");
zip.file("BSTW/Tiles/test-characters.tst", testTileset);
zip.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
for (const [name, bytes] of nativeAnims)
  zip.file("BSTW/Misc/" + name, bytes);

const { artifacts } = await readArtifacts(zip, {});
const originalBoard = artifacts.get("BSTW/Boards/start.brd");
const board = {
  ...originalBoard,
  sprites: originalBoard.sprites.map(sprite => ({
    ...sprite, position: { ...sprite.position },
  })),
  refs: originalBoard.refs.map(ref => ({ ...ref })),
};
// Move the synthetic inn *inside* the tiny 3×2 test map. These are
// deliberately not the owner's 207,349 coordinates.
board.sprites[1].position = { x: 80, y: 40, layer: 1 };
board.sprites[1].activationProgram = "mwininn.prg";
board.refs = board.refs.map(ref =>
  ref.evidence === "Native sprite activation program · slot 1" ?
    { ...ref, value: "mwininn.prg" } : ref);
// Same ITM, different program: cannot trigger the inn.
board.sprites.push({
  ...board.sprites[1], slot: 2, activationProgram: "sideDoor.prg",
  position: { x: 10, y: 12, layer: 1 },
});
board.refs.push(
  { value: "door.itm", evidence: "Native board sprite · slot 2" },
  { value: "sideDoor.prg", evidence: "Native sprite activation program · slot 2" },
);
artifacts.set(board.path, board);
const graph = buildReferences(artifacts);
const scene = buildPlayableScene(artifacts, graph);
assert.equal(scene.ok, true, JSON.stringify(scene.issues));
assert.equal(scene.placements.length, 3);
assert.deepEqual(scene.placements.map(p => p.isInnDoor),
  [false, true, false], "Only the mwininn.prg placement is the inn");
assert.equal(scene.innStatus, "resolved");
assert.deepEqual(scene.innDoor, {
  slot: 1, position: { x: 80, y: 40, layer: 1 },
  itemPath: "BSTW/Item/door.itm", programPath: "BSTW/Prg/mwininn.prg",
});
assert.deepEqual(authoredInnWorld(scene)?.landmark,
  { x: 80, y: 40, layer: 1 });
assert.equal(INN_TALK_RANGE_PIXELS, 46);
assert.equal(INN_TALK_THRESHOLD_MS, 500);

const actor = { x: 80, y: 40, layer: 1 };
const remote = { x: 10, y: 12, layer: 1 };
assert.equal(nearAuthoredInn(actor, scene), true);
assert.equal(nearAuthoredInn(remote, scene), false,
  "Standing on the other door does not activate the inn");
assert.equal(activateAuthoredInn(initialInnState(), remote, 0, scene).outcome,
  "out-of-range");
assert.equal(nearAuthoredInn({ ...actor, layer: 2 }, scene), false);
assert.equal(activateAuthoredInn(initialInnState(),
  { ...actor, layer: 2 }, 0, scene).outcome, "out-of-range");
assert.equal(nearAuthoredInn({ x: 80 - 46, y: 40, layer: 1 }, scene), true);
assert.equal(nearAuthoredInn({ x: 80 - 46.01, y: 40, layer: 1 }, scene), false);
assert.equal(nearAuthoredInn({ x: NaN, y: 40, layer: 1 }, scene), false);
assert.equal(nearAuthoredInn({ x: 80, y: Infinity, layer: 1 }, scene), false);

// The original movement model stays in use; the actor's layer is
// separate metadata and does not silently change on interaction.
const initial = initialMovementState(scene.world);
assert.equal(nearAuthoredInn({ ...initial, layer: scene.start.layer }, scene), false);
const walked = stepMovement(initial, { x: 1, y: 0 }, 1 / 60, scene.world);
assert.ok(walked.x > initial.x);
assert.ok(walked.x < scene.world.width * 32);
assert.equal(walked.y, initial.y);

let state = initialInnState();
const opened = activateAuthoredInn(state, actor, 0, scene);
assert.deepEqual([opened.outcome, opened.kind], ["opened", "first"]);
state = opened.state;
assert.equal(currentInnMessage(state)?.speaker, "Bruce");
assert.equal(conversationMessages(state.conversation).length, 4);
assert.equal(state.clues, 0);
assert.equal(state.checkedInn, 0);
assert.equal(activateAuthoredInn(state, actor, 1, scene).outcome, "busy");
for (const tick of [1, 2, 3]) {
  const progressed = advanceInn(state, tick);
  assert.equal(progressed.outcome, "advanced");
  state = progressed.state;
  assert.equal(state.clues, 0);
}
const firstEnd = advanceInn(state, 4);
assert.deepEqual([firstEnd.outcome, firstEnd.clueGained],
  ["completed", true]);
state = firstEnd.state;
assert.deepEqual([state.clues, state.checkedInn, state.lastInnTalkMs],
  [1, 1, 4]);
assert.equal(state.conversation, null);
for (const tick of [4, 503, 504]) {
  assert.equal(activateAuthoredInn(state, actor, tick, scene).outcome,
    "cooldown", "Must reject elapsed <=500 ms, including equality");
}
const repeat = activateAuthoredInn(state, actor, 505, scene);
assert.deepEqual([repeat.outcome, repeat.kind], ["opened", "repeat"]);
state = repeat.state;
assert.equal(state.clueMessage, null);
assert.equal(conversationMessages(state.conversation).length, 3);
for (const tick of [506, 507]) state = advanceInn(state, tick).state;
const repeatEnd = advanceInn(state, 508);
assert.deepEqual([repeatEnd.outcome, repeatEnd.clueGained],
  ["completed", false]);
state = repeatEnd.state;
assert.deepEqual([state.clues, state.checkedInn, state.lastInnTalkMs],
  [1, 2, 508], "Repeat never awards a second clue");

// Reset AND fresh mounts both use an independent initial state.
state = initialInnState();
assert.deepEqual([state.clues, state.checkedInn, state.lastInnTalkMs,
  state.conversation, state.clueMessage], [0, 0, null, null, null]);
assert.equal(activateAuthoredInn(state, actor, 0, scene).kind, "first");
assert.deepEqual(initialInnState(), state);

// Unresolved script, wrong script and ambiguous scripts cannot enable Talk.
const missingProgram = new Map(artifacts);
missingProgram.delete("BSTW/Prg/mwininn.prg");
const missingScene = buildPlayableScene(missingProgram, buildReferences(missingProgram));
assert.equal(missingScene.ok, true);
assert.equal(missingScene.innDoor, null);
assert.equal(authoredInnWorld(missingScene), null);
assert.equal(nearAuthoredInn(actor, missingScene), false);
assert.equal(activateAuthoredInn(state, actor, 0, missingScene).outcome,
  "unavailable");

const noInnArtifacts = new Map(artifacts);
const notInn = {
  ...board,
  sprites: board.sprites.map(p => p.slot === 1 ?
    { ...p, activationProgram: "sideDoor.prg" } : p),
  refs: board.refs.map(ref =>
    ref.evidence === "Native sprite activation program · slot 1" ?
      { ...ref, value: "sideDoor.prg" } : ref),
};
noInnArtifacts.set(board.path, notInn);
const otherOnly = buildPlayableScene(noInnArtifacts, buildReferences(noInnArtifacts));
assert.equal(otherOnly.innDoor, null);
assert.equal(nearAuthoredInn(actor, otherOnly), false);

const ambiguousArtifacts = new Map(artifacts);
ambiguousArtifacts.set(board.path, {
  ...board,
  sprites: board.sprites.map(p => p.slot === 2 ?
    { ...p, activationProgram: "mwininn.prg" } : p),
  refs: board.refs.map(ref =>
    ref.evidence === "Native sprite activation program · slot 2" ?
      { ...ref, value: "mwininn.prg" } : ref),
});
const ambiguous = buildPlayableScene(ambiguousArtifacts, buildReferences(ambiguousArtifacts));
assert.equal(ambiguous.innStatus, "ambiguous");
assert.equal(ambiguous.innDoor, null);
assert.equal(activateAuthoredInn(state, actor, 0, ambiguous).outcome,
  "unavailable");
// No borrowed state from previous test case, scene or browser mount.
assert.deepEqual(initialInnState(), state);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const client = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
for (const id of ["play-talk", "play-hud", "play-feedback", "play-dialogue",
  "play-dialogue-speaker", "play-dialogue-text", "play-dialogue-progress", "play-reset"])
  assert.match(html, new RegExp('id="' + id + '"'));
assert.match(client, /nearAuthoredInn/);
assert.match(client, /activateAuthoredInn/);
assert.match(client, /inn\.conversation \|\| legacy\?\.dialogue/,
  "The imported inn and generic script must both freeze walking during dialogue");
assert.match(client, /if \(!event\.repeat\) interact\(\)/);
assert.match(client, /event\.code === "KeyE" \|\| event\.code === "Space"/);
assert.match(client, /talkButton\.addEventListener\("click", interact/);
assert.match(client, /inn = initialInnState\(\)/);

// The optional local production JS path reads the owner's original archive
// without copying it into the repository or passing it to GitHub Actions.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const original = await openGameArchive(bytes, b => JSZip.loadAsync(b));
  const real = (await readArtifacts(original, {})).artifacts;
  const game = buildPlayableScene(real, buildReferences(real));
  assert.equal(game.ok, true, JSON.stringify(game.issues));
  assert.deepEqual(game.innDoor, {
    slot: 3, position: { x: 207, y: 349, layer: 1 },
    itemPath: "BSTW/Item/door.itm", programPath: "BSTW/Prg/mwininn.prg",
  });
  assert.deepEqual(game.placements.filter(p => p.filename.toLowerCase() === "door.itm")
    .map(p => [p.slot, p.isInnDoor]), [[3, true], [4, false], [5, false]]);
  assert.equal(nearAuthoredInn({ x: 207, y: 349, layer: 1 }, game), true);
  assert.equal(nearAuthoredInn({ x: 207, y: 349, layer: 2 }, game), false);
  const realOpened = activateAuthoredInn(initialInnState(),
    { x: 207, y: 349, layer: 1 }, 0, game);
  assert.equal(realOpened.kind, "first");
  console.log("Original BSTW production JS: resolved unique inn (slot 3, 207,349,L1), other two doors excluded, same-layer dialogue adapter opens.");
}
console.log("Imported inn passed: resolved-only door, same-layer/46px range, four-line first and three-line repeat, strict >500ms cooldown, single clue, reset and touch/keyboard UI contract.");
