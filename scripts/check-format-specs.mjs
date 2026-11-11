import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { buildReferences, readArtifacts } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { itemSprites, standaloneTilePixels } from "../sprites.mjs";
import { readMainFile } from "../model.mjs";
import { openGameArchive } from "../archive.mjs";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import JSZip from "../vendor/jszip.min.js";

const spec = new URL("../docs/specs/", import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, spec), "utf8"));
const ajv = new Ajv2020({ strictTypes: false });
ajv.addSchema(await json("tile-record.schema.json"), "tile-record.schema.json");
const validate = ajv.compile(await json("artifact-record.schema.json"));
const catalog = await json("../../catalog.json");
const recordFor = (artifact, graph, options) => {
  const record = JSON.parse(JSON.stringify(artifactRecord(artifact, graph, options)));
  assert.ok(validate(record), `${record.path}: ${JSON.stringify(validate.errors)}`);
  return record;
};
const load = async zip => {
  const { artifacts } = await readArtifacts(zip, catalog);
  return { artifacts, graph: buildReferences(artifacts) };
};

const zip = new JSZip();
for (const { path, bytes } of fixtures) zip.file(path, bytes);
for (const name of ["standalone-16.gph", "standalone-32-rle.gph", "two-tiles.tst"]) {
  zip.file(`Tiles/${name}`, await readFile(new URL(`fixtures/${name}`, spec)));
}
zip.file("Bitmap/browser.png", "");
zip.file("unidentified.xyz", "");
zip.file("broken.ste", "truncated");
zip.file("StatusE/truncated-text.ste", "RPGTLKIT STATUSE\n2\n0\nBroken\n1\n");
const character24 = fixtures.find(({ path }) => path === "Chrs/walker.tem").bytes;
zip.file("Chrs/truncated.tem", character24.subarray(0, -1));
const textBoard = fixtures.find(({ path }) => path === "Boards/text-room.brd").bytes;
zip.file("Boards/truncated-text.brd", textBoard.subarray(0, -15));
const fixedBoard = fixtures.find(({ path }) => path === "Boards/fixed-room.brd").bytes;
zip.file("Boards/truncated-fixed-grid.brd", fixedBoard.subarray(0, 100));
const embeddedItem = fixtures.find(({ path }) => path === "Item/text-item-0.itm").bytes;
zip.file("Item/truncated-text.itm", embeddedItem.subarray(0, 700));
const textCharacter = fixtures.find(({ path }) => path === "Chrs/text-hero-0.tem").bytes;
zip.file("Chrs/truncated-text.tem", textCharacter.subarray(0, 7000));
const threadedBoard = fixtures.find(({ path }) => path === "Boards/threaded-room.brd").bytes;
zip.file("Boards/truncated-thread-tail.brd", threadedBoard.subarray(0, -1));
const badThreadCount = Buffer.from(fixtures.find(({ path }) => path === "Boards/no-threads.brd").bytes);
badThreadCount.writeInt32LE(10000, badThreadCount.length - 5);
zip.file("Boards/invalid-thread-count.brd", badThreadCount);
const olderCharacters = fixtures.filter(({ path }) => /^Chrs\/text-[01]-[01]\.tem$/.test(path));
for (const { path, bytes } of olderCharacters) {
  zip.file(`${path}.short-graphics.tem`, bytes.subarray(0, Math.min(7000, Math.floor(bytes.length / 2))));
  zip.file(`${path}.short-tail.tem`, bytes.subarray(0, -8));
}
const oldReferenced = olderCharacters.find(({ path }) => path === "Chrs/text-1-1.tem").bytes;
zip.file("Chrs/bad-old-size.tem", Buffer.from(oldReferenced.toString("ascii").replace("Special\r\n0\r\n1\r\n", "Special\r\n0\r\n2\r\n")));
const oldEmbedded = olderCharacters.find(({ path }) => path === "Chrs/text-0-0.tem").bytes;
zip.file("Chrs/bad-old-color.tem", Buffer.from(oldEmbedded.toString("ascii").replace("Special\r\n0\r\n1\r\n", "Special\r\n0\r\n16777216\r\n")));
zip.file("Chrs/unsupported-old-version.tem", Buffer.from(oldEmbedded.toString("ascii").replace("CHAR\r\n2\r\n0", "CHAR\r\n2\r\n9")));
const { artifacts, graph } = await load(zip);
for (const { path, expected } of fixtures) {
  const record = recordFor(artifacts.get(path), graph);
  assert.equal(record.decode.status, expected.status, path);
  const compared = { ...record.data };
  if (record.format === "tem") delete compared.artwork;
  if (record.format === "brd") for (const key of ["tileTypes", "programs", "items", "start", "saveDisabled"]) delete compared[key];
  assert.deepEqual(compared, expected.data, path);
}
for (const [path, status] of [["Bitmap/browser.png", "media"], ["unidentified.xyz", "unidentified"], ["broken.ste", "error"], ["StatusE/truncated-text.ste", "error"], ["Chrs/truncated.tem", "error"], ["Chrs/truncated-text.tem", "error"], ["Boards/truncated-text.brd", "error"], ["Boards/truncated-fixed-grid.brd", "error"],
  ["Boards/truncated-thread-tail.brd", "error"], ["Boards/invalid-thread-count.brd", "error"], ["Item/truncated-text.itm", "error"]]) {
  assert.equal(recordFor(artifacts.get(path), graph).decode.status, status);
}
assert.ok(recordFor(artifacts.get("Prg/start.prg"), graph).references.outgoing.some(ref => ref.status === "missing"));
assert.equal(recordFor(artifacts.get("Tiles/two-tiles.tst"), graph).references.incoming[0].status, "resolved");
const walker = recordFor(artifacts.get("Chrs/walker.tem"), graph);
const expectedTargets = {
  "Attack sound": "rpgtk:/Media/tone.wav",
  "Level-up program": "rpgtk:/Prg/start.prg",
  "Walk south · frame 1 · top": "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1",
};
for (const [evidence, target] of Object.entries(expectedTargets)) {
  assert.equal(walker.references.outgoing.find(edge => edge.evidence === evidence)?.target?.$ref, target);
}
for (const path of ["Boards/text-room.brd", "Boards/fixed-room.brd"]) {
  const room = recordFor(artifacts.get(path), graph);
  const boardEdge = evidence => room.references.outgoing.find(edge => edge.evidence.startsWith(evidence));
  assert.equal(boardEdge("Board background image").target.$ref, "rpgtk:/Bitmap/face.gif");
  assert.equal(boardEdge("Board music").target.$ref, "rpgtk:/Media/note.mid");
  assert.deepEqual(boardEdge("Board program").position, { x: 2, y: 3, layer: 1 });
  assert.equal(boardEdge("Board program").target.$ref, "rpgtk:/Prg/start.prg");
  assert.equal(boardEdge("Board item").target.$ref, "rpgtk:/Item/token-2.itm");
  assert.equal(boardEdge("Item activation program").target.$ref, "rpgtk:/Prg/start.prg");
  assert.equal(boardEdge("Item multitask program").status, "missing");
}
for (const path of ["Item/text-20-item.itm", "Item/text-item-0.itm"]) {
  const embedded = itemSprites(artifacts.get(path), artifacts, graph);
  assert.equal(embedded.walking[0].frames[0], null);
  assert.equal(embedded.walking[0].frames[1].embedded, true);
  assert.equal(embedded.rest.embedded, true);
  assert.deepEqual([...embedded.rest.pixels.slice(0, 8)], [0, 0, 0, 0, 0, 255, 0, 255]);
  assert.deepEqual([...embedded.rest.pixels.slice(128, 132)], [255, 0, 0, 255]);
  const record = recordFor(artifacts.get(path), graph);
  assert.equal(record.references.outgoing.find(edge => edge.evidence === "Equip program").target.$ref,
    "rpgtk:/Prg/start.prg");
}
const textItem = recordFor(artifacts.get("Item/text-item-1.itm"), graph);
assert.equal(textItem.references.outgoing.find(edge => edge.evidence === "Walking frame 1 bottom").target.$ref,
  "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1");
