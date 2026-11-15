import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
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

for (const [source, line] of [
  [['mwin("First")', "wait()", 'Send("other.brd",5,5)'].join("\n"), 3],
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
  const done = advanceTk3Script(state);
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

  // Negative acceptance is also sourced from ZIP bytes: no test-only
  // modification of an already-decoded PRG record.
  const invalidZip = await buildScriptFixtureZip(spec);
  invalidZip.file(target.programPath,
    ['mwin("Before")', "wait()", 'Send("unknown.brd",1,1)'].join("\n"));
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
assert.match(browser, /inn\.conversation \|\| scriptSession\.execution\?\.waiting/);
assert.match(workflow, /node scripts\/check-tk3-script-slice\.mjs/);
assert.match(workflow, /node scripts\/build-tk3-script-fixtures\.mjs site/);
assert.match(workflow, /tk3-script-slice\.mjs site\//);
console.log("Toolkit 3 source-backed message subset and both full production archive fixtures passed.");
