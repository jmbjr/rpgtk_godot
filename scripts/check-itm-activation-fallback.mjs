import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { initialTk3ScriptState, startPlacedTk3Script, advanceTk3Script }
  from "../tk3-script-slice.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

const grove = scriptFixtureSpecs.find(s => s.id === "grove");
assert.ok(grove, "Use the existing independent Grove archive, not BSTW bytes.");
const boardPath = grove.root + "/Boards/" + grove.board;
const itemProgramPath = grove.root + "/Prg/pickup.prg";
const boardProgramPath = grove.root + "/Prg/" + grove.script;
const inheritedText = "Orio: This item program came from the ITM, not the board.";

function removeBoardActivation(zip) {
  return (async () => {
    const bytes = Buffer.from(await zip.file(boardPath).async("uint8array"));
    const old = Buffer.from(grove.item + "\0" + grove.script + "\0", "latin1");
    const next = Buffer.from(grove.item + "\0\0", "latin1");
    const offset = bytes.indexOf(old);
    assert.ok(offset >= 0 && bytes.indexOf(old, offset + 1) < 0,
      "The BRD fixture must have one authored item activation override.");
    zip.file(boardPath, Buffer.concat([bytes.subarray(0, offset), next,
      bytes.subarray(offset + old.length)]));
    return zip;
  })();
}
async function load(zip) {
  const binary = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const input = await openGameArchive(binary, bytes => JSZip.loadAsync(bytes));
  const artifacts = (await readArtifacts(input, {})).artifacts;
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  return { artifacts, graph, scene };
}
function object(scene) {
  const result = scene.placements.find(p => p.filename === grove.item);
  assert.ok(result, "The source BRD item placement must exist.");
  return result;
}

// Original Grove: the BRD script *overrides* the ITM's pickup program.
const original = await load(await buildScriptFixtureZip(grove));
const brdTarget = object(original.scene);
assert.equal(brdTarget.programSource, "board");
assert.equal(brdTarget.boardActivationProgram, grove.script);
assert.equal(brdTarget.activationProgram, grove.script);
assert.equal(brdTarget.programPath, boardProgramPath);
assert.equal(brdTarget.programStatus, "resolved");

const fallbackZip = await removeBoardActivation(await buildScriptFixtureZip(grove));
fallbackZip.file(itemProgramPath,
  ['mwin("' + inheritedText + '")', "wait()", "mwinCls()", "item_seen = 1", ""].join("\n"));
const fall = await load(fallbackZip);
const inherited = object(fall.scene);
assert.equal(inherited.itemStatus, "resolved");
assert.equal(inherited.boardActivationProgram, "");
assert.equal(inherited.programSource, "item");
assert.equal(inherited.activationProgram, "pickup.prg");
assert.equal(inherited.programPath, itemProgramPath);
assert.equal(inherited.programStatus, "resolved");
assert.equal(inherited.isInnDoor, false);
const itemArtifact = fall.artifacts.get(inherited.itemPath);
assert.equal(itemArtifact.programs["Pickup program"], "pickup.prg");

let state = initialTk3ScriptState();
const speak = startPlacedTk3Script(state, fall.scene,
  { ...inherited.position }, fall.artifacts);
assert.equal(speak.status, "waiting", speak.state.diagnostic?.text);
assert.equal(speak.state.message, inheritedText);
const finished = advanceTk3Script(speak.state);
assert.equal(finished.status, "completed");
assert.equal(finished.state.variables.item_seen, 1);
assert.equal(startPlacedTk3Script(initialTk3ScriptState(), fall.scene,
  { ...inherited.position, layer: 2 }, fall.artifacts).status, "out-of-range");

// A board filename was authored, but its PRG is missing. The runtime
// MUST NOT fall back to the ITM just because the explicit script failed.
const missingOverride = await buildScriptFixtureZip(grove);
missingOverride.file(itemProgramPath, 'mwin("INCORRECT fallback")\nwait()\n');
missingOverride.remove(boardProgramPath);
const missing = await load(missingOverride);
assert.equal(object(missing.scene).programSource, "board");
assert.equal(object(missing.scene).programStatus, "missing");
assert.notEqual(object(missing.scene).programPath, itemProgramPath);
assert.equal(startPlacedTk3Script(initialTk3ScriptState(), missing.scene,
  { ...inherited.position }, missing.artifacts).status, "out-of-range");

// Missing or duplicate ITM-targeted PRG is recorded, never fabricated.
const noItmPrg = await load(await removeBoardActivation(
  await buildScriptFixtureZip(grove)));
assert.equal(object(noItmPrg.scene).programSource, "item");
assert.equal(object(noItmPrg.scene).programStatus, "missing");
const duplicateZip = await removeBoardActivation(await buildScriptFixtureZip(grove));
duplicateZip.file(itemProgramPath, "mwin(\"first\")\nwait()\n");
duplicateZip.file("Unrelated/Prg/pickup.prg", "mwin(\"other\")\nwait()\n");
const duplicate = await load(duplicateZip);
assert.equal(object(duplicate.scene).programSource, "item");
assert.equal(object(duplicate.scene).programStatus, "missing",
  "The current graph resolver must not guess between two pickup.prg assets.");
assert.equal(object(duplicate.scene).programPath, null);
console.log("Production synthetic Grove ZIP passed: BRD program overrides ITM pickup; empty board program inherits ITM; missing/ambiguous links never invent executable programs.");

// Optional read-only local original archive acceptance, never run in CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const originalZip = await openGameArchive(bytes, raw => JSZip.loadAsync(raw));
  const artifacts = (await readArtifacts(originalZip, {})).artifacts;
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  const expected = [
    [0, "mwinLami.prg", "item", { x: 82, y: 200, layer: 1 }],
    [1, "mwinRusty.prg", "item", { x: 432, y: 228, layer: 1 }],
    [2, "mwinJim.prg", "item", { x: 590, y: 55, layer: 1 }],
    [3, "mwininn.prg", "board", { x: 207, y: 349, layer: 1 }],
    [4, "mwinuglyhouse.prg", "board", { x: 512, y: 414, layer: 1 }],
    [5, "mwinsmallhouse.prg", "board", { x: 495, y: 223, layer: 1 }],
    [6, "mwinStartBoardLoad.prg", "item", { x: 115, y: 115, layer: 1 }],
  ];
  for (const [slot, program, source, position] of expected) {
    const p = scene.placements.find(x => x.slot === slot);
    assert.ok(p, "Missing original placed slot " + slot);
    assert.equal(p.programSource, source);
    assert.equal(p.programPath, "BSTW/Prg/" + program);
    assert.equal(p.programStatus, "resolved");
    assert.deepEqual(p.position, position);
  }
  assert.equal(scene.innDoor?.slot, 3);
  console.log("Owner BSTW SHA-gated archive passed: all seven original ITM/BRD activation links resolve through production scene mapping.");
}
