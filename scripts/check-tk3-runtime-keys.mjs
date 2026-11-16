import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { initialTk3ScriptState, startPlacedTk3Script, advanceTk3Script }
  from "../tk3-script-slice.mjs";
import { listTk3RuntimeKeys, startTk3RuntimeKey }
  from "../tk3-runtime-keys.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

const spec = scriptFixtureSpecs.find(s => s.id === "grove");
const keyPath = spec.root + "/Prg/ENDDEMO.prg";
const gamPath = spec.main;
const keyProgram = [
  "if (" + spec.variable + " == 0)",
  "{", '  mwin("Orio: The oak has not been visited yet.")',
  "  wait()", "  mwinCls()", "}", "else", "{",
  '  mwin("Orio: The oak remembered. THE END.")',
  "  wait()", "  mwinCls()", "}", "",
].join("\n");

async function configureZip(options = {}) {
  const zip = await buildScriptFixtureZip(spec);
  const bytes = Buffer.from(await zip.file(gamPath).async("uint8array"));
  const needle = Buffer.concat([Buffer.from([35, 0]), Buffer.from("ENDDEMO.prg\0")]);
  const offset = bytes.indexOf(needle);
  assert.ok(offset >= 0 && bytes.indexOf(needle, offset + 1) === -1);
  bytes.writeInt16LE(113, offset); // Native GAM stores ASCII 'q' as 113.
  zip.file(gamPath, bytes);
  if (!options.omitProgram) zip.file(keyPath,
    options.source ?? keyProgram);
  if (options.duplicate) zip.file(spec.root + "/Prg/ENDDEMO.PRG", keyProgram);
  const parsed = await openGameArchive(
    await zip.generateAsync({ type: "uint8array" }),
    b => JSZip.loadAsync(b));
  const artifacts = (await readArtifacts(parsed, {})).artifacts;
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  const actions = listTk3RuntimeKeys(scene, artifacts);
  return { scene, artifacts, graph, actions };
}

const valid = await configureZip();
const runtime = valid.actions.find(a => a.program === "ENDDEMO.prg");
assert.ok(runtime);
assert.equal(runtime.label, "Q");
assert.equal(runtime.key, 113);
assert.equal(runtime.status, "resolved");
assert.equal(runtime.path, keyPath);
const first = startTk3RuntimeKey(initialTk3ScriptState(), runtime, valid.artifacts);
assert.equal(first.status, "waiting");
assert.equal(first.state.message, "Orio: The oak has not been visited yet.");
assert.equal(advanceTk3Script(first.state).status, "completed");

const placed = valid.scene.placements.find(p => p.filename === spec.item);
assert.ok(placed);
const interaction = startPlacedTk3Script(initialTk3ScriptState(),
  valid.scene, { ...placed.position }, valid.artifacts);
assert.equal(interaction.status, "waiting", interaction.state.diagnostic?.text);
const visited = advanceTk3Script(interaction.state);
assert.equal(visited.status, "completed");
assert.equal(visited.state.variables[spec.variable], 1);
const ending = startTk3RuntimeKey(visited.state, runtime, valid.artifacts);
assert.equal(ending.status, "waiting");
assert.equal(ending.state.message, "Orio: The oak remembered. THE END.");
const completed = advanceTk3Script(ending.state);
assert.equal(completed.status, "completed");
assert.equal(completed.state.variables[spec.variable], 1);
assert.equal(startTk3RuntimeKey(initialTk3ScriptState(), runtime,
  valid.artifacts).state.message, "Orio: The oak has not been visited yet.",
  "A fresh scene must not inherit the previous program state");

const missing = await configureZip({ omitProgram: true });
const missingAction = missing.actions.find(a => a.program === "ENDDEMO.prg");
assert.equal(missingAction.status, "missing");
const unavailable = startTk3RuntimeKey(initialTk3ScriptState(),
  missingAction, missing.artifacts);
assert.equal(unavailable.status, "error");
assert.equal(unavailable.state.diagnostic.line, 1);
assert.match(unavailable.state.diagnostic.text, /missing/);

const ambiguous = await configureZip({ duplicate: true });
const duplicateAction = ambiguous.actions.find(a => a.program === "ENDDEMO.prg");
assert.equal(duplicateAction.status, "ambiguous");
assert.equal(startTk3RuntimeKey(initialTk3ScriptState(),
  duplicateAction, ambiguous.artifacts).status, "error");

const unsupported = await configureZip({ source: '#include("legacy.prg")\n' });
const badAction = unsupported.actions.find(a => a.program === "ENDDEMO.prg");
const bad = startTk3RuntimeKey(initialTk3ScriptState(), badAction, unsupported.artifacts);
assert.equal(bad.status, "error");
assert.equal(bad.state.diagnostic.path, keyPath);
assert.equal(bad.state.diagnostic.line, 1);
assert.match(bad.state.diagnostic.text, /Unsupported RPGCode/);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const browser = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
const flow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
assert.match(html, /id="play-runtime-actions"/);
assert.match(browser, /listTk3RuntimeKeys\(scene, artifacts\)/);
assert.match(browser, /startTk3RuntimeKey\(scriptSession, action, artifacts\)/);
assert.match(browser, /event\.key\.toUpperCase/);
assert.match(flow, /node scripts\/check-tk3-runtime-keys\.mjs/);
assert.match(flow, /tk3-runtime-keys\.mjs tk3-source-dialogue\.mjs tk3-source-menu\.mjs tk3-fight-bridge\.mjs site\//);
console.log("Runtime GAM Q key passed: production synthetic ZIP -> configured key -> PRG -> variable-dependent ending; missing, ambiguous, unsupported scripts and fresh state.");

// Optional read-only original ZIP proof. No Windows DLL is ever executed.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const zip = await openGameArchive(bytes, b => JSZip.loadAsync(b));
  const artifacts = (await readArtifacts(zip, {})).artifacts;
  const scene = buildPlayableScene(artifacts, buildReferences(artifacts));
  assert.equal(scene.ok, true);
  const q = listTk3RuntimeKeys(scene, artifacts).find(a => a.label === "Q");
  assert.ok(q);
  assert.equal(q.program, "ENDDEMO.prg");
  assert.equal(q.path, "BSTW/Prg/ENDDEMO.prg");
  assert.equal(q.status, "resolved");
  const result = startTk3RuntimeKey(initialTk3ScriptState(), q, artifacts);
  assert.equal(result.status, "error",
    "The original ending is not supported until includes and custom objects are implemented.");
  assert.equal(result.state.diagnostic.path, q.path);
  assert.equal(result.state.diagnostic.line, 1);
  console.log("Owner SHA-verified original: Q resolves to ENDDEMO.prg; interpreter reports unsupported #include at line 1 without executing it.");
}
