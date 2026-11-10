import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readTileset } from "../artifacts.mjs";
import { tilesetPdf } from "../tile-pdf.mjs";

const fixture = await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url));
const header = Buffer.from(fixture.subarray(0, 6));
header.writeInt16LE(7, 2);
const firstTile = fixture.subarray(6, 6 + 3072);
const bytes = Buffer.concat([header, fixture.subarray(6), ...Array(5).fill(firstTile)]);
const artifact = { ...readTileset(bytes), path: "Tiles/print-test.tst", type: "tst", decodeStatus: "decoded" };
const graph = { incoming: new Map(), outgoing: new Map() };
const pdf = await tilesetPdf(artifact, graph);
assert.equal(pdf.type, "application/pdf");
const contents = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
assert.match(contents, /^%PDF-/);
assert.match(contents, /\/Count 2\b/);
assert.equal([...contents.matchAll(/\/Subtype \/Image\b/g)].length, 7);
console.log("Tileset PDF export passed: seven cards, two pages, and one image per card.");
