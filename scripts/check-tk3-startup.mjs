import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { mainFileBindings } from "../model.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { executeGamStartup } from "../tk3-gam-startup.mjs";
import { initialTk3ScriptState, startPlacedTk3Script, advanceTk3Script }
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
  'Run("a.prg")', 'Send("other.brd", 19, 27, 1)',
  'Load("savegame")', "wait()", 'mwin("Startup message")',
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

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const flow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
for (const id of ["play-gam-startup", "gam-startup-status", "play-bstw"])
  assert.match(html, new RegExp('id="' + id + '"'));
assert.match(html, /tk3-script-startup\.zip/);
assert.match(app, /executeGamStartup\(artifacts, playableScene\)/);
assert.match(app, /launchPlayableWithSession\(outcome\.scriptSession, outcome\.startupPath\)/);
assert.match(app, /function launchPlayableScene\(\)/);
assert.match(app, /requestBstwNewSession\(bstwTitle, playableScene\)/);
assert.match(flow, /node scripts\/check-tk3-startup\.mjs/);
assert.match(flow, /tk3-gam-startup\.mjs tk3-runtime-keys\.mjs tk3-source-dialogue\.mjs tk3-source-menu\.mjs site\//);
console.log("GAM startup passed: production synthetic ZIP -> configured PRG -> scalar -> placed-object dialogue; direct launch, fresh session, missing/ambiguous paths, and atomic unsupported-command diagnostics.");
