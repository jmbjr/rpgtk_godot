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
import { animationFrames } from "../sprites.mjs";
import { diagnosticPng } from "../docs/specs/fixtures/companion-media-fixtures.mjs";
import { character28, nativeAnims, testTileset, testDirections, animation23 }
  from "../docs/specs/fixtures/native-character-28-fixtures.mjs";

const synthetic = new JSZip();
synthetic.file("BSTW/Chrs/bruce.tem", character28);
synthetic.file("BSTW/Bitmap/test-portrait.png", diagnosticPng);
synthetic.file("BSTW/Tiles/test-characters.tst", testTileset);
synthetic.file("BSTW/SpcMove/pulse.spc", Buffer.from("RPGTLKIT SPLMOVE\r\n2\r\n0\r\nTest\r\n1\r\n0\r\n\r\n0\r\n0\r\n0\r\n\r\n\r\nText\r\n"));
synthetic.file("BSTW/Prg/level.prg", "#Done()\n");
synthetic.file("BSTW/Media/tick.wav", Buffer.from("synthetic-sound-placeholder"));
for (const [name, bytes] of nativeAnims) synthetic.file("BSTW/Misc/" + name, bytes);

const { artifacts } = await readArtifacts(synthetic, {});
const graph = buildReferences(artifacts);
const char = artifacts.get("BSTW/Chrs/bruce.tem");
assert.equal(char.decodeStatus, "decoded", char.error);
assert.equal(char.name, "Test Bruce");
assert.deepEqual([char.stats.HP, char.stats["Max HP"], char.stats.Fight], [101, 105, 23]);
assert.equal(char.profile.value, "test-portrait.png");
assert.equal(char.walking.length, 0, "Native characters do not contain GPH walking-frame pairs");
assert.equal(char.walkingAnimations.length, 8);
assert.equal(char.standingAnimations.length, 8);
assert.equal(char.battleAnimations.length, 5);
assert.equal(char.customAnimations.length, 2);
assert.equal(char.customAnimations[0].handle, "Wave");
assert.deepEqual([char.idleTime, char.speed], [2.5, 0.0625]);
assert.deepEqual(char.vectorBases.map(base => base.points.length), [3, 2]);
assert.deepEqual(char.vectorBases[0].points[2], { x: -5, y: 6 });
assert.deepEqual(detectSourceFormat("tem", character28),
  { encoding: "binary", version: "2.8", supported: true });
assert.deepEqual(formatSpecTarget({ type: "tem", sourceFormat: char.sourceFormat }),
  { page: "tem", anchor: "#binary-28" });

const portraitEdge = graph.outgoing.get(char.path).find(edge => edge.evidence === "Character portrait");
assert.deepEqual([portraitEdge.status, portraitEdge.to],
  ["Resolved", "BSTW/Bitmap/test-portrait.png"]);

