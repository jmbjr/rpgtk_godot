import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { openGameArchive } from "../archive.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { nativeItem27 } from "../docs/specs/fixtures/native-item-27-fixtures.mjs";

const synthetic = new JSZip();
synthetic.file("BSTW/Boards/standard.brd", board24Fixtures.standard);
synthetic.file("BSTW/Boards/alternate.brd", board24Fixtures.alternate);
synthetic.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
for (const file of ["jim.itm", "door.itm"]) {
  synthetic.file("BSTW/Item/" + file, nativeItem27({ emptyGraphics: true }));
}
for (const file of ["doorTrigger.prg", "openDoor.prg", "ambient.prg", "arrival.prg"]) {
  synthetic.file("BSTW/Prg/" + file, "#Done()\n");
}
for (const name of ["north", "east"]) synthetic.file("BSTW/Boards/" + name + ".brd", "Synthetic placeholder");
for (const name of ["trigger", "banner", "sky", "battle"]) synthetic.file("BSTW/Bitmap/" + name + ".png", "Synthetic placeholder");
synthetic.file("BSTW/Media/town.mid", "Synthetic placeholder");
const { artifacts } = await readArtifacts(synthetic, {});
const graph = buildReferences(artifacts);
const board = artifacts.get("BSTW/Boards/standard.brd");
assert.equal(board.decodeStatus, "decoded", board.error);
assert.deepEqual([board.width, board.height, board.layers, board.coordinateType], [3, 2, 2, 4]);
assert.deepEqual(board.nativePrograms, [{
  slot: 0, filename: "doorTrigger.prg", graphic: "trigger.png",
  initialVariable: "doorClosed", initialValue: "1",
  finalVariable: "doorOpen", finalValue: "yes",
  activate: 1, activationType: 1, distanceRepeat: 4, layer: 1,
  vectorBase: { points: [{ x: 48, y: 72 }, { x: 80, y: 72 }],
    closed: -1, handle: "door-trigger" },
}]);
assert.deepEqual(board.sprites.map(s => [
  s.slot, s.filename, s.activationProgram, s.position, s.associatedVector,
]), [
  [0, "jim.itm", "", { x: 38, y: 52, layer: 1 }, -1],
  [1, "door.itm", "openDoor.prg", { x: 68, y: 90, layer: 2 }, -1],
]);
assert.deepEqual(board.sprites[1].loadingVariable, "loading");
assert.deepEqual(board.sprites[1].loadingValue, "pending");
assert.deepEqual(board.sprites[1].initialValue, "01", "Preserve lexical activation condition");
assert.deepEqual(board.images, [{
  slot: 0, filename: "banner.png",
  position: { x: 11, y: 22 }, layer: 2, drawType: 7,
  transparentColor: 0x00112233, translucencyReserved: -1,
}]);
assert.deepEqual(board.threads, ["ambient.prg"]);
assert.deepEqual(board.constants, ["alpha", "beta"]);
assert.deepEqual(board.storedLayerTitles, ["", "Ground", "Upper"]);
assert.equal(board.layerTitles.length, 9);
assert.equal(board.layerTitles[1], "Ground");
assert.deepEqual(board.directionalLinks, [
  { direction: "North", filename: "north.brd" },
  { direction: "South", filename: "" },
  { direction: "East", filename: "east.brd" },
  { direction: "West", filename: "" },
]);
assert.deepEqual([board.backgroundImage, board.backgroundDrawType, board.background,
  board.boardMusic, board.entryProgram, board.battleBackground],
["sky.png", 3, 0x00a0b0c0, "town.mid", "arrival.prg", "battle.png"]);
assert.deepEqual([board.battleSkill, board.allowBattles, board.saveDisabled], [8, -1, 0]);
assert.deepEqual(board.ambient, [2, -4, 6]);
assert.deepEqual(board.start, { x: 19, y: 27, layer: 1 });
assert.deepEqual([board.programs.length, board.items.length], [0, 0],
  "Native records must not masquerade as pre-vector placements");
