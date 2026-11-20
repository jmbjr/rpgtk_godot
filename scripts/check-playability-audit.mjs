import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { mainFileBindings } from "../model.mjs";
import { connectedGameRecord } from "../game-graph.mjs";
import { indexRpgcodeCommands } from "../rpgcode-references.mjs";
import { buildNeutralInspectionGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { assessPlayability } from "../playability-audit.mjs";
import { openGameArchive } from "../archive.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { character28, nativeAnims, testTileset }
  from "../docs/specs/fixtures/native-character-28-fixtures.mjs";
import { nativeItem27 } from "../docs/specs/fixtures/native-item-27-fixtures.mjs";

const zip = new JSZip();
zip.file("BSTW.gam", nativeMainFixture);
zip.file("BSTW/Boards/start.brd", board24Fixtures.standard);
zip.file("BSTW/Chrs/bruce.tem", character28);
zip.file("BSTW/Tiles/test-characters.tst", testTileset);
zip.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
for (const [name, bytes] of nativeAnims) zip.file("BSTW/Misc/" + name, bytes);
for (const name of ["jim", "door"]) zip.file("BSTW/Item/" + name + ".itm",
  nativeItem27({ emptyGraphics: true }));
zip.file("BSTW/Prg/menuTitle.prg", [
  '#Include("CArray.prg")', 'InitVar()', 'switch (index) {',
  'case 0:', 'setPlayer(0, "Synthetic Hero")',
  'initCmaps()', 'end()', '}', 
].join("\n"));
zip.file("BSTW/Prg/CArray.prg", "// synthetic source\n");
zip.file("BSTW/Prg/openDoor.prg", [
  '#Include("CArray.prg")', 'doorDelta = getTickCount()',
  'if(checked[door] == 0) {', 'theMwin->SetTxt(0, "Synthetic locked door")',
  'clues++', 'updateClues("Synthetic clue")', '}',
].join("\n"));
const { artifacts } = await readArtifacts(zip, {});
const main = artifacts.get("BSTW.gam");
const graph = buildReferences(artifacts, [
  { name: main.path, bindings: mainFileBindings(main, [...artifacts.keys()]), external: false },
]);
const audit = assessPlayability(artifacts, graph);
assert.equal(audit.mainFile, "BSTW.gam");
assert.equal(audit.interactionProgram, null);
assert.deepEqual(audit.stages.map(s => [s.id, s.status]), [
  ["title", "source-linked"], ["board", "source-linked"],
  ["character", "source-linked"], ["interaction", "source-linked"],
]);
assert.deepEqual(audit.summary,
  { sourceLinked: 4, partial: 0, missing: 0, runtimeVerified: false });
assert.equal(audit.stages[0].source, "BSTW/Prg/menuTitle.prg");
assert.deepEqual(audit.stages[0].sourceLines.map(x => x.line), [1, 2, 5, 6, 7]);
assert.equal(audit.stages[1].source, "BSTW/Boards/start.brd");
assert.ok(audit.stages[1].facts.some(f => f.includes("3 × 2 × 2")));
assert.ok(audit.stages[1].facts.some(f => f.includes("19, 27, layer 1")));
assert.deepEqual(audit.movement.map(m => [m.direction, m.frameCount]),
  [["South", 2], ["North", 2], ["East", 2], ["West", 2]]);
assert.deepEqual(audit.movement[0].frames.map(f => [f.path, f.tile, f.status]), [
  ["BSTW/Tiles/test-characters.tst", 14, "Resolved"],
  ["BSTW/Tiles/test-characters.tst", 15, "Resolved"],
]);
assert.deepEqual(audit.selectedInteraction, {
  slot: 1, filename: "door.itm", itemPath: "BSTW/Item/door.itm",
  activationProgram: "openDoor.prg",
  programPath: "BSTW/Prg/openDoor.prg",
  position: { x: 68, y: 90, layer: 2 }, status: "Resolved",
});
assert.deepEqual(audit.stages[3].sourceLines.map(x => x.line), [1, 2, 4, 6]);
assert.equal(audit.gaps.length, 6);
assert.ok(audit.gaps.every(g => g.acceptance.length && g.need.length));
assert.ok(audit.stages.every(s => s.runtimeStatus === "not-tested"));
assert.ok(audit.limitations.every(s => /not|never|unknown|unverified/i.test(s)));

const excluded = assessPlayability(artifacts, graph, main,
  { interactionProgram: "does-not-exist.prg" });
assert.equal(excluded.stages[3].status, "missing");
assert.equal(excluded.selectedInteraction, null);
assert.equal(excluded.summary.sourceLinked, 3);
const selected = assessPlayability(artifacts, graph, main,
  { interactionProgram: "OPENDOOR.PRG" });
assert.equal(selected.selectedInteraction.programPath, "BSTW/Prg/openDoor.prg");

const noMain = new Map(artifacts);
noMain.delete("BSTW.gam");
const missingRoot = assessPlayability(noMain, graph);
assert.equal(missingRoot.mainFile, null);
assert.equal(missingRoot.summary.missing, 4);
const noWalk = new Map(artifacts);
noWalk.delete("BSTW/Misc/test_north.anm");
const partialWalk = assessPlayability(noWalk, graph);
assert.equal(partialWalk.stages[2].status, "partial",
  "A stale graph edge does not make missing animation bytes source-linked");
const missingProgram = new Map(artifacts);
missingProgram.delete("BSTW/Prg/openDoor.prg");
const missingInteraction = assessPlayability(missingProgram, graph);
assert.equal(missingInteraction.stages[3].status, "partial");

const ajv = new Ajv2020({ strictTypes: false });
const schemaRoot = new URL("../docs/specs/", import.meta.url);
for (const name of ["tile-record", "artifact-record"]) {
  ajv.addSchema(JSON.parse(await readFile(new URL(name + ".schema.json", schemaRoot), "utf8")),
    name + ".schema.json");
}
const validate = ajv.compile(JSON.parse(await readFile(
  new URL("connected-game.schema.json", schemaRoot), "utf8")));
for (const options of [
  { archiveName: "Synthetic four-stage scenario" },
  { archiveName: "External GAM", externalMain: { ...main, filename: "uploaded-main.gam" } },
]) {
  const record = connectedGameRecord(artifacts, {}, options);
  assert.ok(validate(record), JSON.stringify(validate.errors));
  assert.deepEqual(record.playabilityAssessment.stages.map(s => s.id),
    ["title", "board", "character", "interaction"]);
  assert.equal(record.playabilityAssessment.summary.runtimeVerified, false);
}
const emptyRecord = connectedGameRecord(noMain, {}, { archiveName: "Without GAM" });
assert.ok(validate(emptyRecord), JSON.stringify(validate.errors));
assert.equal(emptyRecord.playabilityAssessment.summary.missing, 4);

// Metamorphic source evidence uses the same readers/graph/export as the browser.
for (const id of ["harbor", "grove"]) {
  const zip = await buildNeutralInspectionGame(id);
  const { artifacts } = await readArtifacts(zip, {});
  const root = id === "harbor" ? "HarborLab/" : "";
  const graph = buildReferences(artifacts);
  const audit = assessPlayability(artifacts, graph);
  assert.match(audit.stages[0].source, id === "harbor" ? /menuTitle.prg$/ : /start.prg$/);
  assert.equal(audit.selectedInteraction.programPath, root + "Prg/" + (id === "harbor" ? "mwininn.prg" : "menuMain.prg"));
  assert.deepEqual(audit.stages[3].sourceLines.map(r => r.line), [2,5,6,7]);
  const selected = artifacts.get(audit.stages[3].source);
  const original = assessPlayability(artifacts, graph).stages[3].sourceLines.map(r => r.line);
  const neutral = structuredClone(selected);
  neutral.program.rows = selected.program.rows.map(r => ({ ...r,
    line: r.line.replaceAll("checked", "sampled").replaceAll("clues", "total").replaceAll("updateClues", "AddTotal") }));
  const renamed = new Map(artifacts); renamed.set(selected.path, neutral);
  assert.deepEqual(assessPlayability(renamed, buildReferences(renamed)).stages[3].sourceLines.map(r => r.line), original);
  for (const [filename, expected] of [["quest_only.prg", []], ["static_probe.prg", Array.from({length:12},(_,i)=>i+3)]]) {
    const probe = new Map(artifacts);
    probe.set(selected.path, { ...artifacts.get(root + "Prg/" + filename), path:selected.path });
    const review = assessPlayability(probe, buildReferences(probe));
    assert.deepEqual(review.stages[3].sourceLines.map(r => r.line), expected);
  }
  // Placement identity and geometry remain archive data, not a preferred slot.
  const shifted = new Map(artifacts);
  const board = artifacts.get(audit.stages[1].source);
  shifted.set(board.path, { ...board,
    sprites: board.sprites.map(sprite => ({...sprite, slot:sprite.slot+9,
      position:{...sprite.position,x:sprite.position.x+5,y:sprite.position.y+7}})),
    refs: board.refs.map(ref => ({...ref, evidence:ref.evidence.replace(/slot (\d+)/g, (_,slot)=>"slot "+(Number(slot)+9))})),
  });
  const moved = assessPlayability(shifted, buildReferences(shifted));
  assert.equal(moved.selectedInteraction.slot, audit.selectedInteraction.slot+9);
  assert.deepEqual(moved.selectedInteraction.position, {...audit.selectedInteraction.position,
    x:audit.selectedInteraction.position.x+5,y:audit.selectedInteraction.position.y+7});
  assert.deepEqual(moved.stages[3].sourceLines, audit.stages[3].sourceLines);
  const connected = connectedGameRecord(artifacts, {}, {archiveName:id});
  assert.ok(validate(connected), JSON.stringify(validate.errors));
  assert.deepEqual(connected.playabilityAssessment, audit);
}

// Read-only owner ZIP acceptance. NEVER copy the private ZIP or media into CI.
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const source = await openGameArchive(bytes, file => JSZip.loadAsync(file));
  const real = (await readArtifacts(source, {})).artifacts;
  assert.equal(real.size, 285);
  const graph = buildReferences(real);
  const review = assessPlayability(real, graph, real.get("BSTW.gam"),
    { interactionProgram: "mwininn.prg" });
  assert.deepEqual(review.summary,
    { sourceLinked: 4, partial: 0, missing: 0, runtimeVerified: false });
  assert.equal(review.stages[0].source, "BSTW/Prg/menuTitle.prg");
  assert.ok(review.stages[0].sourceLines.length > 0 && review.stages[0].sourceLines.length <= 12);
  assert.equal(review.stages[1].source, "BSTW/Boards/start.brd");
  assert.ok(review.stages[1].facts.some(x => x.includes("20 × 15 × 2")));
  assert.ok(review.stages[1].facts.some(x => x.includes("107, 78, layer 1")));
  assert.deepEqual(review.movement.map(x => x.frameCount), [2, 2, 2, 2]);
  assert.deepEqual(review.movement[0].frames.map(x => x.tile), [14, 15]);
  assert.deepEqual([review.selectedInteraction.slot,
    review.selectedInteraction.filename, review.selectedInteraction.programPath,
    review.selectedInteraction.position],
  [3, "door.itm", "BSTW/Prg/mwininn.prg", { x: 207, y: 349, layer: 1 }]);
  for (const stage of [review.stages[0], review.stages[3]]) {
    const source = real.get(stage.source);
    const lines = new Set(indexRpgcodeCommands(source.program.rows.map(r => r.line).join("\n")).map(c => c.line));
    for (const ref of source.refs) lines.add(ref.line);
    assert.deepEqual(stage.sourceLines.map(row => row.line), [...lines].filter(Number.isInteger).sort((a,b) => a-b).slice(0,12));
  }
  const connected = connectedGameRecord(real, {}, { archiveName: "BSTW" });
  assert.ok(validate(connected), JSON.stringify(validate.errors));
  assert.equal(connected.playabilityAssessment.selectedInteraction.activationProgram, "mwininn.prg");
  console.log("Real BSTW source evidence confirmed: configured startup, board, walking ANMs, selected placement and generic call/reference excerpts. Runtime never executed.");
}
console.log("Playability gap assessment passed: four source stages, missing/partial inputs, explicit runtime gates, mobile/JSON evidence and source lines.");
