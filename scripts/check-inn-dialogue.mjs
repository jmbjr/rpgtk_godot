import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { initialMovementState, circleBlocked } from "../experiments/movement-sandbox/engine.mjs";
import { SANDBOX_WORLD } from "../experiments/movement-sandbox/world.mjs";
import {
  INN_CHECKED_INDEX, INN_CLUE, INN_MAX_CLUES, INN_SCRIPT_SOURCE,
  INN_TALK_RANGE_PIXELS, INN_TALK_THRESHOLD_MS,
  initialInnState, nearInn, conversationMessages, currentInnMessage,
  activateInn, advanceInn,
} from "../experiments/movement-sandbox/inn-dialogue.mjs";

const contract = JSON.parse(await readFile(new URL(
  "../experiments/movement-sandbox/inn-contract.json", import.meta.url), "utf8"));
assert.equal(contract.kind, "prototype-interaction-contract");
assert.equal(contract.notDodgeConformant, true);
assert.equal(contract.syntheticPolicies.interactionDistancePixels, INN_TALK_RANGE_PIXELS);
assert.equal(contract.sourceEvidence.sha256, "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
assert.deepEqual(contract.sourceEvidence.sourceLines.cooldown,
  INN_SCRIPT_SOURCE.sourceLines.cooldown);
assert.deepEqual(contract.sourceEvidence.sourceLines.firstDialog,
  INN_SCRIPT_SOURCE.sourceLines.firstDialogue);
assert.equal(contract.commands.length, 2);
assert.ok(contract.limitations.some(line => line.includes("not interpret")));
const world = SANDBOX_WORLD;
assert.deepEqual([INN_TALK_THRESHOLD_MS, INN_CHECKED_INDEX, INN_MAX_CLUES],
  [500, 10, 13]);
assert.equal(INN_TALK_RANGE_PIXELS, 46);
assert.equal(INN_SCRIPT_SOURCE.target, "BSTW/Prg/mwininn.prg");
assert.equal(INN_SCRIPT_SOURCE.definition, "BSTW/Prg/init.prg");
assert.deepEqual(INN_SCRIPT_SOURCE.sourceLines.clueUpdate, [42, 43]);
assert.deepEqual(INN_SCRIPT_SOURCE.sourceLines.onComplete, [76, 77]);
assert.ok(INN_SCRIPT_SOURCE.limitations.some(line => /not.*RPGCode/i.test(line)));

const remote = initialMovementState();
const near = {
  ...remote, x: world.landmark.x, y: world.landmark.y + 32,
};
assert.ok(!circleBlocked(world, near.x, near.y));
assert.equal(nearInn(remote), false);
assert.equal(nearInn(near), true);
assert.equal(nearInn({ x: world.landmark.x + 46, y: world.landmark.y }), true);
assert.equal(nearInn({ x: world.landmark.x + 46.01, y: world.landmark.y }), false);
assert.equal(nearInn({ x: NaN, y: world.landmark.y }), false);
assert.equal(nearInn({ x: Infinity, y: world.landmark.y }), false);

const fresh = initialInnState();
assert.deepEqual(fresh, {
  checkedInn: 0, clues: 0, maxClues: 13,
  lastInnTalkMs: null, conversation: null, clueMessage: null,
});
assert.equal(currentInnMessage(fresh), null);
assert.deepEqual(conversationMessages(null), []);
assert.equal(advanceInn(fresh, 0).outcome, "inactive");
assert.strictEqual(advanceInn(fresh, 0).state, fresh);
const tooFar = activateInn(fresh, remote, 123);
assert.equal(tooFar.outcome, "out-of-range");
assert.strictEqual(tooFar.state, fresh);
assert.throws(() => activateInn(fresh, near, NaN), /tick/i);
assert.throws(() => activateInn(fresh, near, -1), /tick/i);
assert.throws(() => advanceInn(fresh, Infinity), /tick/i);
assert.equal(fresh.checkedInn, 0, "Pure functions never mutate their input");

let { state, outcome, kind } = activateInn(fresh, near, 0);
assert.deepEqual([outcome, kind], ["opened", "first"]);
assert.equal(currentInnMessage(state)?.speaker, "Bruce");
assert.equal(conversationMessages(state.conversation).length, 4);
assert.equal(state.clues, 0, "Source increments clue after the first conversation ends");
assert.equal(state.checkedInn, 0, "Source increments checked[einn] only after closing");
assert.equal(activateInn(state, near, 1).outcome, "busy",
  "Repeated activate must not open an overlapping conversation");
assert.strictEqual(activateInn(state, near, 1).state, state);
for (let cursor = 1; cursor < 4; cursor++) {
  const before = state;
  const result = advanceInn(state, cursor);
  assert.equal(result.outcome, "advanced");
  state = result.state;
  assert.equal(state.conversation.index, cursor);
  assert.equal(state.clues, 0, "No clue before the final line is completed");
  assert.equal(state.checkedInn, 0);
  assert.notStrictEqual(state, before);
}
assert.equal(currentInnMessage(state).speaker, "Bruce");
const firstEnd = advanceInn(state, 4);
assert.deepEqual([firstEnd.outcome, firstEnd.kind, firstEnd.clueGained],
  ["completed", "first", true]);
state = firstEnd.state;
assert.equal(state.conversation, null);
assert.equal(state.checkedInn, 1);
assert.equal(state.clues, 1);
assert.equal(state.lastInnTalkMs, 4);
assert.equal(state.clueMessage, INN_CLUE);
assert.equal(advanceInn(state, 5).outcome, "inactive");
assert.strictEqual(advanceInn(state, 5).state, state);
assert.equal(fresh.clues, 0, "Original input remains unchanged");

for (const [now, expectedRemaining] of [
  [4, 501], [503, 2], [504, 1],
]) {
  const response = activateInn(state, near, now);
  assert.equal(response.outcome, "cooldown", "Strict >500 threshold at " + now);
  assert.equal(response.remainingMs, expectedRemaining);
  assert.strictEqual(response.state, state);
}
assert.equal(activateInn(state, remote, 505).outcome, "out-of-range",
  "Distance rejects even after cooldown");

const repeat = activateInn(state, near, 505);
assert.deepEqual([repeat.outcome, repeat.kind], ["opened", "repeat"]);
state = repeat.state;
assert.equal(state.clueMessage, null, "Opening a new conversation dismisses previous clue notification");
assert.equal(conversationMessages(state.conversation).length, 3);
assert.equal(state.checkedInn, 1, "Visit count changes on completion, not opening");
assert.equal(currentInnMessage(state).speaker, "Bruce");
for (const now of [506, 507]) {
  const result = advanceInn(state, now);
  assert.equal(result.outcome, "advanced");
  state = result.state;
}
const repeatEnd = advanceInn(state, 508);
assert.deepEqual([repeatEnd.outcome, repeatEnd.kind, repeatEnd.clueGained],
  ["completed", "repeat", false]);
state = repeatEnd.state;
assert.equal(state.checkedInn, 2);
assert.equal(state.clues, 1, "Repeated locked-door conversation must never award additional clues");
assert.equal(state.clueMessage, null);
assert.equal(state.lastInnTalkMs, 508);
assert.equal(activateInn(state, near, 1000).outcome, "cooldown");
assert.equal(activateInn(state, near, 1009).outcome, "opened");
assert.deepEqual(initialInnState(), fresh, "Reset must erase all dialogue, clue and visit state");

// Alternate caller state: already checked but no clue ever earned.
// Repeat does not silently award a clue based on absent historical data.
const resumed = {
  ...initialInnState(), checkedInn: 7, clues: 3, lastInnTalkMs: 1,
};
const res = activateInn(resumed, near, 502);
assert.equal(res.kind, "repeat");
let follow = res.state;
for (let i = 0; i < 3; i++) follow = advanceInn(follow, 503 + i).state;
assert.deepEqual([follow.checkedInn, follow.clues], [8, 3]);

// Browser contract: action controls, keyboard nonrepeat and stop-movement
// while chatting. Browser behavior still needs manual Android acceptance.
const html = await readFile(new URL("../sandbox.html", import.meta.url), "utf8");
const client = await readFile(new URL(
  "../experiments/movement-sandbox/sandbox.mjs", import.meta.url), "utf8");
const css = await readFile(new URL(
  "../experiments/movement-sandbox/sandbox.css", import.meta.url), "utf8");
for (const id of ["sandbox-talk", "sandbox-hud", "sandbox-dialogue",
  "sandbox-dialogue-speaker", "sandbox-dialogue-text", "sandbox-dialogue-progress"]) {
  assert.match(html, new RegExp('id="' + id + '"'), id);
}
assert.match(html, /E.*Space.*Talk/i);
assert.match(client, /event\.code === "KeyE" \|\| event\.code === "Space"/);
assert.match(client, /!event\.repeat\) interact\(\)/);
assert.match(client, /talkButton\.addEventListener\("click", interact\)/);
assert.match(client, /inn\.conversation \? \{ x: 0, y: 0 \}/);
assert.match(client, /inn = initialInnState\(\)/);
assert.match(css, /\.sandbox-dialogue/);
assert.match(css, /\.sandbox-talk/);

