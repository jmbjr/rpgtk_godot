import { tilePixels } from "./artifacts.mjs";

const tileSize = 32;
const directions = ["South", "East", "North", "West"];

export function standaloneTilePixels(tile) {
  if (!tile?.pixels || ![16, 32].includes(tile.width) || tile.height !== tile.width) return null;
  const pixels = new Uint8ClampedArray(tileSize * tileSize * 4);
  const scale = tileSize / tile.width;
  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const color = tile.pixels[Math.floor(x / scale) * tile.height + Math.floor(y / scale)];
      if (color === -1) continue;
      const offset = (y * tileSize + x) * 4;
      pixels[offset] = color & 255;
      pixels[offset + 1] = (color >>> 8) & 255;
      pixels[offset + 2] = (color >>> 16) & 255;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

function pixelsFor(edge, artifacts, graph) {
  const asset = artifacts.get(edge?.to);
  if (asset?.type === "tan") {
    const first = graph.outgoing.get(asset.path)?.[0];
    const set = artifacts.get(first?.to);
    return set?.bytes ? tilePixels(set, first.tile) : standaloneTilePixels(set);
  }
  return asset?.bytes ? tilePixels(asset, edge.tile) : standaloneTilePixels(asset);
}

function compose(columns, rows, parts, artifacts, graph) {
  const width = columns * tileSize;
  const height = rows * tileSize;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const missing = [];
  for (const part of parts) {
    const tile = pixelsFor(part.edge, artifacts, graph);
    if (!tile) {
      missing.push(part);
      continue;
    }
    if (part.shade?.some(Boolean)) {
      for (let i = 0; i < tile.length; i += 4) {
        if (!tile[i + 3]) continue;
        for (let channel = 0; channel < 3; channel++) tile[i + channel] += part.shade[channel];
      }
    }
    for (let y = 0; y < tileSize; y++) {
      const start = y * tileSize * 4;
      const destination = ((part.y * tileSize + y) * width + part.x * tileSize) * 4;
      pixels.set(tile.subarray(start, start + tileSize * 4), destination);
    }
  }
  return { width, height, pixels, parts, missing };
}

export function enemySprite(enemy, artifacts, graph) {
  const { width, height, tileStride, tiles } = enemy;
  if (!Number.isInteger(width) || width < 1 || width > 19 ||
      !Number.isInteger(height) || height < 1 || height > tileStride) return null;
  const byEvidence = new Map((graph.outgoing.get(enemy.path) ?? []).map(edge => [edge.evidence, edge]));
  const parts = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const index = x * tileStride + y;
      const value = tiles[index];
      if (value) parts.push({ x, y, value, edge: byEvidence.get(`Enemy tile · slot ${index + 1}`) });
    }
  }
  return compose(width, height, parts, artifacts, graph);
}

export function tileBitmapSprite(bitmap, artifacts, graph) {
  if (!Number.isInteger(bitmap?.width) || !Number.isInteger(bitmap?.height) ||
      bitmap.width < 1 || bitmap.height < 1 ||
      bitmap.width > 256 || bitmap.height > 256) return null;
  const byEvidence = new Map((graph.outgoing.get(bitmap.path) ?? [])
    .map(edge => [edge.evidence, edge]));
  const parts = bitmap.tiles
    // The saved (width+1)x(height+1) array has sentinel cells:
    // native Toolkit 3 renders only the smaller visible rectangle.
    .filter(tile => tile.value && tile.x < bitmap.width && tile.y < bitmap.height)
    .map(tile => ({
      ...tile,
      edge: byEvidence.get(`Bitmap tile (${tile.x}, ${tile.y})`),
    }));
  return compose(bitmap.width, bitmap.height, parts, artifacts, graph);
}

export function itemSprites(item, artifacts, graph) {
  const byEvidence = new Map((graph.outgoing.get(item.path) ?? []).map(edge => [edge.evidence, edge]));
  if (item.embeddedGraphics) {
    const sprite = pixels => pixels && ({
      width: tileSize, height: tileSize, pixels: standaloneTilePixels({ width: tileSize, height: tileSize, pixels }),
      parts: [], missing: [], embedded: true,
    });
    return {
      rest: sprite(item.embeddedGraphics.rest),
      walking: directions.map((direction, group) => ({
        direction, frames: item.embeddedGraphics.walking.slice(group * 4, group * 4 + 4).map(sprite),
      })),
    };
  }
  const frames = [item.rest, ...item.walking];
  const tall = frames.some(frame => frame[0]);
  const composeFrame = (values, label) => {
    const parts = [];
    for (const [index, value] of values.entries()) {
      if (value) parts.push({ x: 0, y: tall ? index : 0, value, edge: byEvidence.get(`${label} ${index ? "bottom" : "top"}`) });
    }
    return parts.length ? compose(1, tall ? 2 : 1, parts, artifacts, graph) : null;
  };
  return {
    rest: composeFrame(item.rest, "Rest graphic"),
    walking: directions.map((direction, group) => ({
      direction,
      frames: item.walking.slice(group * 4, group * 4 + 4)
        .map((frame, index) => composeFrame(frame, `Walking frame ${group * 4 + index + 1}`)),
    })),
  };
}

export function battleBackground(background, artifacts, graph) {
  const { width, height, tiles, shading } = background;
  const byEvidence = new Map((graph.outgoing.get(background.path) ?? []).map(edge => [edge.evidence, edge]));
  const parts = [];
  for (const [index, value] of tiles.entries()) {
    if (!value) continue;
    const x = Math.floor(index / height);
    const y = index % height;
    parts.push({ x, y, value, shade: shading[index], edge: byEvidence.get(`Background tile (${x + 1}, ${y + 1})`) });
  }
  return compose(width, height, parts, artifacts, graph);
}

export function animationFrames(frames) {
  const last = frames.findLastIndex(frame => frame.image || frame.sound);
  return frames.slice(0, last + 1);
}

export function keyFrameColor(pixels, color) {
  const red = color & 255;
  const green = (color >>> 8) & 255;
  const blue = (color >>> 16) & 255;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === red && pixels[i + 1] === green && pixels[i + 2] === blue) pixels[i + 3] = 0;
  }
}

export function characterArtworkSprite(character, frame, artifacts, graph) {
  if (frame.pixels) return { width: 32, height: 32,
    pixels: standaloneTilePixels({ width: 32, height: 32, pixels: frame.pixels }), missing: [] };
  const byEvidence = new Map((graph.outgoing.get(character.path) ?? []).map(edge => [edge.evidence, edge]));
  return compose(frame.width / 32, frame.height / 32,
    frame.parts.filter(part => part.value).map(part => ({ ...part, edge: byEvidence.get(part.evidence) })), artifacts, graph);
}
