// Visual diagnostic ENE editions, distinct from the original format fixtures.
// The synthetic original Enemy/foe.ene and Enemy/animated.ene remain unchanged.
import { fixtures } from "./format-fixtures.mjs";

const fixturePaths = new Set(fixtures.map(fixture => fixture.path));
const paths = ["Enemy/foe.ene", "Enemy/animated.ene"];
for (const path of paths) if (!fixturePaths.has(path)) throw new Error("Missing source ENE fixture: " + path);

const color = (r, g, b) => r | (g << 8) | (b << 16);
const bg = color(24, 31, 49);
const ink = color(13, 16, 31);
const white = color(255, 253, 235);
const face = color(255, 212, 154);
const fill = (count, value) => Array(count).fill(value);

// Draw a 64x64 enemy and split it into column-major 32x32 GPH quadrants.
// A 2x2 graphic validates ENE's x*7+y tile indexing. The left and right
// quadrants have different eye/mark placement; swapped columns stand out.
function enemyArt(animated) {
  const accent = animated ? color(188, 113, 248) : color(244, 116, 94);
  const pixels = Array(64 * 64).fill(-1);
  const set = (x, y, value) => {
    if (x >= 0 && x < 64 && y >= 0 && y < 64) pixels[x * 64 + y] = value;
  };
  const rect = (x0, y0, x1, y1, value) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set(x, y, value);
  };
  rect(6, 9, 57, 57, accent);
  rect(10, 13, 53, 53, bg);
  // Asymmetric horns, brows and eyes make quadrants visually unambiguous.
  rect(13, 2, 20, 16, accent);
  rect(43, 5, 50, 18, accent);
  rect(13, 21, 27, 25, face);
  rect(38, 21, 49, 25, face);
  rect(17, 26, 23, 34, white);
  rect(40, 26, 46, 34, white);
  rect(21, 29, 24, 32, ink);
  rect(40, 29, 43, 32, ink);
  rect(20, 41, 46, 46, face);
  rect(24, 45, 27, 50, white);
  rect(40, 45, 43, 50, white);
  // A single diagonal scar is present only in the short-tail specimen.
  if (!animated) for (let n = 0; n < 9; n++) set(28 + n, 18 + n, white);
  else {
    rect(29, 15, 36, 19, white); // raised crown on the animation-tail form
    rect(29, 37, 36, 40, accent);
  }
  // Colored lower identification studs: 1,2,3,4 by quadrant.
  for (let index = 0; index < 4; index++) {
    const x = index < 2 ? 14 : 44;
    const y = index % 2 === 0 ? 15 : 51;
    rect(x, y, x + 2, y + 2, white);
  }
  return pixels;
}

const gph = pixels => Buffer.from(
  ["RPGTLKIT TILE", 2, 0, 1, 0, ...pixels, ""].join("\r\n"), "ascii"
);
const keys = ["short", "animated"];
export const visualEnemyTileBytes = new Map();
for (const [index, key] of keys.entries()) {
  const all = enemyArt(Boolean(index));
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
    const part = [];
    for (let localX = 0; localX < 32; localX++)
      for (let localY = 0; localY < 32; localY++)
        part.push(all[(x * 32 + localX) * 64 + y * 32 + localY]);
    visualEnemyTileBytes.set("diag-enemy-" + key + "-" + x + "-" + y + ".gph", gph(part));
  }
}

function enemyFile(animated) {
  const key = animated ? "animated" : "short";
  const tiles = Array(19 * 7).fill("");
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
    tiles[x * 7 + y] = "diag-enemy-" + key + "-" + x + "-" + y + ".gph";
  }
  const moves = Array.from({ length: 101 }, (_, i) => [i === 0 ? "pulse.spc" : "", ""]).flat();
  const slots = ["tone.wav", "", "", ""];
  const animations = animated ? ["effect.anm", "effect.anm", "effect.anm", "effect.anm"] : [];
  const data = [
    "RPGTLKIT ENEMY", 2, 0,
    animated ? "Foe Animated Diagnostic" : "Foe Short Diagnostic",
    14, 5, 4, 3, 1, 0, 0, 2, 2,
    ...tiles, ...moves,
    0, 0, "", 8, 3, "start.prg", "", ...slots, ...animations, "",
  ];
  return Buffer.from(data.join("\r\n"), "ascii");
}
export const visualEnemyBytes = new Map([
  ["Enemy/foe.ene", enemyFile(false)],
  ["Enemy/animated.ene", enemyFile(true)],
]);
export const enemyDiagnosticStyle = {
  id: "diagnostic-v1",
  count: visualEnemyBytes.size,
  tileCount: visualEnemyTileBytes.size,
  dimensions: [2, 2],
  shortTailAnimations: 0,
  extendedTailAnimations: 4,
};
