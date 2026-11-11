import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, readTileset } from "../artifacts.mjs";
import { indexTilesets, matchEmbeddedTile } from "../tile-matches.mjs";

function tileset(path, width, colors) {
  const tileSize = width * width * 3;
  const bytes = Buffer.alloc(6 + colors.length * tileSize);
  bytes.writeInt16LE(20, 0);
  bytes.writeInt16LE(colors.length, 2);
  bytes.writeInt16LE(width === 32 ? 1 : 2, 4);
  for (const [i, color] of colors.entries()) {
    bytes.fill(Buffer.of(0, 1, 2), 6 + i * tileSize, 6 + (i + 1) * tileSize);
    for (let x = 0; x < width / 16; x++) for (let y = 0; y < width / 16; y++) {
      bytes[6 + i * tileSize + (x * width + y) * 3] = color;
      bytes[7 + i * tileSize + (x * width + y) * 3] = 0;
      bytes[8 + i * tileSize + (x * width + y) * 3] = 0;
    }
  }
  return { ...readTileset(bytes), path, type: "tst", decodeStatus: "decoded" };
}

const pixels = Array(1024).fill(-1);
for (const index of [0, 1, 32, 33]) pixels[index] = 255;
const sets = [
  tileset("Tiles/a.tst", 32, [255, 254, 255]),
  tileset("Tiles/b.tst", 16, [255]),
  { ...tileset("Tiles/broken.tst", 32, [255]), decodeStatus: "error" },
];
const index = await indexTilesets(new Map(sets.map(set => [set.path, set])));
assert.deepEqual(matchEmbeddedTile(pixels, index), [
  { path: "Tiles/a.tst", tile: 1 },
  { path: "Tiles/a.tst", tile: 3 },
  { path: "Tiles/b.tst", tile: 1 },
]);
const unmatched = [...pixels];
unmatched[0] = 17;
assert.deepEqual(matchEmbeddedTile(unmatched, index), []);
assert.equal(matchEmbeddedTile(Array(1024).fill(-1), index), null);
assert.deepEqual(matchEmbeddedTile(pixels, new Map()), []);

if (process.argv[2]) {
  const zip = await openGameArchive(await readFile(process.argv[2]), bytes => JSZip.loadAsync(bytes));
  const { artifacts } = await readArtifacts(zip, {});
  const james = artifacts.get("Chrs/james.tem");
  const dustballIndex = await indexTilesets(artifacts);
  const attack = james.artwork.find(frame => frame.kind === "Attack" && frame.frame === 1);
  assert.ok(matchEmbeddedTile(attack.pixels, dustballIndex).some(match => match.path === "Tiles/James.tst" && match.tile === 40));
  for (const [i, frame] of james.walking.entries()) {
    if (["North", "South"].includes(frame.direction)) {
      assert.deepEqual(matchEmbeddedTile(james.embeddedWalking[i], dustballIndex), []);
    }
  }
  console.log("DustBall: James attack frame 1 matches Tiles/James.tst tile 40.");
}
console.log("Tile matching checks passed for duplicate matches, transparency, 16-pixel tiles, near misses and empty results.");
