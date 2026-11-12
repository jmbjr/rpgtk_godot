// Toolkit 3 binary GAM 2.9 tests. The archive paths below are taken from
// issue #80, not claimed as independently decoded bytes from the BSTW ZIP.
// The fixture itself is wholly synthetic and self-contained for CI.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readMainFile, mainFileBindings } from "../model.mjs";
import { detectSourceFormat, formatSpecTarget, mainSourceFormat } from "../asset-format.mjs";
import { readArtifacts } from "../artifacts.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { openGameArchive } from "../archive.mjs";

const zstr = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => {
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => bytes.writeInt16LE(value, index * 2));
  return bytes;
};
function gam(minor, options = {}) {
  const { screen = 7, fullScreen = 1, resolution = 3, protection = 9,
    project = "Game\\BSTW\\", title = "BSTW", language = "British.lng",
    startup = "menuTitle.prg", board = "start.brd", character = "bruce.tem" } = options;
  return Buffer.concat([
    zstr("RPGTLKIT MAIN"), i16(2, minor),
    i16(713), zstr("REGISTER-EXPLICIT"), zstr(project), zstr(title),
    i16(screen, fullScreen, resolution),
    ...(minor === 2 ? [i16(-42)] : []), // pre-2.3 parallax, absent in GAM 2.9
    i16(protection), zstr(language), zstr(startup), zstr(board), zstr(character),
  ]);
}
const expected = {
  major: 2, minor: 9, projectPath: "Game\\BSTW\\", title: "BSTW",
  language: "British.lng", startup: "menuTitle.prg",
  board: "start.brd", character: "bruce.tem",
};
const prefix = gam(9);
assert.deepEqual(readMainFile(prefix), expected, "GAM 2.9 must not read an old parallax i16");
assert.deepEqual(detectSourceFormat("gam", prefix),
  { encoding: "binary", version: "2.9", supported: true });
assert.deepEqual(mainSourceFormat(expected),
  { encoding: "binary", version: "2.9", supported: true });
assert.deepEqual(formatSpecTarget({ type: "gam", sourceFormat: detectSourceFormat("gam", prefix) }),
  { page: "gam", anchor: "#binary-29" });
assert.deepEqual(readMainFile(gam(9, {
  screen: -17, fullScreen: 0, resolution: 33, protection: -21,
  language: "lang-not-screen-field.lng", startup: "different-start.prg",
  board: "different-board.brd", character: "different-actor.tem",
})), {
  ...expected, language: "lang-not-screen-field.lng",
  startup: "different-start.prg", board: "different-board.brd",
  character: "different-actor.tem",
});

// Preserve Toolkit 2 binary 2.2 parsing (with its five integers) unchanged.
const oldMain = readMainFile(gam(2, { screen: 6, fullScreen: 0, resolution: 2, protection: 7 }));
assert.equal(oldMain.minor, 2);
assert.deepEqual([oldMain.language, oldMain.startup, oldMain.board, oldMain.character],
  [expected.language, expected.startup, expected.board, expected.character]);

const unsupported = Buffer.from(prefix);
unsupported.writeInt16LE(8, zstr("RPGTLKIT MAIN").length + 2);
assert.equal(detectSourceFormat("gam", unsupported).version, "2.8");
assert.equal(detectSourceFormat("gam", unsupported).supported, false);
assert.throws(() => readMainFile(unsupported), /outside this viewer/);
for (const cut of [prefix.subarray(0, 4), prefix.subarray(0, -1),
  prefix.subarray(0, prefix.indexOf(Buffer.from("British.lng")) + 4)]) {
  assert.throws(() => readMainFile(cut),
    /signature|terminator|truncated|header/i, "Truncated GAM must not silently decode");
}

// A root GAM and its BSTW/ asset folder intentionally have different roots.
// Use undecodable placeholders for newer BRD/TEM formats to prove links open
// archive entries independently of their native decoder support.
const game = new JSZip();
game.file("BSTW.gam", prefix);
game.file("BSTW/Prg/menuTitle.prg", "#Done()\n");
game.file("BSTW/Boards/start.brd", "Unsupported Toolkit 3 board fixture");
game.file("BSTW/Chrs/bruce.tem", "Unsupported Toolkit 3 character fixture");
const loaded = await openGameArchive(await game.generateAsync({ type: "nodebuffer" }),
  bytes => JSZip.loadAsync(bytes));
