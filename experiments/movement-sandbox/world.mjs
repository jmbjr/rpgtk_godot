// Original synthetic board for movement acceptance, NOT an imported BSTW map.
export const TILE_SIZE = 32;
export const TERRAIN = Object.freeze([
  "################",
  "#............I.#",
  "#.....###......#",
  "#.....#........#",
  "#.....#........#",
  "#.....#....##..#",
  "#..........##..#",
  "#..............#",
  "#...##.........#",
  "#..............#",
  "################",
]);

const width = TERRAIN[0].length;
if (TERRAIN.some(row => row.length !== width || !/^[#.I]+$/.test(row))) {
  throw Error("Synthetic movement board must be a rectangular #/.I tile map.");
}
const innRow = TERRAIN.findIndex(row => row.includes("I"));
const innColumn = TERRAIN[innRow].indexOf("I");

export const SANDBOX_WORLD = Object.freeze({
  tileSize: TILE_SIZE,
  width,
  height: TERRAIN.length,
  rows: TERRAIN,
  spawn: Object.freeze({ x: 2.5 * TILE_SIZE, y: 9.5 * TILE_SIZE }),
  landmark: Object.freeze({
    name: "Inn (interaction not implemented)",
    x: (innColumn + 0.5) * TILE_SIZE,
    y: (innRow + 0.5) * TILE_SIZE,
  }),
});

export function tileAt(world, col, row) {
  if (!Number.isInteger(col) || !Number.isInteger(row) ||
      col < 0 || row < 0 || col >= world.width || row >= world.height) return "#";
  return world.rows[row][col];
}

export function solidAt(world, col, row) {
  return tileAt(world, col, row) === "#";
}