const expectedRefs = [
  ["Native board program · slot 0", "BSTW/Prg/doorTrigger.prg"],
  ["Native program graphic · slot 0", "BSTW/Bitmap/trigger.png"],
  ["Native board sprite · slot 0", "BSTW/Item/jim.itm"],
  ["Native board sprite · slot 1", "BSTW/Item/door.itm"],
  ["Native sprite activation program · slot 1", "BSTW/Prg/openDoor.prg"],
  ["Native board image · slot 0", "BSTW/Bitmap/banner.png"],
  ["Board thread · slot 0", "BSTW/Prg/ambient.prg"],
  ["North board link", "BSTW/Boards/north.brd"],
  ["East board link", "BSTW/Boards/east.brd"],
  ["Board background image", "BSTW/Bitmap/sky.png"],
  ["Board music", "BSTW/Media/town.mid"],
  ["Board entry program", "BSTW/Prg/arrival.prg"],
  ["Battle background", "BSTW/Bitmap/battle.png"],
];
for (const [evidence, target] of expectedRefs) {
  const edge = graph.outgoing.get(board.path).find(edge => edge.evidence === evidence);
  assert.ok(edge, "Missing reference: " + evidence);
  assert.deepEqual([edge.status, edge.to], ["Resolved", target], evidence);
}
assert.deepEqual(graph.outgoing.get(board.path)
  .find(edge => edge.evidence === "Native board sprite · slot 1").position,
  { x: 68, y: 90, layer: 2 });
const empty = artifacts.get("BSTW/Boards/alternate.brd");
assert.equal(empty.decodeStatus, "decoded", empty.error);
assert.deepEqual([empty.nativePrograms.length, empty.sprites.length, empty.images.length], [0, 0, 0]);
assert.deepEqual([empty.threads, empty.constants], [[""], [""]]);
assert.deepEqual(empty.start, { x: 0, y: 0, layer: 0 });
assert.equal(empty.storedLayerTitles.length, 2);
assert.equal(graph.outgoing.get(empty.path)?.length ?? 0, 0);
const ajv = new Ajv2020({ strictTypes: false });
const root = new URL("../docs/specs/", import.meta.url);
ajv.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", root), "utf8")),
  "tile-record.schema.json");
const validate = ajv.compile(JSON.parse(await readFile(
  new URL("artifact-record.schema.json", root), "utf8")));
for (const a of [board, empty]) {
  const record = artifactRecord(a, graph);
  assert.ok(validate(record), a.path + ": " + JSON.stringify(validate.errors));
  assert.equal(record.sourceFormat.version, "2.4");
  assert.equal(record.decode.status, "partial", "Static decoding is not runtime acceptance");
  assert.deepEqual(record.data.sprites, a.sprites);
}
const connected = connectedGameRecord(artifacts, {}, { archiveName: "Synthetic native board" });
const ref = connected.artifacts["rpgtk:/BSTW/Boards/standard.brd"];
assert.equal(ref.sourceFormat.version, "2.4");
for (const [evidence, target] of expectedRefs) {
  const edge = ref.references.outgoing.find(e => e.evidence === evidence);
  assert.equal(edge?.target?.$ref, "rpgtk:/" + target, evidence);
}
assert.deepEqual(ref.references.outgoing.find(e => e.evidence === "Native board sprite · slot 0").position,
  { x: 38, y: 52, layer: 1 });

for (const [label, bytes] of [
  ["short tail", board24Fixtures.standard.subarray(0, -1)],
  ["trailing data", Buffer.concat([board24Fixtures.standard, Buffer.from([42])])],
  ["bad native program maximum", (() => {
    const b = Buffer.from(board24Fixtures.standard);
    b.writeInt16LE(30000, b.indexOf(Buffer.from("doorTrigger.prg\0")) - 2);
    return b;
  })()],
  ["bad native sprite maximum", (() => {
    const b = Buffer.from(board24Fixtures.standard);
    b.writeInt16LE(30000, b.indexOf(Buffer.from("jim.itm\0")) - 2);
    return b;
  })()],
  ["short middle of native image", board24Fixtures.standard.subarray(0,
    board24Fixtures.standard.indexOf(Buffer.from("banner.png\0")) + 4)],
]) {
  const broken = new JSZip();
  broken.file("Boards/bad.brd", bytes);
  const result = (await readArtifacts(broken, {})).artifacts.get("Boards/bad.brd");
  assert.equal(result.decodeStatus, "error", label);
}

