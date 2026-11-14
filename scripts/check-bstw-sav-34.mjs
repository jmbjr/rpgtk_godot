import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readSaveState } from "../save-state.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { detectSourceFormat, formatSpecTarget } from "../asset-format.mjs";
import { openGameArchive } from "../archive.mjs";
import { nativeSave34, nativeSaveFixture, nativeSaveWithThread }
  from "../docs/specs/fixtures/native-save-34-fixtures.mjs";

const save = readSaveState(nativeSaveFixture);
assert.equal(save.completion, "complete");
assert.equal(save.unparsedTailBytes, 0);
assert.deepEqual(save.globals.numeric, [
  { name: "a!", value: 101.25 }, { name: "sceneCounter", value: -4.5 },
]);
assert.deepEqual(save.globals.objects, [{ name: "object[0]", value: 81 }]);
assert.deepEqual(save.globals.literals, [
  { name: "player$", value: "Astra" }, { name: "note$", value: "Visit Inn" },
]);
assert.deepEqual(save.globals.redirects, [{ name: "alias", value: "player$" }]);
assert.deepEqual(save.party, [
  { slot: 0, name: "Astra", filename: "hero.tem" },
  { slot: 1, name: "Beck", filename: "ally.tem" },
]);
assert.deepEqual(save.inventory, [
  { slot: 0, filename: "bugs.itm", handle: "Bugs", quantity: 4 },
  { slot: 1, filename: "", handle: "", quantity: 0 },
]);
assert.equal(save.equipment.length, 32);
assert.deepEqual(save.equipment.filter(e => e.filename), [{
  player: 0, slot: 4, filename: "Game\\Test\\Item\\hat.itm", handle: "Lucky Hat",
}]);
assert.deepEqual(save.equipmentModifiers, [
  { player: 0, hp: 11, specialPower: 12, defense: 13, fight: 14 },
  { player: 1, hp: 21, specialPower: 22, defense: 23, fight: 24 },
]);
assert.deepEqual([save.misc.selectedPlayer, save.misc.gold, save.misc.board, save.misc.mainFile],
  [1, 2468, "start.brd", "Main\\BSTW.gam"]);
assert.deepEqual([save.misc.fontFace, save.misc.gameTimeSeconds, save.misc.stepsTakenTiles],
  ["Courier New", 372, 9]);
assert.deepEqual(save.positions, [
  { player: 0, x: 144.5, y: 288.25, layer: 1, active: 1,
    boardPath: { vectorIndex: -1, cycles: 2, nextNode: 3, attributes: 4 } },
  { player: 1, x: 12.5, y: 23.75, layer: 2, active: 0,
    boardPath: { vectorIndex: 7, cycles: -8, nextNode: 9, attributes: 10 } },
]);
assert.deepEqual(save.levelProgress, [
  { player: 0, nextLevel: 77, progression: 19 },
  { player: 1, nextLevel: 88, progression: 20 },
]);
assert.equal(save.formerPlayers.length, 26);
assert.equal(save.formerPlayers[0].filename, "retired.tem");
assert.deepEqual(save.presentation, {
  menuGraphic: "menu.png", fightMenuGraphic: "fight.png",
  messageWindowWidth: 75, swappedPlayerName: "alternate.tem",
});
assert.equal(save.worldItems.length, 2);
assert.deepEqual(save.worldItems[0], { slot: 0, filename: "" });
assert.deepEqual(save.worldItems[1], {
  slot: 1, filename: "door.itm", activationProgram: "openDoor.prg",
  multitaskProgram: "", initialVariable: "switch", initialValue: "01",
  finalVariable: "end", finalValue: "1",
  activate: 1, activationType: -1,
  position: { x: 321.5, y: 102.25, layer: 2 },
  active: 1, boardPath: { vectorIndex: -1, cycles: 3, nextNode: 4, attributes: 5 },
});
assert.deepEqual(save.threads, [{
  slot: 0, filename: "", persistent: 0, isItemThread: 0,
  itemSlot: null, sleeping: 1, duration: 1.5,
}]);
assert.equal(save.movementSize, 0);
assert.deepEqual(save.objectClasses, [
  { slot: 0, index: 100, className: "carray" },
  { slot: 1, index: 200, className: "" },
  { slot: 2, index: 300, className: "scanvas" },
]);
assert.equal(save.loopOffset, -7);
assert.deepEqual(detectSourceFormat("sav", nativeSaveFixture),
  { encoding: "binary", version: "3.4", supported: true });
assert.deepEqual(formatSpecTarget({
  type: "sav", sourceFormat: detectSourceFormat("sav", nativeSaveFixture),
}), { page: "sav", anchor: "#binary-34" });

