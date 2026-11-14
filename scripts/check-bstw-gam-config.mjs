// Synthetic GAM 2.9 tail + plugin declarations; optional owner ZIP acceptance.
// Never execute DLLs or commit BSTW game assets.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import Ajv2020 from "ajv/dist/2020.js";
import { readMainFile, mainFileBindings } from "../model.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { artifactRecord } from "../records.mjs";
import { openGameArchive } from "../archive.mjs";
import { nativeMainFixture, nativeMainExpected } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";

const decoded = readMainFile(nativeMainFixture);
assert.equal(decoded.minor, 9);
assert.deepEqual([decoded.projectPath, decoded.title, decoded.startup, decoded.board, decoded.character],
  [nativeMainExpected.projectPath, nativeMainExpected.title, nativeMainExpected.startup,
    nativeMainExpected.board, nativeMainExpected.character]);
const c = decoded.configuration;
assert.deepEqual(c.screen, { type: 13, fullScreen: 1, resolution: 2, disableProtection: 17 });
assert.deepEqual(c.runtimeKeys.extended.map(e => [e.slot, e.key, e.program]), [
  [0, 11, ""], [1, 29, "menuMain.prg"], [2, 35, "ENDDEMO.prg"], [3, 43, ""],
]);
assert.deepEqual([c.menuPlugin, c.fightPlugin], ["menu-system.dll", "fight-system.dll"]);
assert.deepEqual(c.combat, {
  enabled: 1,
  enemies: [{ slot: 0, name: "foe.ene", skill: 4 }, { slot: 1, name: "", skill: 0 }],
  type: 6, chances: 123456, useAlternateProgram: 1,
  fightProgram: "fight.prg", gameOverProgram: "gameover.prg",
});
assert.deepEqual(c.pluginSlots.map(e => e.filename), nativeMainExpected.pluginSlots);
assert.deepEqual(c.dayNight, { enabled: 1, type: 2, length: 8888 });
assert.deepEqual(c.cursor, {
  moveSound: "move.wav", selectSound: "select.wav", cancelSound: "cancel.wav",
  joystick: 1, colorDepth: 2, gameSpeed: 3, pixelMovement: 4,
  image: "cursor.png", hotspotX: 9, hotspotY: 10, transparentColor: 0x00332211,
});
assert.deepEqual(c.display, { width: 854, height: 480, fpsInTitleBar: 1 });
assert.deepEqual(c.pathfinding, {
  heuristic: 7, drawVectors: 1, pathColor: 0x00abcdef, movementControls: 5,
  movementKeys: [101, 102, 103, 104, 105, 106, 107, 108],
});

const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
for (const file of ["menuTitle", "runtime", "menuMain", "ENDDEMO", "fight", "gameover"]) {
  zip.file("BSTW/Prg/" + file + ".prg", "#Done()\n");
}
zip.file("BSTW/Boards/start.brd", "Synthetic board placeholder");
zip.file("BSTW/Chrs/bruce.tem", "Synthetic character placeholder");
zip.file("BSTW/Enemy/foe.ene", "Synthetic enemy placeholder");
for (const dll of [...nativeMainExpected.pluginSlots.filter(Boolean),
  "menu-system.dll", "fight-system.dll", "unlistedA.dll", "unlistedB.dll"]) {
  zip.file("BSTW/Plugin/" + dll, "SYNTHETIC INERT DLL PLACEHOLDER");
}
for (const wav of ["move", "select", "cancel"]) {
  zip.file("BSTW/Media/" + wav + ".wav", "SYNTHETIC MEDIA PLACEHOLDER");
}
const loaded = await openGameArchive(await zip.generateAsync({ type: "nodebuffer" }),
  data => JSZip.loadAsync(data));
const { artifacts } = await readArtifacts(loaded, {});
const main = artifacts.get("BSTW.gam");
assert.equal(main.decodeStatus, "decoded", main.error);
assert.deepEqual(main.configuration, c);
const paths = [...artifacts.keys()];
const bindings = mainFileBindings(main, paths);
const first = bindings.slice(0, 3);
assert.deepEqual(first.map(([name, value]) => [name, value.status, value.path]), [
  ["Configured startup", "resolved", "BSTW/Prg/menuTitle.prg"],
  ["Opening board", "resolved", "BSTW/Boards/start.brd"],
  ["Initial character", "resolved", "BSTW/Chrs/bruce.tem"],
]);
const pluginBindings = bindings.filter(([name]) => name.startsWith("Declared plugin · slot "));
assert.deepEqual(pluginBindings.map(([name, binding]) => [name, binding.status, binding.path]),
  [[0, "MenuHelp.dll"], [1, "brdPixelChk_v1.1.dll"], [3, "xLibVision.dll"],
    [4, "GetSaveData_v1.34.dll"]].map(([i, filename]) =>
    ["Declared plugin · slot " + i, "resolved", "BSTW/Plugin/" + filename]));
assert.equal(bindings.filter(([name]) => name.startsWith("Runtime key · ")).length, 2);
assert.ok(bindings.every(([, binding]) => binding.status === "resolved"),
  "All nonempty configured references should be resolvable");
