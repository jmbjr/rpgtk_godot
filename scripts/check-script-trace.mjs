import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { openGameArchive } from "../archive.mjs";
import { traceProgramDependencies, traceProjectDependencies } from "../script-trace.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { nativeItem27 } from "../docs/specs/fixtures/native-item-27-fixtures.mjs";

const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
zip.file("BSTW/Boards/start.brd", board24Fixtures.standard);
zip.file("BSTW/Item/jim.itm", nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Item/door.itm", nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Prg/menuTitle.prg", [
  '#Include("A.prg")', '#include("B.prg")', '#Run(next$)',
  '#include("missing.prg")', '#Send("start.brd",x,y,1)',
].join("\n"));
zip.file("BSTW/Prg/A.prg", '#Include("C.prg")');
zip.file("BSTW/Prg/B.prg", '#Include("C.prg")');
zip.file("BSTW/Prg/C.prg", '#Include("A.prg")'); // deliberate cycle
for (const name of ["runtime", "menuMain", "ENDDEMO", "fight", "gameover",
  "doorTrigger", "openDoor", "ambient", "arrival", "equip", "remove",
  "menu", "battle", "board", "pickup"]) {
  zip.file("BSTW/Prg/" + name + ".prg", "#Done()\n");
}
zip.file("BSTW/Prg/menuMain.prg", '#Include("menus.prg")\n');
zip.file("BSTW/Prg/menus.prg", '#Include("CommonFunctions.prg")\n');
zip.file("BSTW/Prg/CommonFunctions.prg", '#Done()\n');
const imported = await readArtifacts(zip, catalog);
const artifacts = imported.artifacts;
const graph = buildReferences(artifacts);
const path = "BSTW/Prg/menuTitle.prg";
const trace = traceProgramDependencies(artifacts, graph, path);
assert.deepEqual(trace.steps.map(step => [step.path.split("/").at(-1), step.depth]), [
  ["menuTitle.prg", 0], ["A.prg", 1], ["B.prg", 1], ["C.prg", 2],
]);
assert.equal(trace.links.length, 7); // two direct includes, run expression, missing, Send is excluded, and 3 nested includes
assert.deepEqual(trace.gaps.map(gap => [gap.status, gap.line, gap.value]), [
  ["Dynamic", 3, "(next$)"], ["Missing", 4, "missing.prg"],
]);
assert.equal(trace.truncated, false);
assert.equal(trace.steps[3].from, "BSTW/Prg/A.prg");
assert.equal(trace.steps[3].line, 1);
assert.equal(trace.links.at(-1).to, "BSTW/Prg/A.prg",
  "Back-edge is preserved but traversal terminates");
assert.equal(traceProgramDependencies(artifacts, graph, null).steps.length, 0);
const cutoff = traceProgramDependencies(artifacts, graph, path, 2);
assert.deepEqual(cutoff.steps.map(step => step.path.split("/").at(-1)),
  ["menuTitle.prg", "A.prg"]);
assert.equal(cutoff.truncated, true);

const project = traceProjectDependencies(artifacts, graph);
assert.equal(project.mainFile, "BSTW.gam");
assert.equal(project.openingBoard, "BSTW/Boards/start.brd");
const entry = label => project.entries.find(item => item.label === label);
assert.equal(entry("Configured startup")?.path, path);
assert.equal(entry("Runtime key · slot 1")?.path, "BSTW/Prg/menuMain.prg");
assert.equal(entry("Runtime key · slot 2")?.path, "BSTW/Prg/ENDDEMO.prg");
assert.equal(entry("Native board program · slot 0")?.path, "BSTW/Prg/doorTrigger.prg");
assert.equal(entry("Native sprite activation program · slot 1")?.path, "BSTW/Prg/openDoor.prg");
assert.equal(entry("Native board sprite · slot 0 → Pickup program")?.path, "BSTW/Prg/pickup.prg");
assert.equal(entry("Native board sprite · slot 1 → Pickup program")?.path, "BSTW/Prg/pickup.prg");
assert.ok(project.summary.uniqueScripts >= 12);
assert.ok(project.summary.unresolved >= 2);
assert.ok(project.summary.dynamic >= 1);
assert.ok(project.limitations.some(line => line.includes("not proven runtime reachability")));
const external = traceProjectDependencies(artifacts, graph, {
  ...artifacts.get("BSTW.gam"), filename: "separate.gam", startup: "nonexistent.prg",
});
assert.equal(external.entries[0].status, "Missing");
assert.equal(external.entries[0].path, null);
assert.equal(external.entries[0].trace.steps.length, 0);
const noMain = new Map(artifacts);
noMain.delete("BSTW.gam");
assert.equal(traceProjectDependencies(noMain, graph).entries.length, 0);
const multiple = new Map(artifacts);
multiple.set("alternate.gam", { ...artifacts.get("BSTW.gam"), path: "alternate.gam" });
assert.equal(traceProjectDependencies(multiple, graph).entries.length, 0,
  "Multiple GAMs must not choose a false root");