const zip = new JSZip();
zip.file("BSTW/Misc/synthetic.sav", nativeSaveFixture);
zip.file("BSTW/Misc/active.sav", nativeSaveWithThread);
for (const path of [
  "BSTW/Chrs/hero.tem", "BSTW/Chrs/ally.tem", "BSTW/Chrs/retired.tem",
  "BSTW/Item/hat.itm", "BSTW/Item/bugs.itm", "BSTW/Item/door.itm",
  "BSTW/Bitmap/mwin.png", "BSTW/Bitmap/menu.png", "BSTW/Bitmap/fight.png",
  "BSTW.gam", "BSTW/Boards/start.brd",
]) zip.file(path, "SYNTHETIC PLACEHOLDER");
zip.file("BSTW/Prg/openDoor.prg", "#Done()\n");
const catalog = JSON.parse(await readFile(new URL("../catalog.json", import.meta.url), "utf8"));
const { artifacts } = await readArtifacts(zip, catalog);
const graph = buildReferences(artifacts);
const decoded = artifacts.get("BSTW/Misc/synthetic.sav");
const withThread = artifacts.get("BSTW/Misc/active.sav");
assert.equal(decoded.decodeStatus, "decoded", decoded.error);
assert.equal(decoded.sourceFormat.version, "3.4");
assert.equal(withThread.decodeStatus, "decoded", withThread.error);
assert.equal(withThread.completion, "active-thread-state-unparsed");
assert.equal(withThread.unparsedTailBytes, 6);
assert.equal(withThread.objectClasses, undefined, "Never infer content inside active thread frames");
assert.equal(withThread.threads[0].filename, "active.prg");
const expectedRefs = [
  ["Saved party member · slot 0", "BSTW/Chrs/hero.tem"],
  ["Saved party member · slot 1", "BSTW/Chrs/ally.tem"],
  ["Saved inventory · slot 0", "BSTW/Item/bugs.itm"],
  ["Saved equipment · player 0 slot 4", "BSTW/Item/hat.itm"],
  ["Saved message-window background", "BSTW/Bitmap/mwin.png"],
  ["Saved Main File", "BSTW.gam"],
  ["Saved current board", "BSTW/Boards/start.brd"],
  ["Former player · slot 0", "BSTW/Chrs/retired.tem"],
  ["Saved menu graphic", "BSTW/Bitmap/menu.png"],
  ["Saved fight menu graphic", "BSTW/Bitmap/fight.png"],
  ["Saved board item · slot 1", "BSTW/Item/door.itm"],
  ["Saved item activation program · slot 1", "BSTW/Prg/openDoor.prg"],
];
for (const [evidence, target] of expectedRefs) {
  const edge = graph.outgoing.get(decoded.path).find(e => e.evidence === evidence);
  assert.ok(edge, "Missing saved source reference " + evidence);
  assert.deepEqual([edge.status, edge.to], ["Resolved", target], evidence);
}
assert.equal(graph.outgoing.get(decoded.path).length, expectedRefs.length);
assert.equal(graph.outgoing.get(withThread.path).find(e =>
  e.evidence === "Saved RPGCode thread · slot 0").status, "Missing");

const root = new URL("../docs/specs/", import.meta.url);
const ajv = new Ajv2020({ strictTypes: false });
for (const name of ["tile-record", "artifact-record"]) {
  ajv.addSchema(JSON.parse(await readFile(new URL(name + ".schema.json", root), "utf8")),
    name + ".schema.json");
}
const validateArtifact = ajv.getSchema("artifact-record.schema.json");
for (const recordSource of [decoded, withThread]) {
  const record = artifactRecord(recordSource, graph);
  assert.ok(validateArtifact(record), JSON.stringify(validateArtifact.errors));
  assert.equal(record.decode.status, "partial",
    "Read-only state does not imply runtime restoration");
  assert.equal(record.sourceFormat.version, "3.4");
  assert.equal(record.data.globals.numeric.length, 2);
}
const connectedSchema = ajv.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", root), "utf8")));
const connected = connectedGameRecord(artifacts, catalog, { archiveName: "Synthetic save" });
assert.ok(connectedSchema(connected), JSON.stringify(connectedSchema.errors));
const sourceRecord = connected.artifacts["rpgtk:/BSTW/Misc/synthetic.sav"];
assert.deepEqual(sourceRecord.references.outgoing.map(e => [e.evidence, e.target?.$ref]),
  expectedRefs.map(([evidence, target]) => [evidence, "rpgtk:/" + target]));
const boardEdge = connected.edges.find(e =>
  e.source.$ref === sourceRecord.$id && e.evidence === "Saved current board");
assert.deepEqual(boardEdge.target, { $ref: "rpgtk:/BSTW/Boards/start.brd" });
assert.equal(connected.artifacts["rpgtk:/BSTW/Misc/active.sav"].data.completion,
  "active-thread-state-unparsed");