// Original BSTW game is a local, read-only option, never a committed CI asset.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash, "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const real = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const source = (await readArtifacts(real, {})).artifacts;
  assert.equal([...source.values()].filter(a => a.type === "brd").length, 9);
  const refs = buildReferences(source);
  const allBoards = [...source.values()].filter(a => a.type === "brd");
  assert.ok(allBoards.every(a => a.decodeStatus === "decoded" && a.sourceFormat.version === "2.4"),
    allBoards.filter(a => a.decodeStatus !== "decoded").map(a => a.path + ": " + a.error).join("\n"));
  const expected = [
    ["lami.itm", 82, 200], ["rusty.itm", 432, 228],
    ["jim.itm", 590, 55], ["door.itm", 207, 349],
    ["door.itm", 512, 414], ["door.itm", 495, 223],
  ];
  for (const name of ["start.brd", "start2.brd"]) {
    const a = source.get("BSTW/Boards/" + name);
    assert.equal(a.nativePrograms.length, 0);
    assert.equal(a.sprites.length, 7);
    assert.equal(a.images.length, 0);
    assert.equal(a.threads.length, 1);
    assert.deepEqual(a.threads, [""]);
    assert.deepEqual(a.constants, Array(11).fill("0"));
    assert.equal(a.boardMusic, "townmusic-final-8b.mp3");
    assert.deepEqual(a.start, { x: 107, y: 78, layer: 1 });
    assert.deepEqual(a.ambient, [0, 0, 0]);
    assert.equal(a.background, 0x00ffffff);
    assert.equal(a.backgroundDrawType, 1);
    assert.deepEqual(a.sprites.slice(0, 6).map(s => [s.filename, s.position.x, s.position.y]), expected);
    assert.deepEqual(a.sprites.slice(3, 6).map(s => s.activationProgram),
      ["mwininn.prg", "mwinuglyhouse.prg", "mwinsmallhouse.prg"]);
    const last = name === "start.brd" ? ["loyalis.itm", 115, 115] : ["house_3x3.itm", 325, 100];
    assert.deepEqual([a.sprites[6].filename, a.sprites[6].position.x, a.sprites[6].position.y], last);
    assert.ok(validate(artifactRecord(a, refs)), JSON.stringify(validate.errors));
    assert.equal(refs.outgoing.get(a.path).filter(edge =>
      edge.evidence.startsWith("Native board sprite · slot ")).length, 7);
    assert.ok(refs.outgoing.get(a.path).filter(edge =>
      edge.evidence.startsWith("Native board sprite · slot ") ||
      edge.evidence.startsWith("Native sprite activation program · slot ") ||
      edge.evidence === "Board music").every(edge => edge.status === "Resolved"));
  }
  const other = allBoards.filter(a => !["start.brd", "start2.brd"].includes(a.path.split("/").at(-1)));
  assert.equal(other.length, 7);
  assert.ok(other.every(a => a.nativePrograms.length === 0 && a.sprites.length === 0 &&
    a.images.length === 0 && a.threads.length === 1 && a.constants.length === 1));
  console.log("Real BSTW sample passed: 9 BRD 2.4 tails to EOF, 7 item sprites on each start board, " +
    "3 door activation scripts, player start 107/78/1, music and unchanged empty boards.");
}
console.log("Synthetic native BRD 2.4 tail passed: programs, item sprites, images, conditions, source positions, " +
  "ambient and start, graph links, connected JSON, malformed tails and Toolkit 2 isolation.");
