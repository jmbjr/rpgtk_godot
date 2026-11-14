import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences, tilePixels } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { detectSourceFormat, formatSpecTarget } from "../asset-format.mjs";
import { openGameArchive } from "../archive.mjs";
import { animation23, testTileset } from "../docs/specs/fixtures/native-character-28-fixtures.mjs";
import { nativeItem27, nativeItemBytes, nativeBlankItemBytes } from
  "../docs/specs/fixtures/native-item-27-fixtures.mjs";

const expectedWalks = [
  ["South", "native_south.anm", [14, 15]],
  ["East", "native_east.anm", [12, 13]],
  ["North", "native_north.anm", [16, 17]],
  ["West", "native_west.anm", [10, 11]],
];
const zip = new JSZip();
zip.file("BSTW/Item/diagnostic.itm", nativeItemBytes);
zip.file("BSTW/Item/no-art.itm", nativeBlankItemBytes);
zip.file("BSTW/Tiles/test-characters.tst", testTileset);
for (const [direction, file, tiles] of expectedWalks) {
  zip.file("BSTW/Misc/" + file,
    animation23(tiles.map(index => "test-characters.tst" + index), 1, 0.125));
}
for (const animation of ["rest_native", "reserved_native", "idle_native", "wave", "fx_native"]) {
  zip.file("BSTW/Misc/" + animation + ".anm",
    animation23(["test-characters.tst14"], 0, 0.3));
}
for (const program of ["equip", "remove", "menu", "battle", "board", "pickup"]) {
  zip.file("BSTW/Prg/" + program + ".prg", "#Done()\n");
}
zip.file("BSTW/Media/tick.wav", "synthetic media; not a real WAV");

const { artifacts } = await readArtifacts(zip, {});
const graph = buildReferences(artifacts);
const item = artifacts.get("BSTW/Item/diagnostic.itm");
assert.equal(item.decodeStatus, "decoded", item.error);
assert.equal(item.version, 7);
assert.deepEqual([item.name, item.description], ["Synthetic Amulet", "A diagnostic item"]);
assert.deepEqual(item.modes, { equip: true, menu: false, board: true, battle: false });
assert.equal(item.usableBy, 1);
assert.equal(item.characters.length, 51);
assert.equal(item.characters[2], "Test Bruce");
assert.deepEqual([item.buyPrice, item.sellPrice, item.keyItem], [1234, 4321, true]);
assert.deepEqual(item.armorSlots, [1, 0, 1, 0, 0, 1, 0, 0]);
assert.equal(item.accessory, "charm");
assert.deepEqual(item.modifiers, { hp: 101, defense: -102, fight: 103, specialPower: -104 });
assert.deepEqual(item.programs, {
  "Equip program": "equip.prg", "Remove program": "remove.prg",
  "Menu-use program": "menu.prg", "Battle-use program": "battle.prg",
  "On-board program": "board.prg", "Pickup program": "pickup.prg",
});
assert.equal(item.animation, "fx_native.anm");
assert.deepEqual(item.menu, { hp: 21, specialPower: 22 });
assert.deepEqual(item.battle, { hp: -23, specialPower: 24 });
assert.equal(item.sizeType, 1);
assert.ok(!("walking" in item) && !("rest" in item),
  "Native 2.7 must not manufacture old GPH walking slots");
assert.deepEqual(item.directionalAnimations.map(g => g.direction),
  ["South", "North", "East", "West", "Northwest", "Northeast", "Southwest", "Southeast"]);
assert.equal(item.directionalAnimations.length, 8);
assert.deepEqual(item.standingAnimations.map(g => g.value),
  ["idle_native.anm", "", "", "", "", "", "", ""]);
assert.deepEqual([item.restAnimation.value, item.reservedGraphic],
  ["rest_native.anm", "reserved_native.anm"]);
assert.deepEqual([item.speed, item.idleTime], [0.0625, 2.25],
  "Native item stores speed BEFORE idleTime");
assert.deepEqual(item.customAnimations.map(entry => [entry.slot, entry.value, entry.handle]),
  [[0, "wave.anm", "Wave"], [1, "", "Unused"]]);
