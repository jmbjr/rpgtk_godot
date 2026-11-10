import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts } from "../artifacts.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { readMainFile } from "../model.mjs";
import { artifactId } from "../records.mjs";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import JSZip from "../vendor/jszip.min.js";

const specs = new URL("../docs/specs/", import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, specs), "utf8"));
const catalog = await json("../../catalog.json");
const ajv = new Ajv2020({ strictTypes: false });
for (const name of ["tile-record", "artifact-record"]) {
  ajv.addSchema(await json(`${name}.schema.json`), `${name}.schema.json`);
}
const validate = ajv.compile(await json("connected-game.schema.json"));

function check(artifacts, options) {
  const graph = JSON.parse(JSON.stringify(connectedGameRecord(artifacts, catalog, options)));
  assert.ok(validate(graph), JSON.stringify(validate.errors));
  const all = { ...graph.artifacts, ...graph.actors, ...graph.commands, ...graph.capabilities };
  for (const [id, record] of Object.entries(all)) assert.equal(record.$id, id);
  const resolve = ({ $ref }) => {
    const [id, pointer] = $ref.split("#", 2);
    assert.ok(Object.hasOwn(all, id), `Missing reference: ${$ref}`);
    return pointer ? pointer.slice(1).split("/").reduce((node, key) => {
      const part = key.replaceAll("~1", "/").replaceAll("~0", "~");
      assert.ok(Object.hasOwn(node, part), `Missing pointer: ${$ref}`);
      return node[part];
    }, all[id]) : all[id];
  };
  const checkEdge = edge => {
    const source = resolve(edge.source);
    if (edge.line && source.format === "prg") assert.ok(edge.line <= source.data.lines.length);
    if (edge.target) {
      assert.equal(edge.status, "resolved");
      const target = resolve(edge.target);
      if (edge.target.tileIndex) assert.equal(target.number, edge.target.tileIndex);
    } else {
      assert.notEqual(edge.status, "resolved");
    }
  };
  if (graph.root.mainFile) assert.equal(resolve(graph.root.mainFile).format, "gam");
  for (const candidate of graph.root.candidates ?? []) assert.equal(resolve(candidate).format, "gam");
  for (const edge of graph.edges) checkEdge(edge);
  for (const record of Object.values(graph.artifacts)) {
    for (const edge of record.references.outgoing) {
      checkEdge(edge);
      assert.equal(edge.source.$ref, record.$id);
    }
    for (const edge of record.references.incoming) {
      checkEdge(edge);
      assert.equal(edge.target.$ref.split("#")[0], record.$id);
    }
  }
  assert.equal(graph.archive.fileCount, artifacts.size);
  assert.equal(Object.keys(graph.artifacts).length, artifacts.size + Number(Boolean(options.externalMain)));
  for (const path of artifacts.keys()) assert.ok(Object.hasOwn(graph.artifacts, artifactId(path)));
  assert.equal(Object.values(graph.coverage.referenceCounts).reduce((a, b) => a + b, 0), graph.edges.length);
  return graph;
}

const fixture = path => fixtures.find(entry => entry.path === path).bytes;
const zip = new JSZip();
zip.file("main.gam", fixture("main.gam"));
zip.file("Chrs/hero.tem", fixture("Chrs/hero.tem"));
zip.file("Enemy/foe.ene", fixture("Enemy/foe.ene"));
const board = fixture("Boards/room.brd");
// Replace the zero program count with a single placement at the stored (2, 3, layer 1).
const slot = Buffer.concat([
  Buffer.from([0, 0]), Buffer.from("start.prg\0"), Buffer.from([2, 0, 3, 0, 1, 0]), Buffer.alloc(9),
]);
zip.file("Boards/room.brd", Buffer.concat([board.subarray(0, -6), slot, board.subarray(-4)]));
zip.file("Prg/start.prg", [
  '#Run("start.prg")', '#Run(next$)', '#Run("missing.prg")', '#Run("ambiguous.prg")',
  '#Load(savefile$)', '#Load("slot.sav")', '#Put(1, 1, "two-tiles.tst3")', '#Run "legacy.prg"',
].join("\n"));
zip.file("Prg/ambiguous.prg", "");
zip.file("Other/Prg/ambiguous.prg", "");
zip.file("slot.sav", "A host save reference must stay external even if a file matches.");
zip.file("misc/# disconnected.txt", "inventory only");
zip.file("Tiles/two-tiles.tst", await readFile(new URL("fixtures/two-tiles.tst", specs)));