const tiles = artifacts.get("BSTW/Tiles/test-characters.tst");
assert.deepEqual([tiles.count, tiles.width, tiles.height], [18, 32, 32]);
for (const [direction, tileNumbers] of [
  ["South", [14, 15]], ["East", [12, 13]],
  ["North", [16, 17]], ["West", [10, 11]],
]) {
  assert.ok(testDirections.includes(direction));
  const ref = char.walkingAnimations.find(item => item.direction === direction);
  const edge = graph.outgoing.get(char.path).find(item => item.evidence === ref.evidence);
  assert.equal(edge.status, "Resolved");
  assert.equal(edge.to, "BSTW/Misc/test_" + direction.toLowerCase() + ".anm");
  const animation = artifacts.get(edge.to);
  assert.equal(animation.decodeStatus, "decoded", animation.error);
  assert.equal(animation.sourceFormat.version, "2.3");
  assert.deepEqual([animation.width, animation.height, animation.pauseSeconds],
    [32, 32, 0.15]);
  const visible = animationFrames(animation.frames);
  assert.deepEqual(visible.map(frame => frame.image),
    tileNumbers.map(n => "test-characters.tst" + n));
  assert.equal(visible.length, 2);
  const frameEdges = graph.outgoing.get(edge.to).filter(item => item.evidence.endsWith(" image"));
  assert.deepEqual(frameEdges.map(item => [item.status, item.to, item.tile]),
    tileNumbers.map(n => ["Resolved", tiles.path, n]));
  const first = tilePixels(tiles, frameEdges[0].tile);
  const second = tilePixels(tiles, frameEdges[1].tile);
  assert.equal(first.length, 4096);
  assert.equal(second.length, 4096);
  assert.notDeepEqual([...first.slice(0, 4)], [...second.slice(0, 4)],
    direction + ": frame images must visibly differ");
  assert.deepEqual(formatSpecTarget({ type: "anm", sourceFormat: animation.sourceFormat }),
    { page: "anm", anchor: "#binary-23" });
}
const south = artifacts.get("BSTW/Misc/test_south.anm");
assert.equal(south.storedFrameCount, 50);
assert.equal(south.frames.length, 51);
assert.equal(animationFrames(south.frames).length, 2);
assert.equal(south.frames[2].image, "");
assert.equal(graph.outgoing.get(south.path).filter(edge => edge.evidence.endsWith(" image")).length, 2);

// Both standalone records and the connected-game export must retain native
// revision IDs and all resolved character→ANM→TST references.
const ajv = new Ajv2020({ strictTypes: false });
const specRoot = new URL("../docs/specs/", import.meta.url);
ajv.addSchema(JSON.parse(await readFile(new URL("tile-record.schema.json", specRoot), "utf8")),
  "tile-record.schema.json");
const schema = ajv.compile(JSON.parse(await readFile(
  new URL("artifact-record.schema.json", specRoot), "utf8")));
for (const artifact of [char, south]) {
  const record = artifactRecord(artifact, graph);
  assert.ok(schema(record), artifact.path + ": " + JSON.stringify(schema.errors));
  assert.equal(record.decode.status, artifact.type === "tem" ? "partial" : "decoded");
  assert.equal(record.sourceFormat.version, artifact.type === "tem" ? "2.8" : "2.3");
}
const connected = connectedGameRecord(artifacts, {}, { archiveName: "Synthetic BSTW character" });
const characterRef = connected.artifacts["rpgtk:/BSTW/Chrs/bruce.tem"];
const southRef = connected.artifacts["rpgtk:/BSTW/Misc/test_south.anm"];
assert.equal(characterRef.sourceFormat.version, "2.8");
assert.equal(southRef.sourceFormat.version, "2.3");
assert.ok(characterRef.references.outgoing.some(edge =>
  edge.evidence === "Walk South animation" && edge.target?.$ref === "rpgtk:/BSTW/Misc/test_south.anm"));
assert.deepEqual(southRef.references.outgoing.filter(edge => edge.evidence.endsWith(" image"))
  .map(edge => [edge.target?.$ref, edge.target?.tileIndex]), [
    ["rpgtk:/BSTW/Tiles/test-characters.tst#/data/tiles/13", 14],
    ["rpgtk:/BSTW/Tiles/test-characters.tst#/data/tiles/14", 15],
  ]);
assert.ok(characterRef.references.outgoing.some(edge => edge.evidence === "Character portrait" &&
  edge.target?.$ref === "rpgtk:/BSTW/Bitmap/test-portrait.png"));