assert.deepEqual(item.vectorBases, [
  { slot: 0, role: "Collision", points: [{ x: -12, y: -20 }, { x: 12, y: -20 }, { x: 13, y: 14 }] },
  { slot: 1, role: "Activation", points: [{ x: -22, y: -8 }, { x: 22, y: 18 }] },
]);
assert.deepEqual(item.sourceFormat, { encoding: "binary", version: "2.7", supported: true });
assert.deepEqual(detectSourceFormat("itm", nativeItemBytes), item.sourceFormat);
assert.deepEqual(formatSpecTarget({ type: "itm", sourceFormat: item.sourceFormat }),
  { page: "itm", anchor: "#binary-27" });
for (const [direction, filename, numbers] of expectedWalks) {
  const entry = item.directionalAnimations.find(a => a.direction === direction);
  assert.equal(entry.value, filename);
  const edge = graph.outgoing.get(item.path).find(a => a.evidence === entry.evidence);
  assert.deepEqual([edge.status, edge.to], ["Resolved", "BSTW/Misc/" + filename]);
  const animation = artifacts.get(edge.to);
  assert.equal(animation.decodeStatus, "decoded", animation.error);
  assert.equal(animation.sourceFormat.version, "2.3");
  const frames = graph.outgoing.get(edge.to).filter(e => e.evidence.endsWith(" image"));
  assert.deepEqual(frames.map(e => [e.to, e.tile]),
    numbers.map(number => ["BSTW/Tiles/test-characters.tst", number]));
  const pixels = frames.map(e => tilePixels(artifacts.get(e.to), e.tile));
  assert.ok(pixels.every(rgba => rgba?.length === 4096), direction + " must render both 32×32 tiles");
  assert.notDeepEqual([...pixels[0].slice(0, 4)], [...pixels[1].slice(0, 4)]);
}
for (const label of ["Idle South animation", "Rest animation",
  "Custom animation · slot 0", "Reserved item graphic",
  "Item animation", "Pickup program"]) {
  assert.equal(graph.outgoing.get(item.path).find(e => e.evidence === label)?.status,
    "Resolved", label);
}
const blank = artifacts.get("BSTW/Item/no-art.itm");
assert.equal(blank.decodeStatus, "decoded", blank.error);
assert.equal(blank.directionalAnimations.filter(a => a.value).length, 0);
assert.deepEqual([blank.customAnimations.length, blank.vectorBases.length], [0, 0]);
assert.equal(blank.standingAnimations.length, 8);

const ajv = new Ajv2020({ strictTypes: false });
const specRoot = new URL("../docs/specs/", import.meta.url);
ajv.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", specRoot), "utf8")),
  "tile-record.schema.json");
const validateItem = ajv.compile(JSON.parse(await readFile(
  new URL("artifact-record.schema.json", specRoot), "utf8")));
for (const a of [item, blank]) {
  const record = artifactRecord(a, graph);
  assert.ok(validateItem(record), a.path + ": " + JSON.stringify(validateItem.errors));
  assert.equal(record.data.version, 7);
  assert.equal(record.sourceFormat.version, "2.7");
  assert.equal(record.decode.status, "decoded");
}
const connected = connectedGameRecord(artifacts, {}, { archiveName: "Synthetic item 2.7" });
const itemRef = connected.artifacts["rpgtk:/BSTW/Item/diagnostic.itm"];
assert.equal(itemRef.sourceFormat.version, "2.7");
assert.deepEqual(itemRef.references.outgoing.filter(e => e.evidence === "Walk South animation")
  .map(e => e.target?.$ref), ["rpgtk:/BSTW/Misc/native_south.anm"]);
const southRef = connected.artifacts["rpgtk:/BSTW/Misc/native_south.anm"];
assert.deepEqual(southRef.references.outgoing.filter(e => e.evidence.endsWith(" image"))
  .map(e => [e.target?.$ref, e.target?.tileIndex]), [
    ["rpgtk:/BSTW/Tiles/test-characters.tst#/data/tiles/13", 14],
    ["rpgtk:/BSTW/Tiles/test-characters.tst#/data/tiles/14", 15],
  ]);

const invalidExamples = [
  ["short header", nativeItemBytes.subarray(0, 7)],
  ["short tail", nativeItemBytes.subarray(0, -9)],
  ["trailing byte", Buffer.concat([nativeItemBytes, Buffer.from([8])])],
  ["unsupported minor", (() => {
    const b = Buffer.from(nativeItemBytes);
    b.writeInt16LE(8, "RPGTLKIT ITEM".length + 3);
    return b;
  })()],
  ["unbounded custom maximum", (() => {
    const b = Buffer.from(nativeItemBytes);
    b.writeInt32LE(501, b.indexOf(Buffer.from("wave.anm\0")) - 4);
    return b;
  })()],
  ["unbounded vector maximum", (() => {
    const b = Buffer.from(nativeItemBytes);
    b.writeInt16LE(65, b.indexOf(Buffer.from("Unused\0")) + "Unused\0".length);
    return b;
  })()],
];
for (const [name, bytes] of invalidExamples) {
  const broken = new JSZip();
  broken.file("Item/broken.itm", bytes);
  const artifact = (await readArtifacts(broken, {})).artifacts.get("Item/broken.itm");
  assert.equal(artifact.decodeStatus, "error", name);
}

