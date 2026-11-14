import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { inspectPortableExecutable } from "../pe-inspect.mjs";
import { auditProjectPlugins } from "../plugin-audit.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { openGameArchive } from "../archive.mjs";
import { nativeMainFixture, nativeMainExpected }
  from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { syntheticPortableExecutable, syntheticComDll, syntheticLegacyDll }
  from "../docs/specs/fixtures/pe-plugin-fixtures.mjs";

const com = inspectPortableExecutable(syntheticComDll);
assert.deepEqual([com.status, com.architecture, com.peFormat, com.isDll],
  ["pe", "x86", "PE32", true]);
assert.deepEqual(com.exports.map(item => item.name),
  ["DllCanUnloadNow", "DllGetClassObject", "DllRegisterServer", "DllUnregisterServer"]);
assert.deepEqual(com.exports.map(item => item.ordinal), [1, 2, 3, 4]);
assert.deepEqual(com.interfaceEvidence, {
  comRegistrationExports: true, legacyTKPlugInitExport: false,
});
const legacy = inspectPortableExecutable(syntheticLegacyDll);
assert.deepEqual(legacy.interfaceEvidence,
  { comRegistrationExports: false, legacyTKPlugInitExport: true });
const x64 = inspectPortableExecutable(syntheticPortableExecutable(["TKPlugInit"], { pe64: true }));
assert.deepEqual([x64.architecture, x64.peFormat], ["x64", "PE32+"]);
assert.equal(x64.exports[0].name, "TKPlugInit");
assert.equal(inspectPortableExecutable(Buffer.from("NOT A DLL")).status, "not-pe");
for (const [label, bytes] of [
  ["short PE", syntheticComDll.subarray(0, 0x180)],
  ["bad export section", (() => {
    const b = Buffer.from(syntheticComDll); b.writeUInt32LE(0x40000000, 0x118 + 96); return b;
  })()],
  ["huge export count", (() => {
    const b = Buffer.from(syntheticComDll); b.writeUInt32LE(8193, 0x300 + 24); return b;
  })()],
  ["unterminated symbol", (() => {
    const b = Buffer.from(syntheticComDll); b.fill(0x41, 0x3b0, b.length); return b;
  })()],
]) {
  assert.equal(inspectPortableExecutable(bytes).status, "malformed-pe", label);
}
const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
const declarations = nativeMainExpected.pluginSlots.filter(Boolean);
const names = [...new Set([...declarations, "menu-system.dll", "fight-system.dll", "not-declared.dll"])];
for (const filename of names) {
  zip.file("BSTW/Plugin/" + filename, filename === "not-declared.dll" ?
    syntheticLegacyDll : syntheticComDll);
}
zip.file("BSTW/Plugin/broken.dll", Buffer.from("SYNTHETIC PLACEHOLDER"));
const { artifacts } = await readArtifacts(zip, {});
const main = artifacts.get("BSTW.gam");
assert.equal(main.decodeStatus, "decoded", main.error);
const graph = buildReferences(artifacts, [{
  name: "BSTW.gam", bindings: (await import("../model.mjs")).mainFileBindings(main, [...artifacts.keys()]),
  external: false,
}]);
const audit = auditProjectPlugins(artifacts, main);
assert.equal(audit.mainFile, "BSTW.gam");
assert.equal(audit.declarationScope, "configured");
assert.equal(audit.storedSlots, 5);
assert.deepEqual(audit.summary, {
  declared: 6, bundled: 8, undeclaredBundled: 2,
  unresolvedDeclarations: 0, comExportCandidates: 6, legacyExportCandidates: 1,
});
assert.deepEqual(audit.declarations.map(d => [d.role, d.slot, d.status]), [
  ["menu", null, "resolved"], ["fight", null, "resolved"],
  ["slot", 0, "resolved"], ["slot", 1, "resolved"],
  ["slot", 3, "resolved"], ["slot", 4, "resolved"],
]);
assert.deepEqual(audit.bundled.filter(d => !d.declaredAs.length).map(d => d.filename),
  ["broken.dll", "not-declared.dll"]);