const options = { archiveName: "fixture.zip" };
const { artifacts } = await readArtifacts(zip, catalog);
const graph = check(artifacts, options);
const edge = (type, source, predicate = () => true) =>
  graph.edges.find(candidate => candidate.type === type && candidate.source.$ref === source && predicate(candidate));
assert.deepEqual(graph.root, { status: "configured", origin: "archive", mainFile: { $ref: "rpgtk:/main.gam" } });
const openingBoard = edge("opening-board", graph.root.mainFile.$ref).target.$ref;
assert.equal(openingBoard, "rpgtk:/Boards/room.brd");
assert.deepEqual(edge("board-tile", openingBoard).target, {
  $ref: "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1", tileIndex: 2,
});
const boardProgram = edge("board-program", openingBoard);
assert.match(boardProgram.evidence, /\(2, 3, layer 1\)/);
assert.deepEqual(boardProgram.position, { x: 2, y: 3, layer: 1 });
const programId = boardProgram.target.$ref;
assert.equal(programId, "rpgtk:/Prg/start.prg");
const invocation = edge("invokes", programId, candidate => candidate.line === 1);
assert.equal(invocation.target.$ref, "rpgtk-command:/run");
assert.ok(edge("implements-capability", invocation.target.$ref));
assert.equal(edge("script-file", programId, candidate => candidate.line === 1).target.$ref, programId);
for (const [line, status] of ["dynamic", "missing", "ambiguous", "dynamic", "external", "tile-index-out-of-range", "missing"].entries()) {
  assert.equal(edge("script-file", programId, candidate => candidate.line === line + 2).status, status);
}
assert.equal(graph.artifacts["rpgtk:/misc/%23%20disconnected.txt"].decode.status, "unidentified");
assert.equal(graph.actors["rpgtk-actor:/Chrs%2Fhero.tem"].kind, "character");
assert.equal(graph.actors["rpgtk-actor:/Enemy%2Ffoe.ene"].kind, "enemy");

const externalMain = {
  ...readMainFile(fixture("main.gam")), filename: "main.gam", board: "missing.brd", character: "",
};
const external = check(artifacts, { ...options, externalMain });
assert.deepEqual(external.root, { status: "configured", origin: "external", mainFile: { $ref: "rpgtk-main:/main.gam" } });
assert.deepEqual(external.artifacts["rpgtk-main:/main.gam"].references.outgoing.map(ref => ref.status),
  ["resolved", "missing", "unset"]);
const ambiguous = new Map(artifacts);
ambiguous.set("second.gam", { ...artifacts.get("main.gam"), path: "second.gam", board: "missing.brd" });
const ambiguousGraph = check(ambiguous, options);
assert.equal(ambiguousGraph.root.status, "ambiguous");
assert.equal(ambiguousGraph.artifacts["rpgtk:/second.gam"].references.outgoing[1].status, "missing");
const missing = new Map(artifacts);
missing.delete("main.gam");
assert.equal(check(missing, options).root.status, "missing");

const [archivePath, mainPath] = process.argv.slice(2);
if (archivePath) {
  const archive = await openGameArchive(await readFile(archivePath), bytes => JSZip.loadAsync(bytes));
  const indexed = await readArtifacts(archive, catalog);
  const main = mainPath && { ...readMainFile(await readFile(mainPath)), filename: mainPath.split(/[\\/]/).at(-1) };
  const imported = check(indexed.artifacts, { archiveName: archivePath.split(/[\\/]/).at(-1), externalMain: main });
  console.log(`Validated ${imported.archive.fileCount} files, ${imported.edges.length} edges, root ${imported.root.status}.`);
}
console.log("Connected game schema, references, evidence paths and root selection passed.");