const schemaRoot = new URL("../docs/specs/", import.meta.url);
const ajv = new Ajv2020({ strictTypes: false });
for (const name of ["tile-record", "artifact-record"]) {
  ajv.addSchema(JSON.parse(await readFile(new URL(name + ".schema.json", schemaRoot), "utf8")),
    name + ".schema.json");
}
const connectedSchema = ajv.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", schemaRoot), "utf8")));
for (const options of [
  { archiveName: "Synthetic scripts" },
  { archiveName: "Synthetic scripts", externalMain: {
    ...artifacts.get("BSTW.gam"), filename: "separate.gam",
  } },
]) {
  const record = connectedGameRecord(artifacts, catalog, options);
  assert.ok(connectedSchema(record), JSON.stringify(connectedSchema.errors));
  assert.deepEqual(record.scriptTrace.entries[0].trace.steps.map(step => step.path),
    trace.steps.map(step => step.path));
  assert.equal(record.scriptTrace.summary.uniqueScripts, project.summary.uniqueScripts);
}
const missingRoot = connectedGameRecord(noMain, catalog, { archiveName: "No GAM" });
assert.ok(connectedSchema(missingRoot), JSON.stringify(connectedSchema.errors));
assert.equal(missingRoot.scriptTrace.mainFile, null);

// Optional direct acceptance against the user-provided, unmodified BSTW ZIP.
// This does not run in CI and does not commit third-party assets.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const real = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const { artifacts: actual } = await readArtifacts(real, catalog);
  assert.equal(actual.size, 285);
  const refGraph = buildReferences(actual);
  const programs = [...actual.values()].filter(item => item.type === "prg");
  assert.equal(programs.length, 40);
  const includeEdges = programs.flatMap(item => refGraph.outgoing.get(item.path) ?? [])
    .filter(edge => /^#include$/i.test(edge.evidence));
  assert.equal(includeEdges.length, 59);
  assert.ok(includeEdges.every(edge => edge.status === "Resolved" && actual.get(edge.to)?.type === "prg"));
  const title = traceProgramDependencies(actual, refGraph, "BSTW/Prg/menuTitle.prg");
  assert.equal(title.steps.length, 13);
  assert.equal(title.gaps.length, 0);
  const realProject = traceProjectDependencies(actual, refGraph);
  assert.equal(realProject.entries.find(item => item.label === "Configured startup")?.path,
    "BSTW/Prg/menuTitle.prg");
  assert.equal(realProject.openingBoard, "BSTW/Boards/start.brd");
  assert.ok(realProject.entries.some(item =>
    item.label.includes("Native sprite activation program") && item.path?.endsWith("/mwininn.prg")));
  assert.ok(realProject.entries.some(item =>
    item.label.includes("Native board sprite") && item.path?.endsWith("/mwinJim.prg")));
  assert.ok(connectedSchema(connectedGameRecord(actual, catalog, { archiveName: "BSTW" })),
    JSON.stringify(connectedSchema.errors));
  console.log("Real BSTW passed: 285 files, 40 RPGCode programs, 59 resolved includes, " +
    "13 unique title script dependencies; board/item interactions preserved.");
}
console.log("Static RPGCode trace passed: recursive includes, shared modules, cycles, dynamic/missing gaps, " +
  "GAM and board/item roots, external GAM override, and connected JSON.");
