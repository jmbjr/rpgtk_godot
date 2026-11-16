import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { selectTk3ScriptTarget } from "../tk3-script-slice.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";
import {
  readLegacyDialogueDefinitions, compileLegacyDialogue,
  initialLegacyDialogueState, openLegacyDialogue, advanceLegacyDialogue,
  currentLegacyDialogue,
} from "../tk3-source-dialogue.mjs";

async function parse(zip) {
  const input = await openGameArchive(
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    b => JSZip.loadAsync(b));
  const artifacts = (await readArtifacts(input, {})).artifacts;
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  return { artifacts, graph, scene };
}

for (const spec of scriptFixtureSpecs) {
  // Both fixtures remain separate distinct native game formats and are
  // changed only in this test's in-memory ZIP, never in published fixtures.
  const zip = await buildScriptFixtureZip(spec);
  const eventName = spec.id + "event";
  const lastName = "Last" + spec.id + "Talk";
  const firstText = spec.characterName + ": The " + spec.itemName +
    " gave one clue.";
  const repeatText = spec.characterName + ": This object is already known.";
  const awardText = "A clue from " + spec.itemName;
  const source = [
    '#include("WindowKit.prg")', '#include("ClueKit.prg")',
    "delta = getTickCount() - " + lastName,
    "if(delta > ItemTalkThreshold)", "{",
    "  if(checked[" + eventName + "] == 0)", "  {",
    "    TalkPanel->setMwin(" + spec.characterName + "MwinID, \"mwin" +
      spec.characterName + ".png\")",
    "    TalkPanel->SetTxt(" + spec.characterName + "MwinID, " +
      JSON.stringify(firstText) + ")",
    "    TalkPanel->Close()",
    "    clues++", "    updateClues(" + JSON.stringify(awardText) + ")",
    "  }", "  else", "  {",
    "    TalkPanel->SetTxt(" + spec.characterName + "MwinID, " +
      JSON.stringify(repeatText) + ")",
    "    TalkPanel->Close()",
    "  }",
    "  " + lastName + " = getTickCount()",
    "  checked[" + eventName + "]++",
    "}", "",
  ].join("\n");
  zip.file(spec.root + "/Prg/" + spec.startup,
    '#include("State_' + spec.id + '.prg")\n');
  zip.file(spec.root + "/Prg/State_" + spec.id + ".prg", [
    "method setupState()",
    "{", "  maxclues = 1",
    "  ItemTalkThreshold = 500", "  " + eventName + " = 0", "}",
  ].join("\n"));
  zip.file(spec.root + "/Prg/WindowKit.prg",
    "class WindowKit { method setTxt(slot, words) }\n");
  zip.file(spec.root + "/Prg/ClueKit.prg", [
    "method updateClues(note)", "{", "  if(remainingclues == 0)",
    "  {", "    " + spec.variable + "END = 1", "  }", "}",
  ].join("\n"));
  zip.file(spec.root + "/Prg/" + spec.script, source);
  const { artifacts, graph, scene } = await parse(zip);
  const def = readLegacyDialogueDefinitions(artifacts, scene);
  assert.equal(def.supported, true, spec.id + ": definitions from GAM startup");
  assert.equal(def.constants[eventName.toLowerCase()], 0);
  assert.equal(def.constants.itemtalkthreshold, 500);
  const target = scene.placements.find(p => p.filename === spec.item);
  assert.ok(target);
  assert.equal(selectTk3ScriptTarget(scene, target.position)?.slot, target.slot);
  const compiled = compileLegacyDialogue(artifacts.get(target.programPath), artifacts, def);
  assert.equal(compiled.ok, true, spec.id + ": " + compiled.diagnostic?.text);
  assert.equal(compiled.event, eventName.toLowerCase());
  assert.equal(compiled.first[0].text, firstText);
  assert.equal(compiled.repeat[0].text, repeatText);
  assert.equal(compiled.awardFlag, (spec.variable + "END").toLowerCase());
  let state = initialLegacyDialogueState(def);
  const starting = openLegacyDialogue(state, compiled, 1000);
  assert.equal(starting.status, "waiting");
  assert.equal(state.variables.clues, 0);
  assert.equal(currentLegacyDialogue(starting.state).text, firstText);
  const finish = advanceLegacyDialogue(starting.state, 1100);
  assert.equal(finish.status, "completed");
  assert.equal(finish.clueGained, true);
  state = finish.state;
  assert.equal(state.variables.clues, 1);
  assert.equal(state.variables.checked[0], 1);
  assert.equal(state.variables[(spec.variable + "END").toLowerCase()], 1);
  assert.equal(state.clueMessage, awardText);
  assert.equal(openLegacyDialogue(state, compiled, 1600).status, "cooldown",
    "Exactly 500 ms is not strictly greater than 500");
  const repeat = openLegacyDialogue(state, compiled, 1601);
  assert.equal(repeat.status, "waiting");
  assert.equal(currentLegacyDialogue(repeat.state).text, repeatText);
  const repeated = advanceLegacyDialogue(repeat.state, 1620);
  assert.equal(repeated.status, "completed");
  assert.equal(repeated.state.variables.clues, 1,
    "Second visit must not award the source clue again");
  assert.equal(repeated.state.variables.checked[0], 2);
  assert.equal(openLegacyDialogue(initialLegacyDialogueState(def),
    compiled, 1000).state.dialogue.first, true,
    "Reset restores the first message and clue eligibility");

  const invalidZip = await buildScriptFixtureZip(spec);
  invalidZip.file(spec.root + "/Prg/" + spec.startup,
    '#include("State_' + spec.id + '.prg")\n');
  invalidZip.file(spec.root + "/Prg/State_" + spec.id + ".prg",
    "method setupState()\n{\n maxclues = 1\n ItemTalkThreshold = 500\n " +
    eventName + " = 0\n}\n");
  invalidZip.file(spec.root + "/Prg/WindowKit.prg",
    "class WindowKit { method setTxt(slot, words) }\n");
  invalidZip.file(spec.root + "/Prg/ClueKit.prg",
    "method updateClues(note)\n{\n if(remainingclues == 0)\n {\n " +
      spec.variable + "END = 1\n }\n}\n");
  invalidZip.file(spec.root + "/Prg/" + spec.script,
    source.replace("    clues++", '    PluginHelp("unknown DLL")\n    clues++'));
  const failed = await parse(invalidZip);
  const failDef = readLegacyDialogueDefinitions(failed.artifacts, failed.scene);
  const bad = compileLegacyDialogue(failed.artifacts.get(target.programPath),
    failed.artifacts, failDef);
  assert.equal(bad.ok, false);
  assert.equal(bad.diagnostic.path, target.programPath);
  assert.equal(bad.diagnostic.line, 11);
  assert.match(bad.diagnostic.text, /Unsupported legacy dialogue statement/);
  console.log(spec.id + ": source-only dialogue, one-time clue, strict cooldown, repeat/reset and unsupported-line diagnostics passed.");
}
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
const flow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
assert.match(js, /compileLegacyDialogue/);
assert.match(js, /openLegacyDialogue/);
assert.match(js, /advanceLegacyDialogue/);
assert.match(flow, /tk3-source-dialogue\.mjs site\//);
assert.match(flow, /node scripts\/check-tk3-source-dialogue\.mjs/);
assert.match(html, /id="play-script-variables"/);
console.log("Source-owned class dialogue projection: two different native game ZIPs passed.");

// Optional read-only source evidence runs without copying any original assets
// into Git or CI. Manual browser verification is a separate requirement.
if (process.argv[2]) {
  const { readFile: readZipFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const input = await readZipFile(process.argv[2]);
  assert.equal(createHash("sha256").update(input).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const zip = await JSZip.loadAsync(input);
  const original = await parse(zip);
  const definitions = readLegacyDialogueDefinitions(original.artifacts, original.scene);
  assert.equal(definitions.supported, true);
  const expected = ["mwinLami.prg", "mwinRusty.prg", "mwinJim.prg",
    "mwininn.prg", "mwinuglyhouse.prg", "mwinsmallhouse.prg",
    "mwinStartBoardLoad.prg"];
  for (const filename of expected) {
    const asset = original.artifacts.get("BSTW/Prg/" + filename);
    const p = compileLegacyDialogue(asset, original.artifacts, definitions,
      original.scene);
    assert.equal(p.ok, true, filename + ": " + p.diagnostic?.text);
    assert.ok(p.first.length);
    console.log(filename + ": " + p.first.length + " original first-visit lines, " +
      p.repeat.length + " repeat lines, first-time clue from source.");
  }
}
