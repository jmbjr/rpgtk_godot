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

export function matchingArtwork(character, index) {
  const frames = character.walking.map((frame, i) => ({
    label: `${frame.direction} walking · frame ${frame.frame}`,
    pixels: character.embeddedWalking?.[i],
  }));
  for (const frame of character.artwork) {
    frames.push({ label: `${frame.kind} · frame ${frame.frame}`, pixels: frame.pixels });
  }

  const results = [];
  for (const { label, pixels } of frames) {
    if (!pixels?.some(color => color !== -1)) continue;
    const rgba = standaloneTilePixels({ width: 32, height: 32, pixels });
    const matches = [];
    for (const { set, tile } of index.get(fingerprint(rgba)) ?? []) {
      if (samePixels(rgba, tilePixels(set, tile))) matches.push({ path: set.path, tile });
    }
    if (matches.length) results.push({ label, pixels: rgba, matches });
  }
  return results;
}
