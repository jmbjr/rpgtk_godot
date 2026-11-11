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

for (const [name] of visualCharacterBytes) {
  const character = artifacts.get(name);
  assert.equal(character.decodeStatus, "decoded", name);
  assert.equal(character.walking.length, 16);
  assert.equal(character.artwork.length, 27);
  const embedded = name.includes("-0.tem") || name.includes("hero-0.tem");
  if (embedded) {
    assert.equal(character.embeddedWalking.length, 16, name);
    for (const walking of character.embeddedWalking) {
      assert.equal(walking.length, 1024, name);
      const pixels = standaloneTilePixels({ width: 32, height: 32, pixels: walking });
      assert.deepEqual(pixel(pixels, 32, 0, 0), [0, 0, 0, 0], name + " transparent walk corner");
      assert.equal(pixel(pixels, 32, 16, 16)[3], 255, name + " visible walk center");
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
console.log("Visual diagnostics passed: 35 vivid GPH tiles, seven TEM layouts, visible walking/artwork, unique action colors, transparent corners and zero missing artwork.");