assert.equal(textItem.references.outgoing.find(edge => edge.evidence === "Item animation").target.$ref,
  "rpgtk:/Misc/effect.anm");
const textEffect = recordFor(artifacts.get("StatusE/text-ste.ste"), graph);
assert.deepEqual(textEffect.references.outgoing.map(edge => edge.target?.$ref), ["rpgtk:/Prg/start.prg"]);
for (const size of [0, 1]) {
  const hero = recordFor(artifacts.get(`Chrs/text-hero-${size}.tem`), graph);
  const target = evidence => hero.references.outgoing.find(edge => edge.evidence === evidence)?.target?.$ref;
  assert.equal(target("Special move slot 0"), "rpgtk:/SpcMove/pulse.spc");
  assert.equal(target("Attack sound"), "rpgtk:/Media/tone.wav");
  assert.equal(target("Level-up program"), "rpgtk:/Prg/start.prg");
  if (size === 1) {
    assert.equal(target("Walk south · frame 1 · top"), "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1");
  } else {
    const pixels = standaloneTilePixels({ width: 32, height: 32, pixels: hero.data.embeddedWalking[0] });
    assert.deepEqual([...pixels.slice(0, 8)], [0, 0, 0, 0, 0, 255, 0, 255]);
    assert.deepEqual([...pixels.slice(128, 132)], [255, 0, 0, 255]);
  }
}
for (const { path } of olderCharacters) {
  const hero = recordFor(artifacts.get(path), graph);
  const edge = evidence => hero.references.outgoing.find(ref => ref.evidence === evidence);
  assert.equal(edge("Character portrait").target.$ref, "rpgtk:/Bitmap/face.gif");
  assert.equal(edge("Special move slot 0").target.$ref, "rpgtk:/SpcMove/pulse.spc");
  for (const label of ["Attack", "Special move"]) assert.equal(edge(`${label} sound`).target.$ref, "rpgtk:/Media/tone.wav");
  for (const label of ["Defense", "Defeat"]) assert.equal(edge(`${label} sound`).status, "missing");
  assert.equal(edge("Level-up program").target.$ref, "rpgtk:/Prg/start.prg");
  if (path === "Chrs/text-1-1.tem") assert.equal(hero.references.outgoing.find(ref => ref.value === "battle-0.gph").status, "missing");
  if (path === "Chrs/text-1-1.tem") {
    for (const evidence of ["Walk south · frame 1 · top", "Walk west · frame 4 · bottom"]) {
      assert.deepEqual(edge(evidence).target, { $ref: "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1", tileIndex: 2 });
    }
  } else {
    assert.equal(hero.data.embeddedWalking.length, 16);
    for (let i = 0; i < 16; i++) {
      const pixels = standaloneTilePixels({ width: 32, height: 32, pixels: hero.data.embeddedWalking[i] });
      assert.deepEqual([...pixels.slice(0, 8)], [i + 1, 0, 0, 255, 0, 0, 0, 0]);
    }
  }
  for (const suffix of ["short-graphics", "short-tail"]) assert.equal(artifacts.get(`${path}.${suffix}.tem`).decodeStatus, "error");
}
for (const name of ["bad-old-size", "bad-old-color", "unsupported-old-version"]) assert.equal(artifacts.get(`Chrs/${name}.tem`).decodeStatus, "error", name);
const threaded = recordFor(artifacts.get("Boards/threaded-room.brd"), graph);
const threadEdges = threaded.references.outgoing.filter(edge => edge.evidence.startsWith("Board thread"));
assert.deepEqual(threadEdges.map(edge => [edge.evidence, edge.status, edge.target?.$ref]), [
  ["Board thread · slot 0", "resolved", "rpgtk:/Prg/start.prg"],
  ["Board thread · slot 2", "missing", undefined],
]);
assert.equal(threaded.references.outgoing.find(edge => edge.evidence.startsWith("Item activation program")).target.$ref,
  "rpgtk:/Prg/start.prg");
for (const archivePath of process.argv.slice(2)) {
  if (/\.gam$/i.test(archivePath)) {
    const data = readMainFile(await readFile(archivePath));
    recordFor({ ...data, path: "external.gam", type: "gam", decodeStatus: "decoded" }, graph, { external: true });
    continue;
  }
  const archive = await openGameArchive(await readFile(archivePath), bytes => JSZip.loadAsync(bytes));
  const imported = await load(archive);
  for (const artifact of imported.artifacts.values()) recordFor(artifact, imported.graph);
  console.log(`Validated ${imported.artifacts.size} records from ${archivePath}.`);
}
console.log("Format specs passed: synthetic file layouts, expected data, schema, and reference cases.");