assert.equal(audit.bundled.find(d => d.filename === "broken.dll").pe.status, "not-pe");
assert.equal(audit.bundled.find(d => d.filename === "MenuHelp.dll").pe.exports.length, 4);
const noMain = auditProjectPlugins(artifacts);
assert.equal(noMain.declarationScope, "unavailable");
assert.equal(noMain.summary.declared, 0);
assert.equal(noMain.summary.bundled, 8);
const missingMain = {
  ...main,
  configuration: { ...main.configuration,
    pluginSlots: [{ slot: 0, filename: "missing.dll" }],
    menuPlugin: "", fightPlugin: "" },
};
const missing = auditProjectPlugins(artifacts, missingMain);
assert.equal(missing.summary.unresolvedDeclarations, 1);
assert.equal(missing.declarations[0].status, "missing");

const ajv = new Ajv2020({ strictTypes: false });
const root = new URL("../docs/specs/", import.meta.url);
for (const name of ["tile-record", "artifact-record"]) {
  ajv.addSchema(JSON.parse(await readFile(new URL(name + ".schema.json", root), "utf8")),
    name + ".schema.json");
}
const validateAsset = ajv.getSchema("artifact-record.schema.json");
for (const record of artifacts.values()) {
  if (record.type !== "dll") continue;
  const item = artifactRecord(record, graph);
  assert.ok(validateAsset(item), record.path + ": " + JSON.stringify(validateAsset.errors));
  assert.equal(item.data.byteLength, record.pe.byteLength);
}
const connectedSchema = ajv.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", root), "utf8")));
for (const externalMain of [undefined, { ...main, filename: "uploaded.gam" }]) {
  const record = connectedGameRecord(artifacts, {}, {
    archiveName: "Synthetic plugin audit", ...(externalMain ? { externalMain } : {}),
  });
  assert.ok(connectedSchema(record), JSON.stringify(connectedSchema.errors));
  assert.deepEqual(record.pluginAudit.summary, audit.summary);
  assert.equal(record.pluginAudit.declarations.length, 6);
  const edge = record.edges.find(e => e.type === "plugin-declaration" &&
    e.evidence === "Declared plugin · slot 0");
  assert.equal(edge.target.$ref, "rpgtk:/BSTW/Plugin/MenuHelp.dll");
  assert.deepEqual(record.artifacts["rpgtk:/BSTW/Plugin/MenuHelp.dll"].data.pe.exports,
    com.exports);
}
// Optional source-only acceptance against the owner archive; never in CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const actualZip = await openGameArchive(bytes, source => JSZip.loadAsync(source));
  const real = (await readArtifacts(actualZip, {})).artifacts;
  assert.equal(real.size, 285);
  const realAudit = auditProjectPlugins(real, real.get("BSTW.gam"));
  assert.equal(realAudit.storedSlots, 9);
  assert.deepEqual(realAudit.summary, {
    declared: 5, bundled: 7, undeclaredBundled: 2,
    unresolvedDeclarations: 0, comExportCandidates: 7, legacyExportCandidates: 0,
  });
  assert.deepEqual(realAudit.bundled.filter(d => !d.declaredAs.length).map(d => d.filename),
    ["FileBrowser_v1.31.dll", "miscplugin.dll"]);
  for (const plugin of realAudit.bundled) {
    assert.deepEqual([plugin.pe.status, plugin.pe.architecture, plugin.pe.isDll],
      ["pe", "x86", true], plugin.path);
    assert.deepEqual(plugin.pe.exports.map(e => e.name),
      ["DllCanUnloadNow", "DllGetClassObject", "DllRegisterServer", "DllUnregisterServer"]);
    assert.ok(plugin.pe.exports.every(e => e.ordinal >= 1));
  }
  const connected = connectedGameRecord(real, {}, { archiveName: "BSTW" });
  assert.ok(connectedSchema(connected), JSON.stringify(connectedSchema.errors));
  console.log("Real BSTW PE audit passed: 7 x86 COM export DLLs, 5 GAM slot declarations, " +
    "2 undeclared bundled DLLs; no binaries executed.");
}
console.log("Static plugin audit passed: synthetic PE32/PE32+, COM/legacy exports, " +
  "missing/undeclared files, invalid PE recovery, connected JSON and source links.");
