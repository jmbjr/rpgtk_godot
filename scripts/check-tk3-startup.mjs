import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { mainFileBindings } from "../model.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { executeGamStartup } from "../tk3-gam-startup.mjs";
import { buildStartupExecutionGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { resolveTk3BoardTransfer } from "../tk3-board-transfer.mjs";
import { initialTk3ScriptState, startPlacedTk3Script, advanceTk3Script, resumeTk3Effect, chooseTk3Cursor }
  from "../tk3-script-slice.mjs";
import { startupLabSpec, buildStartupLabZip, sourceForStartupPrg, sourceForStartupLab }
  from "../docs/specs/fixtures/tk3-startup-fixture.mjs";

const spec = startupLabSpec;
const startupPath = spec.root + "/Prg/" + spec.startup;
async function decode(zip) {
  const opened = await openGameArchive(
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
    raw => JSZip.loadAsync(raw));
  const a = (await readArtifacts(opened, {})).artifacts;
  const g = buildReferences(a);
  const scene = buildPlayableScene(a, g);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  return { a, g, scene };
}
const { a: artifacts, scene } = await decode(await buildStartupLabZip());
assert.equal(scene.boardPath, spec.root + "/Boards/" + spec.board);
assert.equal(scene.characterName, spec.characterName);
assert.deepEqual(scene.start, { x: 19, y: 27, layer: 1 });
const main = artifacts.get(scene.mainPath);
assert.equal(main.startup, spec.startup, "GAM bytes specify the startup PRG");
const binding = new Map(mainFileBindings(main, [...artifacts.keys()]))
  .get("Configured startup");
assert.equal(binding.status, "resolved");
assert.equal(binding.path, startupPath);
assert.equal(artifacts.get(startupPath).program.rows.map(r => r.line).join("\n").trimEnd(),
  sourceForStartupPrg(spec).trimEnd());
const item = scene.placements.find(p => p.filename === spec.item);
assert.ok(item);
assert.equal(item.itemStatus, "resolved");
assert.equal(item.programStatus, "resolved");
assert.deepEqual(item.position, spec.position);
assert.equal(artifacts.get(item.programPath).program.rows.map(r => r.line).join("\n").trimEnd(),
  sourceForStartupLab(spec).trimEnd());

const actor = { ...item.position };
const direct = startPlacedTk3Script(initialTk3ScriptState(), scene, actor, artifacts);
assert.equal(direct.status, "waiting", direct.state.diagnostic?.text);
assert.equal(direct.state.message, spec.directText);
assert.equal(advanceTk3Script(direct.state).status, "completed");

const boot = executeGamStartup(artifacts, scene);
assert.equal(boot.ok, true, boot.diagnostic?.text);
assert.equal(boot.status, "completed");
assert.equal(boot.startupPath, startupPath);
assert.equal(boot.scriptSession.variables[spec.bootVariable], 1);
assert.equal(boot.scriptSession.execution, null);
const talk = startPlacedTk3Script(boot.scriptSession, scene, actor, artifacts);
assert.equal(talk.status, "waiting", talk.state.diagnostic?.text);
assert.equal(talk.state.message, spec.startedText);
const finished = advanceTk3Script(talk.state);
assert.equal(finished.status, "completed");
assert.equal(finished.state.variables[spec.bootVariable], 1,
  "Startup globals must be visible after the placed program returns");
assert.equal(finished.state.execution, null);
assert.equal(startPlacedTk3Script(initialTk3ScriptState(),
  scene, actor, artifacts).state.message, spec.directText,
  "Fresh direct board launch must not inherit startup");
const freshBoot = executeGamStartup(artifacts, scene);
assert.equal(freshBoot.ok, true);
assert.equal(freshBoot.scriptSession.variables[spec.bootVariable], 1);
assert.notEqual(freshBoot.scriptSession, finished.state);

for (const unsupported of [
  'Run("a.prg")', 'Load("savegame")',
  'plugins->Run("Anything")',
]) {
  const zip = await buildStartupLabZip();
  zip.file(startupPath, [spec.bootVariable + " = 1", unsupported, ""].join("\n"));
  const variant = await decode(zip);
  const attempted = executeGamStartup(variant.a, variant.scene);
  assert.equal(attempted.ok, false, unsupported);
  assert.equal(attempted.diagnostic.path, startupPath);
  assert.equal(attempted.diagnostic.line, 2);
  assert.ok(attempted.diagnostic.text.includes(startupPath + ":2:"));
  assert.equal(attempted.scriptSession, undefined,
    "Unsupported startup may not return partial assignments");
  assert.equal(startPlacedTk3Script(initialTk3ScriptState(),
    variant.scene, actor, variant.a).state.message, spec.directText);
}

const missingZip = await buildStartupLabZip();
missingZip.remove(startupPath);
const missing = await decode(missingZip);
const missingResult = executeGamStartup(missing.a, missing.scene);
assert.equal(missingResult.ok, false);
assert.equal(missingResult.diagnostic.path, startupPath);
assert.equal(missingResult.diagnostic.line, 1);
assert.match(missingResult.diagnostic.text, /missing/);

const ambiguousZip = await buildStartupLabZip();
ambiguousZip.file(startupPath.toUpperCase(),
  await ambiguousZip.file(startupPath).async("uint8array"));
const ambiguous = await decode(ambiguousZip);
const ambiguity = executeGamStartup(ambiguous.a, ambiguous.scene);
assert.equal(ambiguity.ok, false);
assert.match(ambiguity.diagnostic.text, /ambiguous/);

const noStartup = new Map(artifacts);
noStartup.set(main.path, { ...main, startup: "" });
const skipped = executeGamStartup(noStartup, scene);
assert.equal(skipped.ok, true);
assert.equal(skipped.status, "skipped");
assert.deepEqual(skipped.scriptSession.variables, {});

for (const id of ["harbor", "grove"]) {
  const zip = await buildStartupExecutionGame(id);
  const { a, g, scene } = await decode(zip);
  const boot = executeGamStartup(a, scene);
  assert.equal(boot.ok, true, boot.diagnostic?.text);
  assert.equal(boot.status, "waiting");
  assert.equal(boot.step.state, boot.scriptSession);
  assert.equal(boot.scriptSession.variables.startup_runs, 1);
  assert.equal(boot.scriptSession.variables.startup_ready, undefined);
  const helper = boot.scriptSession.execution.instructions[boot.scriptSession.execution.pc - 1];
  assert.equal(helper.path, scene.projectRoot + "Prg/" + (id === "harbor" ? "weather_clock.prg" : "orchard.prg"));
  const finished = advanceTk3Script(boot.scriptSession);
  assert.equal(finished.status, "completed");
  assert.equal(finished.state.variables.startup_ready, 1);
  assert.equal(finished.state.variables.startup_returned, 1);
  assert.equal(finished.state.variables.wrong, undefined);
  const target = scene.placements.find(item => item.programStatus === "resolved");
  const talk = startPlacedTk3Script(finished.state, scene, target.position, a);
  assert.equal(talk.state.message, "Startup prepared this object.");
  assert.equal(advanceTk3Script(talk.state).state.variables.talked, 1);

  const startup = zip.file(boot.startupPath);
  const source = await startup.async("string");
  const destination = id === "harbor" ? "channel.brd" : "ridge.brd";
  zip.file(boot.startupPath, 'Send("' + destination + '", 19, 27, 1)\n' + source);
  const transferred = await decode(zip);
  const initial = executeGamStartup(transferred.a, transferred.scene);
  assert.equal(initial.status, "transfer");
  const arrival = resolveTk3BoardTransfer(initial.step, transferred.scene, transferred.a, transferred.g);
  assert.equal(arrival.transferred, true);
  assert.equal(arrival.status, "waiting");
  assert.equal(advanceTk3Script(arrival.state).state.variables.startup_returned, 1);

  zip.file(boot.startupPath, source);
  const helperPath = scene.projectRoot + "Prg/" + (id === "harbor" ? "weather_clock.prg" : "orchard.prg");
  zip.file(helperPath, "method " + (id === "harbor" ? "ReportTide" : "GreetDay") +
    "()\n{\nunsupportedCommand(18)\n}");
  const rejected = await decode(zip);
  const blocked = executeGamStartup(rejected.a, rejected.scene);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.diagnostic.path, helperPath);
  assert.equal(blocked.diagnostic.line, 3);
  assert.equal(blocked.scriptSession, undefined);
}