assert.equal(paths.filter(path => path.toLowerCase().endsWith(".dll")).length, 8);
const graph = buildReferences(artifacts, [{ name: main.path, bindings, external: false }]);
assert.equal(graph.outgoing.get(main.path).filter(e => e.evidence.startsWith("Declared plugin")).length, 4);
const validate = new Ajv2020({ strictTypes: false });
const specRoot = new URL("../docs/specs/", import.meta.url);
validate.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", specRoot), "utf8")),
  "tile-record.schema.json");
const artifactSchema = validate.compile(JSON.parse(await readFile(
  new URL("artifact-record.schema.json", specRoot), "utf8")));
const record = artifactRecord(main, graph);
assert.ok(artifactSchema(record), JSON.stringify(artifactSchema.errors));
assert.equal(record.data.configuration.pluginSlots.length, 5);
assert.equal(record.sourceFormat.version, "2.9");

const connectedSchema = validate.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", specRoot), "utf8")));
for (const externalMain of [undefined, { ...decoded, filename: "uploaded-main.gam" }]) {
  const connected = connectedGameRecord(artifacts, {}, {
    archiveName: "Synthetic GAM plugin inventory",
    ...(externalMain ? { externalMain } : {}),
  });
  assert.ok(connectedSchema(connected), JSON.stringify(connectedSchema.errors));
  const record = connected.artifacts[externalMain
    ? "rpgtk-main:/uploaded-main.gam" : "rpgtk:/BSTW.gam"];
  assert.deepEqual(record.references.outgoing.filter(e =>
    e.evidence.startsWith("Declared plugin")).map(e => e.target?.$ref),
  nativeMainExpected.pluginSlots.filter(Boolean).map(name => "rpgtk:/BSTW/Plugin/" + name));
  assert.equal(connected.edges.filter(edge => edge.type === "plugin-declaration"
    && edge.source.$ref === record.$id).length, 6,
    "Four declared slots plus two configured menu/fight plugin fields");
  assert.equal(connected.edges.filter(edge => edge.type === "project-asset"
    && edge.source.$ref === record.$id).length, bindings.length - 9);
}

for (const [label, modified] of [
  ["short config tail", nativeMainFixture.subarray(0, -1)],
  ["extra byte", Buffer.concat([nativeMainFixture, Buffer.from([0])])],
  ["invalid plugin maximum", (() => {
    const b = Buffer.from(nativeMainFixture);
    b.writeInt16LE(1000, b.indexOf(Buffer.from("MenuHelp.dll\0")) - 2);
    return b;
  })()],
  ["invalid runtime max", (() => {
    const b = Buffer.from(nativeMainFixture);
    const offset = b.indexOf(Buffer.from("runtime.prg\0")) + "runtime.prg\0".length + 6;
    b.writeInt16LE(501, offset);
    return b;
  })()],
]) assert.throws(() => readMainFile(modified), /truncated|Invalid|Unexpected|terminator/i, label);

// Local read-only verification. The supplied archive is not in CI/Git.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const real = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const entries = Object.values(real.files).filter(x => !x.dir).map(x => x.name);
  assert.equal(entries.length, 285);
  const source = readMainFile(await real.file("BSTW.gam").async("uint8array"));
  const settings = source.configuration;
  assert.equal(settings.runtimeKeys.extended.length, 51);
  assert.equal(settings.combat.enemies.length, 501);
  assert.deepEqual(settings.runtimeKeys.extended.filter(x => x.program).map(x => x.program),
    ["menuMain.prg", "ENDDEMO.prg"]);
  assert.equal(settings.pluginSlots.length, 9);
  const stored = settings.pluginSlots.filter(x => x.filename).map(x => x.filename);
  assert.deepEqual(stored, ["MenuHelp.dll", "brdPixelChk_v1.1.dll", "xLibVision.dll",
    "GetSaveData_v1.34.dll", "FileBrowser_v1.3.dll"]);
  const dlls = entries.filter(x => x.toLowerCase().endsWith(".dll"));
  assert.equal(dlls.length, 7);
  assert.deepEqual(dlls.filter(x => !stored.some(name => x.toLowerCase().endsWith("/" + name.toLowerCase())))
    .map(x => x.split("/").at(-1)).sort(), ["FileBrowser_v1.31.dll", "miscplugin.dll"]);
  const linked = mainFileBindings(source, entries);
  for (const [evidence, value] of linked.filter(([name]) => name.startsWith("Declared plugin") ||
      name.startsWith("Runtime key"))) {
    assert.equal(value.status, "resolved", evidence);
    assert.ok(value.path, evidence);
  }
  assert.deepEqual(settings.pathfinding.movementKeys, [205, 0, 208, 0, 203, 0, 200, 0]);
  assert.ok(artifactSchema(artifactRecord({
    ...source, path: "BSTW.gam", type: "gam", byteLength: 1963,
    decodeStatus: "decoded",
  }, buildReferences(artifacts))), "Native GAM JSON schema");
  console.log("Real BSTW GAM 2.9 passed: 285 files, 1,963-byte fully consumed GAM, 5 declared/7 bundled DLLs, 2 extra DLLs, 2 runtime-key scripts.");
}
console.log("GAM 2.9 native tail passed: exact fields, bounded counts, plugin and runtime references, connected JSON, external GAM, and malformed inputs.");