// Optional exact-owner-source acceptance: NO actual game data in CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(actualHash,
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const zip = await JSZip.loadAsync(bytes);
  const script = (await zip.file(INN_SCRIPT_SOURCE.target).async("uint8array"));
  const init = (await zip.file(INN_SCRIPT_SOURCE.definition).async("uint8array"));
  const decode = raw => new TextDecoder("windows-1252").decode(raw).split(/\r?\n/);
  const mwin = decode(script), definition = decode(init);
  const line = (arr, n) => arr[n - 1] ?? "";
  assert.match(line(mwin, 4), /getTickCount\(\).*LastinnTalk/i);
  assert.match(line(mwin, 8), /innDelta\s*>\s*ItemTalkThreshold/i);
  assert.match(line(mwin, 11), /checked\[einn\]\s*==\s*0/i);
  for (const n of INN_SCRIPT_SOURCE.sourceLines.firstDialogue)
    assert.match(line(mwin, n), /->SetTxt\(/i);
  for (const n of INN_SCRIPT_SOURCE.sourceLines.repeatDialogue)
    assert.match(line(mwin, n), /->SetTxt\(/i);
  assert.match(line(mwin, 42), /clues\s*\+\+/);
  assert.match(line(mwin, 43), /updateClues\(/);
  assert.match(line(mwin, 76), /LastinnTalk\s*=\s*getTickCount\(\)/);
  assert.match(line(mwin, 77), /checked\[einn\]\s*\+\+/);
  assert.match(line(definition, 48), /ItemTalkThreshold\s*=\s*500/);
  assert.match(line(definition, 60), /einn\s*=\s*10/);
  assert.match(line(definition, 78), /maxclues\s*=\s*13/i);
  console.log("Original BSTW source verified at 15 specified lines (read-only).");
}
console.log("Inn adapter passed: proximity, first/repeat speaker sequences, strict 500ms cooldown, " +
  "single clue on completion, visit count, reset, mobile controls and original-source evidence metadata.");