const { artifacts } = await readArtifacts(loaded, {});
const main = artifacts.get("BSTW.gam");
assert.deepEqual([
  main.major, main.minor, main.projectPath, main.title,
  main.language, main.startup, main.board, main.character,
], [
  2, 9, expected.projectPath, expected.title,
  expected.language, expected.startup, expected.board, expected.character,
]);
assert.equal(main.decodeStatus, "decoded");
assert.deepEqual(main.sourceFormat, { encoding: "binary", version: "2.9", supported: true });
assert.equal(artifacts.get("BSTW/Boards/start.brd").decodeStatus, "error");
assert.equal(artifacts.get("BSTW/Chrs/bruce.tem").decodeStatus, "error");
const paths = [...artifacts.keys()];
const names = ["Configured startup", "Opening board", "Initial character"];
const targets = [
  "BSTW/Prg/menuTitle.prg", "BSTW/Boards/start.brd", "BSTW/Chrs/bruce.tem",
];
const bindings = mainFileBindings(main, paths);
assert.deepEqual(bindings.map(([name, binding]) => [name, binding.status, binding.path]),
  names.map((name, index) => [name, "resolved", targets[index]]));
assert.equal(bindings[0][1].value, "menuTitle.prg");

const validate = new Ajv2020({ strictTypes: false });
const spec = new URL("../docs/specs/", import.meta.url);
for (const name of ["tile-record", "artifact-record"]) {
  validate.addSchema(JSON.parse(await readFile(new URL(name + ".schema.json", spec), "utf8")),
    name + ".schema.json");
}
const schema = validate.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", spec), "utf8")));
function verifyConnected(externalMain) {
  const record = connectedGameRecord(artifacts, {}, {
    archiveName: "BSTW synthetic sample",
    ...(externalMain ? { externalMain } : {}),
  });
  assert.ok(schema(record), JSON.stringify(schema.errors));
  assert.deepEqual(record.root, {
    status: "configured", origin: externalMain ? "external" : "archive",
    mainFile: { $ref: externalMain ? "rpgtk-main:/uploaded.gam" : "rpgtk:/BSTW.gam" },
  });
  const src = record.artifacts[record.root.mainFile.$ref];
  assert.equal(src.decode.status, "partial");
  assert.equal(src.sourceFormat.version, "2.9");
  assert.deepEqual(src.references.outgoing.map(edge => [
    edge.evidence, edge.status, edge.target?.$ref,
  ]), names.map((name, i) => [name, "resolved",
    "rpgtk:/" + targets[i]]));
  assert.deepEqual(record.edges.filter(edge => [
    "startup-program", "opening-board", "initial-character",
  ].includes(edge.type) && edge.source.$ref === record.root.mainFile.$ref)
    .map(edge => [edge.evidence, edge.target?.$ref]),
  names.map((name, i) => [name, "rpgtk:/" + targets[i]]));
  return record;
}
verifyConnected();
verifyConnected({ ...readMainFile(prefix), filename: "uploaded.gam" });

// The uploaded GAM takes precedence even when there is a uniquely decoded
// in-archive GAM. Missing, ambiguous, and unset states remain distinguishable.
const externalMissing = { ...readMainFile(prefix), filename: "uploaded.gam",
  startup: "missing.prg", board: "missing.brd", character: "" };
const outside = connectedGameRecord(artifacts, {}, {
  archiveName: "BSTW", externalMain: externalMissing,
});
assert.equal(outside.root.origin, "external");
assert.deepEqual(outside.artifacts["rpgtk-main:/uploaded.gam"].references.outgoing.map(edge => edge.status),
  ["missing", "missing", "unset"]);
const ambiguous = mainFileBindings(readMainFile(prefix), [
  ...paths, "duplicate/Prg/menuTITLE.prg",
]);
assert.equal(ambiguous[0][1].status, "ambiguous");

console.log("BSTW GAM 2.9 synthetic checks passed: old parallax offset, source metadata, root ZIP, external upload, 3 resolved navigable links, JSON schema, unsupported and truncated files.");
