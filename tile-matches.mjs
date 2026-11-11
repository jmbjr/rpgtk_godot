import { tilePixels } from "./artifacts.mjs";
import { standaloneTilePixels } from "./sprites.mjs";

function visiblePixel(pixels, i) {
  if (pixels[i + 3] === 0) return 0;
  return pixels[i] | (pixels[i + 1] << 8) | (pixels[i + 2] << 16) | (pixels[i + 3] << 24);
}

function fingerprint(pixels) {
  let hash = 2166136261;
  for (let i = 0; i < pixels.length; i += 4) {
    hash = Math.imul(hash ^ visiblePixel(pixels, i), 16777619);
  }
  return hash;
}

function samePixels(first, second) {
  for (let i = 0; i < first.length; i += 4) {
    if (visiblePixel(first, i) !== visiblePixel(second, i)) return false;
  }
  return true;
}

export async function indexTilesets(artifacts) {
  const index = new Map();
  let scanned = 0;
  for (const set of artifacts.values()) {
    if (set.type !== "tst" || set.decodeStatus !== "decoded") continue;
    for (let tile = 1; tile <= set.count; tile++) {
      const hash = fingerprint(tilePixels(set, tile));
      if (!index.has(hash)) index.set(hash, []);
      index.get(hash).push({ set, tile });
      if (++scanned % 256 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  return index;
}

// A blank frame has no visible artwork to compare.
export function matchEmbeddedTile(pixels, index) {
  if (!pixels.some(color => color !== -1)) return null;
  const rgba = standaloneTilePixels({ width: 32, height: 32, pixels });
  const matches = [];
  for (const { set, tile } of index.get(fingerprint(rgba)) ?? []) {
    if (samePixels(rgba, tilePixels(set, tile))) matches.push({ path: set.path, tile });
  }
  return matches;
}
