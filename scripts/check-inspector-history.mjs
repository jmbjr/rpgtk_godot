import assert from "node:assert/strict";
import { createInspectorHistory } from "../inspector-history.mjs";

let index = 0;
const entries = [null];
const browser = {
  get state() { return entries[index]; },
  replaceState(state) { entries[index] = structuredClone(state); },
  pushState(state) { entries.splice(++index, entries.length, structuredClone(state)); },
};
const trail = createInspectorHistory(browser);
const traverse = delta => trail.restore(entries[index += delta]);

const board = { path: "Boards/room.brd", folder: "Boards/" };
const tileset = { path: "Tiles/ground.tst", folder: "Tiles/" };
const tile = { ...tileset, tile: 2 };
const program = { path: "Prg/start.prg", folder: "Prg/", line: 6 };

trail.reset("first-zip", board);
trail.visit(tileset);
trail.visit(tile);
trail.visit(program);
trail.visit(tile);
trail.visit(tile);
assert.equal(entries.length, 5);
assert.deepEqual(traverse(-1), program);
assert.deepEqual(traverse(-1), tile);
assert.deepEqual(traverse(-1), tileset);
assert.deepEqual(traverse(-1), board);
assert.deepEqual(traverse(1), tileset);
assert.deepEqual(traverse(1), tile);
assert.deepEqual(traverse(1), program);

const otherLine = { ...program, line: 12 };
trail.visit(otherLine);
assert.equal(entries.length, 5, "Branching replaces the forward trail");
assert.deepEqual(traverse(-1), program);
assert.deepEqual(traverse(1), otherLine);
const root = { path: "main.gam", folder: "" };
trail.replace(root);
assert.equal(entries.length, 5, "Loading a Main File updates the current stop");
assert.deepEqual(traverse(-1), program);
assert.deepEqual(traverse(1), root);

const empty = { path: null, folder: "Empty/" };
trail.reset("second-zip", board);
assert.equal(traverse(-1), undefined, "A file with the same path in an older ZIP is ignored");
trail.visit(empty);
assert.deepEqual(traverse(-1), board, "A new branch starts from the currently visible selection");
assert.deepEqual(traverse(1), empty);
assert.equal(traverse(-2), undefined);
assert.deepEqual(traverse(1), board, "Forward can re-enter the active ZIP's trail");

console.log("Inspector history passed: repeated visits, exact tiles and lines, branching, and archive isolation.");