// Read-only original-game test; runs only when the user provides its local ZIP.
// No BSTW assets, DLLs or executables enter this repo or CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const real = await openGameArchive(bytes, payload => JSZip.loadAsync(payload));
  const entries = Object.values(real.files).filter(entry => !entry.dir);
  assert.equal(entries.length, 285);
  const { artifacts: loaded } = await readArtifacts(real, {});
  const links = buildReferences(loaded);
  const items = [...loaded.values()].filter(a => a.type === "itm");
  assert.equal(items.length, 11);
  assert.ok(items.every(a => a.decodeStatus === "decoded" && a.sourceFormat.version === "2.7"),
    items.filter(a => a.decodeStatus !== "decoded").map(a => a.path + ": " + a.error).join("\n"));
  for (const itm of items) {
    assert.equal(itm.vectorBases.length, 2);
    assert.deepEqual(itm.vectorBases.map(v => v.points.length), [4, 4]);
    assert.equal(itm.directionalAnimations.length, 8);
    assert.ok(validateItem(artifactRecord(itm, links)),
      itm.path + ": " + JSON.stringify(validateItem.errors));
  }
  const hat = loaded.get("BSTW/Item/hat.itm");
  assert.deepEqual(hat.modifiers, { hp: 1, defense: 2, fight: 3, specialPower: 4 });
  assert.equal(hat.name, "SweetHat");
  const potion = loaded.get("BSTW/Item/pot_health.itm");
  assert.deepEqual([potion.name, potion.menu.hp, potion.buyPrice],
    ["Health Potion", 10, 100]);
  const toast = loaded.get("BSTW/Item/toast.itm");
  assert.equal(toast.menu.specialPower, 10);
  const jim = loaded.get("BSTW/Item/jim.itm");
  assert.equal(jim.programs["Pickup program"], "mwinJim.prg");
  const jimSouth = links.outgoing.get(jim.path)
    .find(edge => edge.evidence === "Walk South animation");
  assert.deepEqual([jimSouth.status, jimSouth.to],
    ["Resolved", "BSTW/Misc/jim_south.anm"]);
  const frames = links.outgoing.get(jimSouth.to).filter(edge => edge.evidence.endsWith(" image"));
  assert.deepEqual(frames.map(edge => [edge.to, edge.tile]),
    [[ "BSTW/Tiles/FLcharacters.tst", 5], ["BSTW/Tiles/FLcharacters.tst", 6]]);
  for (const frame of frames) assert.ok(tilePixels(loaded.get(frame.to), frame.tile));
  const house = loaded.get("BSTW/Item/house_3x3.itm");
  const houseSouth = links.outgoing.get(house.path)
    .find(edge => edge.evidence === "Walk South animation");
  const houseFrames = links.outgoing.get(houseSouth.to)
    .filter(edge => edge.evidence.endsWith(" image"));
  assert.deepEqual(houseFrames.map(edge => edge.value),
    ["house_3x3_closed.tbm", "house_3x3_open.tbm"]);
  assert.ok(houseFrames.every(edge => edge.status === "Resolved" &&
    loaded.get(edge.to)?.type === "tbm"),
    "TBM dependencies resolve even though their pixels are not decoded yet");
  const report = items.map(a => ({
    file: a.path.split("/").at(-1), name: a.name,
    assignedWalks: a.directionalAnimations.filter(v => v.value).length,
    assignedIdle: a.standingAnimations.filter(v => v.value).length,
    pickupProgram: a.programs["Pickup program"],
  }));
  console.log("Real BSTW ITM 2.7 verified: 11/11 parsed, native vector bases, " +
    "Jim ANM→TST tiles 5/6, house ANM→TBM links, item properties and program refs.");
  console.log(JSON.stringify(report));
}
console.log("Native ITM 2.7 synthetic checks passed: item fields, ANM/TST tiles, indexed references, JSON schema, empty assets and malformed records.");
