import assert from "node:assert/strict";
import { connectionCounts, connectionNeighbors, referenceDestination } from "../connection-map.mjs";

const board = "Boards/room.brd";
const program = "Prg/start.prg";
const set = "Tiles/ground.tst";
const artifacts = new Map([board, program, set].map(path => [path, {}]));
const boardUse = { from: board, to: set, tile: 2, tiles: 9 };
const firstCall = { from: program, to: set, tile: 2, line: 3 };
const secondCall = { ...firstCall, line: 8 };
const anotherTile = { from: board, to: set, tile: 4, tiles: 1 };
const incoming = [boardUse, firstCall, secondCall, anotherTile];

assert.deepEqual(connectionCounts(incoming, true), { files: 2, references: 4, placements: 10, unresolved: 0 });
assert.deepEqual(connectionCounts(incoming.filter(edge => edge.tile === 2), true),
  { files: 2, references: 3, placements: 9, unresolved: 0 });
const incomingGroups = connectionNeighbors(incoming, true);
assert.equal(incomingGroups.length, 2);
assert.deepEqual(incomingGroups.find(node => node.path === program).edges, [firstCall, secondCall]);
assert.deepEqual(referenceDestination(secondCall, true, artifacts), { path: program, tile: undefined, line: 8 });
assert.deepEqual(referenceDestination(boardUse, false, artifacts), { path: set, tile: 2, line: undefined });

const missing = { from: board, value: "unknown.prg", status: "Missing" };
const dynamic = { from: board, value: "unknown.prg", status: "Dynamic" };
const outgoing = [boardUse, anotherTile, missing, dynamic];
assert.deepEqual(connectionCounts(outgoing, false), { files: 1, references: 4, placements: 10, unresolved: 2 });
const outgoingGroups = connectionNeighbors(outgoing, false);
assert.deepEqual(outgoingGroups.filter(node => node.path).map(node => node.tile), [2, 4]);
assert.deepEqual(outgoingGroups.filter(node => !node.path).map(node => node.status), ["Missing", "Dynamic"]);
assert.equal(referenceDestination(missing, false, artifacts), undefined);

const outside = { ...boardUse, external: true };
assert.equal(connectionNeighbors([boardUse, outside], true).length, 2);
assert.equal(connectionCounts([boardUse, outside], true).files, 2);
assert.equal(referenceDestination(outside, true, artifacts), undefined);
console.log("Connection map passed: distinct files, repeated references, placements, tiles, and unresolved evidence.");