for (const [label, type, bytes] of [
  ["short TEM", "tem", character28.subarray(0, -9)],
  ["short ANM", "anm", nativeAnims.get("test_south.anm").subarray(0, -4)],
  ["invalid TEM minor", "tem", (() => {
    const b = Buffer.from(character28); b.writeInt16LE(9, "RPGTLKIT CHAR".length + 3); return b;
  })()],
  ["invalid ANM minor", "anm", (() => {
    const b = Buffer.from(nativeAnims.get("test_south.anm"));
    b.writeInt16LE(4, "RPGTLKIT ANIM".length + 3); return b;
  })()],
  ["oversized ANM count", "anm", (() => {
    const b = Buffer.from(nativeAnims.get("test_south.anm"));
    b.writeInt32LE(60000, "RPGTLKIT ANIM".length + 1 + 4 + 8); return b;
  })()],
]) {
  const single = new JSZip();
  single.file("Test/file." + type, bytes);
  const artifact = (await readArtifacts(single, {})).artifacts.get("Test/file." + type);
  assert.equal(artifact.decodeStatus, "error", label);
}
const countOne = new JSZip();
countOne.file("Misc/short.anm", animation23(["test-characters.tst14"], 0));
const short = (await readArtifacts(countOne, {})).artifacts.get("Misc/short.anm");
assert.equal(short.decodeStatus, "decoded");
assert.equal(short.frames.length, 1);

// Optional real-archive acceptance. CI runs only synthetic fixtures.
// Run locally: node scripts/check-bstw-tem-anm.mjs /path/to/BSTW_EXPO_DEMO.zip
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const realZip = await openGameArchive(bytes, data => JSZip.loadAsync(data));
  const parsed = (await readArtifacts(realZip, {})).artifacts;
  const realGraph = buildReferences(parsed);
  const nativeChars = [...parsed.values()].filter(x => x.type === "tem");
  const nativeAnims = [...parsed.values()].filter(x => x.type === "anm");
  assert.equal(nativeChars.length, 8);
  assert.equal(nativeAnims.length, 37);
  assert.ok(nativeChars.every(x => x.decodeStatus === "decoded" &&
    x.sourceFormat.version === "2.8"),
    nativeChars.filter(x => x.decodeStatus !== "decoded").map(x => x.path + ": " + x.error).join("; "));
  assert.ok(nativeAnims.every(x => x.decodeStatus === "decoded" &&
    x.sourceFormat.version === "2.3"),
    nativeAnims.filter(x => x.decodeStatus !== "decoded").map(x => x.path + ": " + x.error).join("; "));
  const bruce = parsed.get("BSTW/Chrs/bruce.tem");
  assert.equal(bruce.name, "Bruce");
  assert.equal(bruce.profile.value, "profBruce_active.png");
  assert.equal(realGraph.outgoing.get(bruce.path)
    .find(e => e.evidence === "Character portrait").to,
    "BSTW/Bitmap/profBruce_active.png");
  const expected = { South: [14, 15], East: [12, 13], North: [16, 17], West: [10, 11] };
  for (const [direction, indices] of Object.entries(expected)) {
    const edge = realGraph.outgoing.get(bruce.path).find(e => e.evidence === "Walk " + direction + " animation");
    assert.equal(edge.status, "Resolved", direction);
    const frameEdges = realGraph.outgoing.get(edge.to).filter(e => e.evidence.endsWith(" image"));
    assert.deepEqual(frameEdges.map(e => [e.status, e.to, e.tile]),
      indices.map(i => ["Resolved", "BSTW/Tiles/FLcharacters.tst", i]));
    for (const frame of frameEdges) assert.ok(tilePixels(parsed.get(frame.to), frame.tile),
      "Rendered tile " + frame.tile);
  }
  const southData = parsed.get("BSTW/Misc/bruce_south.anm");
  assert.equal(animationFrames(southData.frames).length, 2);
  assert.equal(southData.storedFrameCount, 50);
  assert.equal(southData.pauseSeconds, 0.15);
  assert.ok(schema(artifactRecord(bruce, realGraph)), JSON.stringify(schema.errors));
  assert.ok(schema(artifactRecord(southData, realGraph)), JSON.stringify(schema.errors));
  console.log("Real BSTW ZIP passed: 8 TEM 2.8, 37 ANM 2.3, Bruce portrait and four walks; south tiles 14/15 render.");
}
console.log("Synthetic TEM 2.8/ANM 2.3 checks passed: portraits, four walking links, tiles 14/15, pixels, connected JSON, schema and malformed data.");
