import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { resolveTk3BoardTransfer } from "../tk3-board-transfer.mjs";
import { initialMovementState, stepMovement } from "../experiments/movement-sandbox/engine.mjs";
import { initialInnState } from "../experiments/movement-sandbox/inn-dialogue.mjs";
import { TK3_INTERACTION_RADIUS, compileTk3Interaction, initialTk3ScriptState,
  startTk3Script, advanceTk3Script, selectTk3ScriptTarget, startPlacedTk3Script }
  from "../tk3-script-slice.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs, sourceForScriptFixture }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

assert.equal(TK3_INTERACTION_RADIUS, 46);
assert.equal(scriptFixtureSpecs.length, 2);
assert.notDeepEqual(scriptFixtureSpecs[0].position, scriptFixtureSpecs[1].position);
for (const property of ["root", "board", "character", "item", "script",
  "characterName", "variable", "first", "repeat"])
  assert.notEqual(scriptFixtureSpecs[0][property], scriptFixtureSpecs[1][property]);

const compiled = compileTk3Interaction([
  "if (counter == 0)", "{", 'mwin("First")', 'mwin("Second")',
  "wait()", "mwinCls()", "counter = counter + 1", "}",
  "else", "{", 'mwin("Again")', "wait()", "mwinCls()", "}",
].join("\n"), "Lab/Prg/demo.prg");
assert.equal(compiled.ok, true, compiled.diagnostic?.text);
let pure = startTk3Script(initialTk3ScriptState(),
  ["count = 0", 'mwin("One")', 'mwin("Two")',
    "wait()", "mwinCls()", "count = count + 1"].join("\n"), "Lab/Prg/state.prg");
assert.equal(pure.status, "waiting", pure.state.diagnostic?.text);
assert.equal(pure.state.message, "One\nTwo", "MWin stacks lines before wait()");
assert.equal(pure.state.variables.count, 0);
pure = advanceTk3Script(pure.state);
assert.equal(pure.status, "completed");
assert.equal(pure.state.variables.count, 1);
assert.equal(pure.state.message, "", "MWinCls clears message window");
assert.equal(pure.state.runs, 1);
assert.equal(advanceTk3Script(pure.state).status, "inactive");
const defaultLayer = startTk3Script(initialTk3ScriptState(),
  'Send("another.brd", 32, 48)', "Examples/Prg/send3.prg");
assert.equal(defaultLayer.status, "transfer");
assert.deepEqual(defaultLayer.transfer, {
  path: "Examples/Prg/send3.prg", line: 1, file: "another.brd",
  x: 32, y: 48, layer: 1,
}, "Source signature's optional fourth Send argument defaults to layer 1");


for (const [source, line] of [
  [['mwin("First")', "wait()", 'Teleport("other.brd",5,5)'].join("\n"), 3],
  [['mwin("First")', '#include "helpers.prg"'].join("\n"), 2],
  [['mwin("First")', 'myWin->SetTxt("Nope")'].join("\n"), 2],
  [['if (visits > 0)', "{", 'mwin("Invalid")', "}"].join("\n"), 1],
  [["if (visits == 0)", "{", "wait()"].join("\n"), 3],
  ['mwin("Hello") wait()', 1],
]) {
  const invalid = compileTk3Interaction(source, "Examples/Prg/bad.prg");
  assert.equal(invalid.ok, false, source);
  assert.equal(invalid.diagnostic.path, "Examples/Prg/bad.prg");
  assert.equal(invalid.diagnostic.line, line);
  assert.match(invalid.diagnostic.text, /Examples\/Prg\/bad.prg:\d+:/);
  const err = startTk3Script(initialTk3ScriptState(), source, "Examples/Prg/bad.prg");
  assert.equal(err.status, "error");
  assert.equal(err.state.execution, null);
}

