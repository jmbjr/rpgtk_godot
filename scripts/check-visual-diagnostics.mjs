import assert from "node:assert/strict";
import JSZip from "../vendor/jszip.min.js";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import { diagnosticStyle, visualTileBytes, visualCharacterBytes } from "../docs/specs/fixtures/visual-character-fixtures.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { characterArtworkSprite, standaloneTilePixels } from "../sprites.mjs";

const zip = new JSZip();
for (const [name, bytes] of visualTileBytes) zip.file("Tiles/" + name, bytes);
for (const [name, bytes] of visualCharacterBytes) zip.file(name, bytes);
for (const { path, bytes } of fixtures.filter(f => ["Bitmap/face.gif", "Media/tone.wav", "Prg/start.prg"].includes(f.path))) {
  zip.file(path, bytes);
}
const { artifacts } = await readArtifacts(zip, {});
const graph = buildReferences(artifacts);
const pixel = (pixels, width, x, y) => [...pixels.slice((y * width + x) * 4, (y * width + x + 1) * 4)];

assert.equal(visualTileBytes.size, 35);
assert.equal(visualCharacterBytes.size, 7);
const actionColors = new Set();
for (const [name] of visualTileBytes) {
  const tile = artifacts.get("Tiles/" + name);
  assert.equal(tile.decodeStatus, "decoded", name);
  assert.deepEqual([tile.width, tile.height], [32, 32], name);
  const pixels = standaloneTilePixels(tile);
  assert.deepEqual(pixel(pixels, 32, 0, 0), [0, 0, 0, 0], name + " transparent outside");
  assert.deepEqual(pixel(pixels, 32, 2, 2), [255, 253, 235, 255], name + " white registration corner");
  assert.equal(pixel(pixels, 32, 16, 16)[3], 255, name + " visible center");
  if (/^diag-(attack|defense|special-move|defeat)-1/.test(name)) {
    actionColors.add(pixel(pixels, 32, 9, 9).join(","));
  }
}
assert.equal(actionColors.size, 4, "Four action families must have visually distinct accent colors");

// Verify *facings*, not just accent color. This uses pixels from the face so
// a renderer cannot accidentally pass by tinting four identical front views.
// Eye positions and protruding nose are stable, even when the animation frame
// marker changes on the right edge.
const inkFace = [13, 16, 31, 255];
const skinFace = [248, 199, 143, 255];
const hairFace = [118, 98, 138, 255];
const background = [24, 31, 49, 255];
const facing = {
  South: { leftEye: inkFace, rightEye: inkFace, leftNose: background, rightNose: background },
  East: { leftEye: skinFace, rightEye: inkFace, leftNose: background, rightNose: skinFace },
  North: { leftEye: hairFace, rightEye: hairFace, leftNose: background, rightNose: background },
  West: { leftEye: inkFace, rightEye: skinFace, leftNose: skinFace, rightNose: background },
};
const checkFacing = (pixels, direction, title) => {
  const expected = facing[direction];
  assert.ok(expected, `${title}: unknown direction`);
  for (const [part, x, y] of [
    ["leftEye", 12, 15], ["rightEye", 19, 15],
    ["leftNose", 8, 19], ["rightNose", 23, 19],
  ]) assert.deepEqual(pixel(pixels, 32, x, y), expected[part],
    `${title}: ${direction} ${part}`);
};
const directionSignatures = new Set();
for (const direction of ["South", "East", "North", "West"]) {
  const tile = artifacts.get(`Tiles/diag-walk-${direction.toLowerCase()}-top.gph`);
  assert.equal(tile.decodeStatus, "decoded");
  const pixels = standaloneTilePixels(tile);
  checkFacing(pixels, direction, tile.path);
  const signature = [12, 19].map(x => pixel(pixels, 32, x, 15).join(",")).join("|") +
    "|" + [8, 23].map(x => pixel(pixels, 32, x, 19).join(",")).join("|");
  directionSignatures.add(signature);
}
assert.equal(directionSignatures.size, 4, "All four walking facings must have different head pixels");

for (const [name] of visualCharacterBytes) {
  const character = artifacts.get(name);
  assert.equal(character.decodeStatus, "decoded", name);
  assert.equal(character.walking.length, 16);
  assert.equal(character.artwork.length, 27);
  const embedded = name.includes("-0.tem") || name.includes("hero-0.tem");
  if (embedded) {
    assert.equal(character.embeddedWalking.length, 16, name);
    for (const [index, walking] of character.embeddedWalking.entries()) {
      assert.equal(walking.length, 1024, name);
      const pixels = standaloneTilePixels({ width: 32, height: 32, pixels: walking });
      assert.deepEqual(pixel(pixels, 32, 0, 0), [0, 0, 0, 0], name + " transparent walk corner");
      assert.equal(pixel(pixels, 32, 16, 16)[3], 255, name + " visible walk center");
      checkFacing(pixels, character.walking[index].direction, `${name} walking frame ${index + 1}`);
    }
  } else {
    assert.equal(character.embeddedWalking, undefined, name);
    for (const walking of character.walking) {
      assert.equal(walking.parts.filter(part => part.value).length, 2);
    }
  }
  for (const frame of character.artwork) {
    const sprite = characterArtworkSprite(character, frame, artifacts, graph);
    assert.equal(sprite.missing.length, 0, name + " " + frame.kind + " " + frame.frame);
    assert.deepEqual([sprite.width, sprite.height], [frame.width, frame.height]);
    assert.deepEqual(pixel(sprite.pixels, sprite.width, 0, 0), [0, 0, 0, 0], name + " transparent art corner");
    assert.equal(pixel(sprite.pixels, sprite.width, 16, 16)[3], 255, name + " visible action center");
    if (frame.parts) assert.ok(frame.parts.every(part => part.value), name + " filled art references");
  }
}
assert.equal(diagnosticStyle.id, "diagnostic-v1");
console.log("Visual diagnostics passed: distinct south/east/north/west faces in referenced and embedded walking art; 35 vivid GPH tiles, seven TEM layouts, visible walking/artwork, unique action colors, transparent corners and zero missing artwork.");