const invalid = [
  ["truncated globals", nativeSaveFixture.subarray(0, 31)],
  ["truncated tail", nativeSaveFixture.subarray(0, -3)],
  ["extra bytes", Buffer.concat([nativeSaveFixture, Buffer.from([0x99])])],
  ["unsupported version", (() => {
    const b = Buffer.from(nativeSaveFixture);
    b.writeInt16LE(5, "RPGTLKIT SAVE".length + 3); return b;
  })()],
  ["unbounded globals", (() => {
    const b = Buffer.from(nativeSaveFixture);
    b.writeInt32LE(100001, "RPGTLKIT SAVE".length + 5); return b;
  })()],
  ["non-finite global", (() => {
    const b = Buffer.from(nativeSaveFixture);
    const offset = b.indexOf(Buffer.from("a!\0")) + 3;
    b.writeDoubleLE(NaN, offset); return b;
  })()],
];
for (const [label, bytes] of invalid) {
  const archive = new JSZip();
  archive.file("Misc/invalid.sav", bytes);
  const result = (await readArtifacts(archive, catalog)).artifacts.get("Misc/invalid.sav");
  assert.equal(result.decodeStatus, "error", label);
}
assert.equal(detectSourceFormat("sav", invalid[3][1]).supported, false);

// Original user's BSTW ZIP acceptance, never checked into Git or CI:
// node scripts/check-bstw-sav-34.mjs "/path/to/BSTW_EXPO_DEMO (1).zip"
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const actual = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const realFiles = (await readArtifacts(actual, catalog)).artifacts;
  assert.equal(realFiles.size, 285);
  const sav = realFiles.get("BSTW/Misc/NewFile.sav");
  assert.equal(sav.byteLength, 149796);
  assert.equal(sav.decodeStatus, "decoded", sav.error);
  assert.deepEqual(sav.sourceFormat, { encoding: "binary", version: "3.4", supported: true });
  assert.equal(sav.completion, "complete");
  assert.deepEqual(Object.fromEntries(Object.entries(sav.globals).map(([k,v]) => [k,v.length])),
    { numeric: 4055, objects: 1271, literals: 664, redirects: 0 });
  assert.deepEqual(sav.party.map(p => [p.name, p.filename]), [
    ["Bruce", "bruce.tem"], ["Loyalis", "loyalis.tem"],
  ]);
  assert.deepEqual(sav.inventory.map(e => [e.filename, e.handle, e.quantity]),
    [["BUGS.ITM", "bugs", 3]]);
  assert.deepEqual([sav.misc.selectedPlayer, sav.misc.gold, sav.misc.board, sav.misc.gameTimeSeconds],
    [0, 12345, "start.brd", 52]);
  assert.deepEqual([sav.positions[0].x, sav.positions[0].y, sav.positions[0].layer],
    [133, 117, 1]);
  assert.deepEqual([sav.positions[1].active, sav.positions[1].layer], [0, 1]);
  assert.equal(sav.equipment.filter(e => e.filename).length, 2);
  assert.ok(sav.equipment.filter(e => e.filename).every(e =>
    e.filename.toLowerCase().endsWith("/hat.itm") ||
    e.filename.toLowerCase().endsWith("\\hat.itm")));
  assert.equal(sav.worldItems.length, 12);
  assert.equal(sav.worldItems.filter(item => item.filename).length, 1);
  assert.equal(sav.worldItems[11].filename, "hat.itm");
  assert.deepEqual([sav.worldItems[11].position.x, sav.worldItems[11].position.y],
    [0, 0]);
  assert.equal(sav.threads.length, 1);
  assert.equal(sav.threads[0].filename, "");
  assert.equal(sav.movementSize, 0);
  assert.equal(sav.objectClasses.length, 1297);
  assert.equal(sav.loopOffset, 0);
  const realGraph = buildReferences(realFiles);
  assert.deepEqual(["Saved current board", "Saved party member · slot 0",
    "Saved inventory · slot 0"].map(label =>
    realGraph.outgoing.get(sav.path).find(edge => edge.evidence === label)?.status),
    ["Resolved", "Resolved", "Resolved"]);
  assert.ok(validateArtifact(artifactRecord(sav, realGraph)),
    JSON.stringify(validateArtifact.errors));
  console.log("Original BSTW SAV 3.4 verified: full 149,796-byte EOF, 5,990 global variables, " +
    "2 party members, 1 inventory entry, 12 world-item slots, 1,297 object mappings.");
}
console.log("SAV 3.4 synthetic checks passed: all sections, 16×party equipment, refs, JSON, " +
  "opaque active-thread marker, malformed data and exact EOF.");