for (const spec of scriptFixtureSpecs) {
  const fixture = await buildScriptFixtureZip(spec);
  const encoded = await fixture.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const zip = await openGameArchive(encoded, raw => JSZip.loadAsync(raw));
  const { artifacts } = await readArtifacts(zip, {});
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, spec.id + ": " + JSON.stringify(scene.issues));
  assert.equal(scene.characterName, spec.characterName);
  assert.equal(scene.boardPath, spec.root + "/Boards/" + spec.board);
  assert.equal(scene.characterPath, spec.root + "/Chrs/" + spec.character);
  assert.deepEqual([scene.board.width, scene.board.height], [3, 2]);
  const target = scene.placements.find(p => p.filename === spec.item);
  assert.ok(target);
  assert.equal(target.itemStatus, "resolved");
  assert.equal(target.programStatus, "resolved");
  assert.equal(target.programPath, spec.root + "/Prg/" + spec.script);
  assert.deepEqual(target.position, spec.position);
  const source = artifacts.get(target.programPath).program.rows.map(row => row.line).join("\n");
  assert.equal(source.trim(), sourceForScriptFixture(spec).trim());
  assert.equal(compileTk3Interaction(source, target.programPath).ok, true);
  const actor = { x: target.position.x, y: target.position.y, layer: target.position.layer };
  assert.equal(selectTk3ScriptTarget(scene, actor)?.slot, target.slot);
  // The pure generic selector must not depend on BSTW's inn classification;
  // only the browser interaction dispatcher gives that legacy adapter priority.
  const specialTag = { ...scene, placements: scene.placements.map(p =>
    p.slot === target.slot ? { ...p, isInnDoor: true } : p) };
  assert.equal(selectTk3ScriptTarget(specialTag, actor)?.slot, target.slot,
    "Source-linked generic interactions are independent of game-specific labels");
  assert.equal(selectTk3ScriptTarget(scene, { ...actor, layer: 2 }), null);
  assert.equal(selectTk3ScriptTarget(scene, { ...actor, x: actor.x - 46 })?.slot, target.slot);
  assert.equal(selectTk3ScriptTarget(scene, { ...actor, x: actor.x - 46.1 }), null);
  assert.equal(selectTk3ScriptTarget(scene, { x: NaN, y: 0, layer: 1 }), null);
  const start = initialMovementState(scene.world);
  assert.notDeepEqual([start.x, start.y], [actor.x, actor.y]);
  assert.equal(selectTk3ScriptTarget(scene,
    { ...start, layer: scene.start.layer }), null,
    "The player must approach the archive's placed object from spawn");
  let walked = start;
  for (let i = 0; i < 90 && !selectTk3ScriptTarget(scene,
    { ...walked, layer: scene.start.layer }); i++) {
    const vector = { x: Math.sign(actor.x - walked.x),
      y: Math.sign(actor.y - walked.y) };
    walked = stepMovement(walked, vector, 1 / 60, scene.world);
  }
  assert.equal(selectTk3ScriptTarget(scene,
    { ...walked, layer: scene.start.layer })?.slot, target.slot,
    "The existing browser stepper can walk to within Talk range");
  assert.equal(initialInnState().clues, 0);

  let state = initialTk3ScriptState();
  const first = startPlacedTk3Script(state, scene, actor, artifacts);
  assert.equal(first.status, "waiting", spec.id + ": " + first.state.diagnostic?.text);
  assert.equal(first.target.slot, target.slot);
  state = first.state;
  assert.equal(state.message, spec.first);
  assert.equal(state.variables[spec.variable], undefined);
  assert.equal(startPlacedTk3Script(state, scene, actor, artifacts).status, "busy");
  const advanced = advanceTk3Script(state);
  let done = advanced;
  if (spec.secondBoard) {
    assert.equal(advanced.status, "transfer", "Harbor must yield source Send");
    assert.deepEqual(advanced.transfer, {
      path: target.programPath,
      line: 8,
      file: spec.secondBoard.board,
      x: spec.secondBoard.spawn.x, y: spec.secondBoard.spawn.y,
      layer: spec.secondBoard.spawn.layer,
    });
    const arrived = resolveTk3BoardTransfer(advanced, scene, artifacts, graph);
    assert.equal(arrived.transferred, true, arrived.state.diagnostic?.text);
    assert.equal(arrived.status, "completed",
      "Source statements after Send must continue on destination board");
    assert.equal(arrived.fromBoardPath, scene.boardPath);
    assert.equal(arrived.toBoardPath,
      spec.root + "/Boards/" + spec.secondBoard.board);
    assert.deepEqual(arrived.spawn, spec.secondBoard.spawn);
    assert.deepEqual(arrived.scene.start, spec.secondBoard.spawn);
    assert.equal(arrived.state.variables[spec.secondBoard.afterSend], 1,
      "Original source script must continue executing after Send()");
    const finishPlace = arrived.scene.placements.find(p =>
      p.filename === spec.secondBoard.item);
    assert.ok(finishPlace);
    assert.equal(finishPlace.itemStatus, "resolved");
    assert.equal(finishPlace.programStatus, "resolved");
    assert.deepEqual(finishPlace.position, spec.secondBoard.position);
    const finishActor = { ...finishPlace.position };
    const ending = startPlacedTk3Script(arrived.state, arrived.scene,
      finishActor, artifacts);
    assert.equal(ending.status, "waiting", ending.state.diagnostic?.text);
    assert.equal(ending.state.message, spec.secondBoard.good,
      "Second-board ending must read variable written before Send");
    const ended = advanceTk3Script(ending.state);
    assert.equal(ended.status, "completed");
    assert.equal(ended.state.variables[spec.variable], 1);
    assert.equal(ended.state.variables[spec.secondBoard.afterSend], 1);
    const freshEnding = startPlacedTk3Script(initialTk3ScriptState(),
      arrived.scene, finishActor, artifacts);
    assert.equal(freshEnding.status, "waiting");
    assert.equal(freshEnding.state.message, spec.secondBoard.bad,
      "Fresh game has not collected the first-board variable");
    done = arrived;
  }
  assert.equal(done.status, "completed");
  state = done.state;
  assert.equal(state.message, "");
  assert.equal(state.variables[spec.variable], 1);
  assert.equal(state.runs, 1);
  const repeat = startPlacedTk3Script(state, scene, actor, artifacts);
  assert.equal(repeat.status, "waiting");
  assert.equal(repeat.state.message, spec.repeat);
  assert.equal(repeat.state.variables[spec.variable], 1);
  const repeated = advanceTk3Script(repeat.state);
  assert.equal(repeated.status, "completed");
  assert.equal(repeated.state.variables[spec.variable], 1);
  assert.equal(repeated.state.runs, 2);
  const reset = initialTk3ScriptState();
  assert.deepEqual(reset.variables, {});
  assert.equal(startPlacedTk3Script(reset, scene, actor, artifacts).state.message, spec.first);
  if (spec.secondBoard) {
    // Failure is evaluated on a fully parsed ZIP: the source program is
    // unchanged, but the destination board is missing from the archive.
    const missing = await buildScriptFixtureZip(spec);
    missing.remove(spec.root + "/Boards/" + spec.secondBoard.board);
    const missingZip = await openGameArchive(
      await missing.generateAsync({ type: "uint8array" }),
      raw => JSZip.loadAsync(raw));
    const missingArtifacts = (await readArtifacts(missingZip, {})).artifacts;
    const missingGraph = buildReferences(missingArtifacts);
    const unchangedScene = buildPlayableScene(missingArtifacts, missingGraph);
    assert.equal(unchangedScene.ok, true);
    const pending = advanceTk3Script(startPlacedTk3Script(
      initialTk3ScriptState(), unchangedScene, actor, missingArtifacts).state);
    assert.equal(pending.status, "transfer");
    const blocked = resolveTk3BoardTransfer(pending,
      unchangedScene, missingArtifacts, missingGraph);
    assert.equal(blocked.status, "error");
    assert.equal(blocked.transferred, undefined);
    assert.equal(blocked.scene, unchangedScene);
    assert.equal(blocked.state.execution, null);
    assert.equal(blocked.state.variables[spec.variable], 1,
      "Script effects before failed Send should remain in the live session");
    assert.equal(blocked.state.diagnostic.path, target.programPath);
    assert.equal(blocked.state.diagnostic.line, 8);
    assert.match(blocked.state.diagnostic.text, /missing/);
    assert.equal(selectTk3ScriptTarget(blocked.scene, actor)?.slot, target.slot,
      "Failed transfer leaves the original scene playable");

    // A real decoded destination exists, but the script coordinates are
    // invalid. Reject, do not silently use Toolkit's fallback of x=32.
    const wrongCoords = await buildScriptFixtureZip(spec);
    const originalScript = sourceForScriptFixture(spec);
    const invalidScript = originalScript.replace(
      "Send(" + JSON.stringify(spec.secondBoard.board) + ", " +
      spec.secondBoard.spawn.x + ", " + spec.secondBoard.spawn.y + ", " +
      spec.secondBoard.spawn.layer + ")",
      'Send("' + spec.secondBoard.board + '", 999, 25, 1)');
    assert.notEqual(invalidScript, originalScript);
    wrongCoords.file(target.programPath, invalidScript);
    const invalidZip2 = await openGameArchive(
      await wrongCoords.generateAsync({ type: "uint8array" }),
      raw => JSZip.loadAsync(raw));
    const invalidAssets2 = (await readArtifacts(invalidZip2, {})).artifacts;
    const invalidGraph2 = buildReferences(invalidAssets2);
    const invalidScene2 = buildPlayableScene(invalidAssets2, invalidGraph2);
    const badRequest = advanceTk3Script(startPlacedTk3Script(
      initialTk3ScriptState(), invalidScene2, actor, invalidAssets2).state);
    const rejectedSend = resolveTk3BoardTransfer(
      badRequest, invalidScene2, invalidAssets2, invalidGraph2);
    assert.equal(rejectedSend.status, "error");
    assert.equal(rejectedSend.scene, invalidScene2);
    assert.match(rejectedSend.state.diagnostic.text, /outside destination bounds/);
    assert.equal(rejectedSend.state.diagnostic.line, 8);

    // These also start from generated native ZIPs rather than hand-built
    // artifact records. All must retain the originating board on failure.
    const attempt = async (modify) => {
      const zipped = await buildScriptFixtureZip(spec);
      await modify(zipped);
      const parsed = await openGameArchive(
        await zipped.generateAsync({ type: "uint8array" }),
        raw => JSZip.loadAsync(raw));
      const a = (await readArtifacts(parsed, {})).artifacts;
      const g = buildReferences(a);
      const before = buildPlayableScene(a, g);
      assert.equal(before.ok, true);
      const open = startPlacedTk3Script(initialTk3ScriptState(), before, actor, a);
      assert.equal(open.status, "waiting");
      const request = advanceTk3Script(open.state);
      assert.equal(request.status, "transfer");
      const result = resolveTk3BoardTransfer(request, before, a, g);
      assert.equal(result.status, "error");
      assert.equal(result.scene, before);
      assert.equal(result.state.diagnostic.path, target.programPath);
      assert.equal(result.state.diagnostic.line, 8);
      assert.equal(result.state.execution, null);
      return result.state.diagnostic.text;
    };
    const destinationPath = spec.root + "/Boards/" + spec.secondBoard.board;
    const ambiguousReason = await attempt(async zip => {
      const originalBytes = await zip.file(destinationPath).async("uint8array");
      zip.file(destinationPath.toUpperCase(), originalBytes);
    });
    assert.match(ambiguousReason, /ambiguous/i);
    const unsupportedReason = await attempt(async zip => {
      zip.file(destinationPath, Uint8Array.from([1, 2, 3]));
    });
    assert.match(unsupportedReason, /unsupported|could not be decoded/i);
    const oldSend = "Send(" + JSON.stringify(spec.secondBoard.board) + ", " +
      spec.secondBoard.spawn.x + ", " + spec.secondBoard.spawn.y + ", " +
      spec.secondBoard.spawn.layer + ")";
    const invalidLayerReason = await attempt(zip => {
      zip.file(target.programPath, originalScript.replace(oldSend,
        'Send("' + spec.secondBoard.board + '", 19, 27, 9)'));
    });
    assert.match(invalidLayerReason, /Layer 9 is outside/i);
    const invalidPathReason = await attempt(zip => {
      zip.file(target.programPath, originalScript.replace(oldSend,
        'Send("../' + spec.secondBoard.board + '", 19, 27, 1)'));
    });
    assert.match(invalidPathReason, /Destination must name/i);
  }

  // Negative acceptance is also sourced from ZIP bytes: no test-only
  // modification of an already-decoded PRG record.
  const invalidZip = await buildScriptFixtureZip(spec);
  invalidZip.file(target.programPath,
    ['mwin("Before")', "wait()", 'Teleport("unknown.brd",1,1)'].join("\n"));
  const invalidBytes = await invalidZip.generateAsync({ type: "uint8array" });
  const invalidArchive = await openGameArchive(invalidBytes, raw => JSZip.loadAsync(raw));
  const invalidArtifacts = (await readArtifacts(invalidArchive, {})).artifacts;
  const invalidScene = buildPlayableScene(invalidArtifacts, buildReferences(invalidArtifacts));
  assert.equal(invalidScene.ok, true);
  const rejected = startPlacedTk3Script(initialTk3ScriptState(),
    invalidScene, actor, invalidArtifacts);
  assert.equal(rejected.status, "error");
  assert.equal(rejected.state.diagnostic.path, target.programPath);
  assert.equal(rejected.state.diagnostic.line, 3);
  assert.equal(rejected.state.execution, null);
  assert.equal(startPlacedTk3Script(initialTk3ScriptState(), scene,
    { x: -500, y: -500, layer: 1 }, artifacts).status, "out-of-range");

  // A BRD reference to a PRG alone cannot create an interactable item:
  // the item itself must load, just as Toolkit's board.items list must
  // contain a CItem before CSprite::programTest can activate its script.
  const withoutItem = await buildScriptFixtureZip(spec);
  withoutItem.remove(spec.root + "/Item/" + spec.item);
  const withoutItemBytes = await withoutItem.generateAsync({ type: "uint8array" });
  const withoutItemArchive = await openGameArchive(withoutItemBytes,
    raw => JSZip.loadAsync(raw));
  const withoutItemArtifacts = (await readArtifacts(withoutItemArchive, {})).artifacts;
  const withoutItemScene = buildPlayableScene(withoutItemArtifacts,
    buildReferences(withoutItemArtifacts));
  assert.equal(withoutItemScene.ok, true, "Missing optional item must not block scene play");
  const orphan = withoutItemScene.placements.find(p => p.slot === target.slot);
  assert.equal(orphan?.itemStatus, "missing");
  assert.equal(orphan?.programStatus, "resolved");
  assert.equal(selectTk3ScriptTarget(withoutItemScene, actor), null);
  assert.equal(startPlacedTk3Script(initialTk3ScriptState(),
    withoutItemScene, actor, withoutItemArtifacts).status, "out-of-range");
  console.log(spec.id + ": source archive GAM -> BRD -> TEM/ANM/TST -> ITM/PRG; first + repeat, reset and unsupported line passed.");
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const browser = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
for (const id of ["play-dialogue", "play-talk", "play-script-variables",
  "play-script-diagnostic", "play-reset"])
  assert.match(html, new RegExp('id="' + id + '"'));
for (const id of ["harbor", "grove"])
  assert.ok(html.includes("tk3-script-" + id + ".zip"));
for (const symbol of ["startPlacedTk3Script", "advanceTk3Script",
  "selectTk3ScriptTarget", "initialTk3ScriptState", "activateAuthoredInn",
  "initialInnState"])
  assert.ok(browser.includes(symbol), symbol);
assert.match(browser, /inn\.conversation \|\| legacy\?\.dialogue/);
assert.match(browser, /scriptSession\.execution\?\.waiting/);
assert.match(workflow, /node scripts\/check-tk3-script-slice\.mjs/);
assert.match(workflow, /node scripts\/build-tk3-script-fixtures\.mjs site/);
assert.match(workflow, /tk3-script-slice\.mjs tk3-board-transfer\.mjs tk3-gam-startup\.mjs tk3-runtime-keys\.mjs tk3-source-dialogue\.mjs site\//);
console.log("Toolkit 3 source-backed message subset and both full production archive fixtures passed.");