if (process.argv[2]) {
  const { createHash } = await import("node:crypto");
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f");
  const original = await decode(await JSZip.loadAsync(bytes));
  const attempted = executeGamStartup(original.a, original.scene);
  assert.equal(attempted.ok, true, attempted.diagnostic?.text);
  assert.equal(attempted.startupPath, "demo/Prg/start.prg");
  let step = attempted.step;
  assert.equal(step.effect.name, "wingraphic");
  step = resumeTk3Effect(step.state);
  assert.equal(step.effect.name, "mediaplay");
  step = resumeTk3Effect(step.state);
  assert.equal(step.status, "choice");
  assert.equal(step.choice.points.length, 3);
  step = chooseTk3Cursor(step.state, 0);
  assert.equal(step.status, "waiting");
  assert.equal(step.state.execution.callFrames.length, 1);
  step = advanceTk3Script(step.state);
  assert.equal(step.status, "completed");
  assert.equal(step.state.variables.res, 0);
  console.log("Original TK3.10 diagnostic ZIP: GAM startup compiles, yields window/music services, presents a cursor map, runs New Game intro and ends normally.");
}
console.log("GAM startup passed: shared rooted helper execution, wait/caller continuation, Talk state, transfer, helper diagnostics, fresh sessions and binding errors.");
