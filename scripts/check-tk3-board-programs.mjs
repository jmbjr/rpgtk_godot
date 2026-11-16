import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { initialTk3ScriptState, startTk3Script, advanceTk3Script }
  from "../tk3-script-slice.mjs";
import { resolveTk3BoardTransfer } from "../tk3-board-transfer.mjs";
import { mapTk3BoardPrograms, insideTk3BoardProgram, selectTk3BoardStep,
  selectTk3BoardKey, startTk3BoardProgram } from "../tk3-board-programs.mjs";
import { scriptFixtureSpecs, buildScriptFixtureZip }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

const z = text => Buffer.from(text + "\0", "ascii");
const i16 = (...values) => {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((x,i) => b.writeInt16LE(x, 2*i));
  return b;
};
const i32 = (...values) => {
  const b = Buffer.alloc(values.length * 4);
  values.forEach((x,i) => b.writeInt32LE(x, 4*i));
  return b;
};
const pack = (...parts) => Buffer.concat(parts);
const point = (x,y) => i32(x,y);
const originalProgram = pack(
  z("doorTrigger.prg"), z("trigger.png"), z("doorClosed"), z("1"),
  z("doorOpen"), z("yes"), i16(1,1,4,1,1),
  point(48,72), point(80,72), i16(-1), z("door-trigger"),
);
function nativeProgram(source, { flags=0, activate=0, closed=-1 } = {}) {
  return pack(
    z(source), z(""), z(""), z(""), z(""), z(""),
    i16(activate,flags,0,1,3),
    point(28,16), point(44,16), point(44,37), point(28,37),
    i16(closed), z("test-activation"),
  );
}
function patchOne(bytes, source, flags={}) {
  const b=Buffer.from(bytes), i=b.indexOf(originalProgram);
  assert.ok(i>=0 && b.indexOf(originalProgram,i+1)<0,
    "The source synthetic BRD native program record must be unique.");
  return pack(b.subarray(0,i),nativeProgram(source,flags),
    b.subarray(i+originalProgram.length));
}
async function parsed(zip) {
  const bytes=await zip.generateAsync({type:"uint8array",compression:"DEFLATE"});
  const opened=await openGameArchive(bytes, raw=>JSZip.loadAsync(raw));
  const artifacts=(await readArtifacts(opened,{})).artifacts;
  const graph=buildReferences(artifacts);
  const scene=buildPlayableScene(artifacts,graph);
  assert.equal(scene.ok,true,JSON.stringify(scene.issues));
  return {artifacts,graph,scene};
}

// Original TK3 syntax permits trailing semicolons on source statements.
// Preserve physical source line numbers and strict one-statement-per-line
// grammar; do not permit arbitrary compound statements.
let dialogue=startTk3Script(initialTk3ScriptState(),
  ['// Native semicolon source', 'mwin("Old guide; welcome!");',
    'mwin("A second message");', 'wait();',
    'mwinCls();', 'visited = 1;'].join("\n"),
  "Independent/Prg/guide.prg");
assert.equal(dialogue.status,"waiting",dialogue.state.diagnostic?.text);
assert.equal(dialogue.state.message,"Old guide; welcome!\nA second message");
assert.equal(dialogue.line,4);
dialogue=advanceTk3Script(dialogue.state);
assert.equal(dialogue.status,"completed");
assert.equal(dialogue.state.message,"");
assert.equal(dialogue.state.variables.visited,1);
const compound=startTk3Script(initialTk3ScriptState(),
  'mwin("A"); wait();', "Independent/Prg/compound.prg");
assert.equal(compound.status,"error");
assert.equal(compound.state.diagnostic.line,1);

// Two *different* native synthetic games exercise the same archive to board
// program to scene transfer path, without game-specific runtime checks.
for(const spec of scriptFixtureSpecs) {
  const target="passage_"+spec.id+".brd";
  const script='Send("'+target+'", 55, 45, 1);';
  const zip=await buildScriptFixtureZip(spec);
  const boardPath=spec.root+"/Boards/"+spec.board;
  const source=await zip.file(boardPath).async("uint8array");
  const updated=patchOne(source,script);
  zip.file(boardPath,updated);
  zip.file(spec.root+"/Boards/"+target,updated);
  const {artifacts,graph,scene}=await parsed(zip);
  assert.equal(scene.boardPrograms.length,1);
  const zone=scene.boardPrograms[0];
  assert.deepEqual([zone.slot,zone.kind,zone.layer,zone.status],
    [0,"step",1,"resolved"]);
  assert.equal(zone.programPath,boardPath+"#board-program-0");
  assert.equal(zone.source,script);
  assert.deepEqual(zone.bounds,{minX:28,maxX:44,minY:16,maxY:37});
  const before={x:19,y:27,layer:1}, entered={x:30,y:27,layer:1};
  assert.equal(insideTk3BoardProgram(zone,before),false);
  assert.equal(insideTk3BoardProgram(zone,entered),true);
  assert.equal(insideTk3BoardProgram(zone,{...entered,layer:2}),false);
  assert.equal(insideTk3BoardProgram(zone,{x:28,y:30,layer:1}),true);
  assert.equal(selectTk3BoardStep(scene,before,entered)?.slot,0);
  assert.equal(selectTk3BoardStep(scene,entered,entered),null,
    "Stepping while still inside must not repeatedly activate.");
  assert.equal(selectTk3BoardStep(scene,before,{...entered,layer:2}),null);
  assert.equal(selectTk3BoardKey(scene,entered),null,
    "Step triggers are not mapped as Talk programs.");
  let state=initialTk3ScriptState();
  state={...state,variables:{seed_grown:1}};
  const response=startTk3BoardProgram(state,zone);
  assert.equal(response.status,"transfer",response.state.diagnostic?.text);
  assert.equal(response.transfer.file,target);
  const arrived=resolveTk3BoardTransfer(response,scene,artifacts,graph);
  assert.equal(arrived.transferred,true,
    arrived.state.diagnostic?.text);
  assert.equal(arrived.scene.boardPath,spec.root+"/Boards/"+target);
  assert.deepEqual(arrived.scene.start,{x:55,y:45,layer:1});
  assert.equal(arrived.state.variables.seed_grown,1);
  assert.equal(selectTk3BoardStep(arrived.scene,
    {...arrived.scene.start},{...arrived.scene.start}),null,
    "A new board must not immediately retrigger its entry program.");

  const keyZip=await buildScriptFixtureZip(spec);
  keyZip.file(boardPath,patchOne(source,script,{flags:1}));
  keyZip.file(spec.root+"/Boards/"+target,updated);
  const keyed=await parsed(keyZip);
  assert.equal(keyed.scene.boardPrograms[0].kind,"keypress");
  assert.equal(selectTk3BoardStep(keyed.scene,before,entered),null);
  assert.equal(selectTk3BoardKey(keyed.scene,entered)?.slot,0);
  assert.equal(startTk3BoardProgram(initialTk3ScriptState(),
    selectTk3BoardKey(keyed.scene,entered)).status,"transfer");

  for(const flags of [4,5]) {
    const stoppingZip=await buildScriptFixtureZip(spec);
    stoppingZip.file(boardPath,patchOne(source,script,{flags}));
    const stopping=await parsed(stoppingZip);
    const trigger=stopping.scene.boardPrograms[0];
    assert.equal(trigger.status,"resolved");
    assert.equal(trigger.kind,flags===4?"step":"keypress");
    assert.equal(trigger.flags & 4,4,
      "Native PRG_STOPS_MOVEMENT is not an unsupported activation flag.");
  }
  for(const [sourceText,options,expectedStatus] of [
    [script,{flags:2},"unsupported"],
    [script,{activate:1},"unsupported"],
    [script,{closed:0},"unsupported"],
    ["missing.prg",{},"missing"],
  ]) {
    const caseZip=await buildScriptFixtureZip(spec);
    caseZip.file(boardPath,patchOne(source,sourceText,options));
    const result=await parsed(caseZip);
    const candidate=result.scene.boardPrograms[0];
    assert.equal(candidate.status,expectedStatus);
    assert.equal(selectTk3BoardStep(result.scene,before,entered),null);
    const blocked=startTk3BoardProgram(initialTk3ScriptState(),candidate);
    assert.equal(blocked.status,"error");
    assert.ok(blocked.state.diagnostic.text);
  }
  const badScriptZip=await buildScriptFixtureZip(spec);
  badScriptZip.file(boardPath,patchOne(source,'Teleport("unknown.brd", 5, 5);'));
  const badScript=await parsed(badScriptZip);
  const failure=startTk3BoardProgram(initialTk3ScriptState(),
    badScript.scene.boardPrograms[0]);
  assert.equal(failure.status,"error");
  assert.equal(failure.state.diagnostic.path,
    boardPath+"#board-program-0");
  assert.equal(failure.state.diagnostic.line,1);
  console.log(spec.id+": source BRD vector, auto step Send, keyed Talk, missing/unsupported diagnostics and session transfer passed.");
}

const client=await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs",import.meta.url),"utf8");
const flow=await readFile(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");
for(const symbol of ["selectTk3BoardStep","selectTk3BoardKey",
  "startTk3BoardProgram","runEnteredBoardProgram"])
  assert.ok(client.includes(symbol));
assert.match(client,/hud\.hidden = !showClues/);
assert.match(client,/innLabel\.hidden = !scene\.innDoor/);
assert.match(flow,/node scripts\/check-tk3-board-programs\.mjs/);
assert.match(flow,/tk3-board-programs\.mjs tk3-gam-startup\.mjs/);
console.log("Non-BSTW HUD condition and source board-trigger presentation are wired.");

// Optional source inspection of the owner's unmodified *test-only* demo ZIP.
// It is read-only, must never be checked into Git or run in CI.
if(process.argv[2]) {
  const bytes=await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f");
  const input=await openGameArchive(bytes,b=>JSZip.loadAsync(b));
  const artifacts=(await readArtifacts(input,{})).artifacts;
  const graph=buildReferences(artifacts);
  const scene=buildPlayableScene(artifacts,graph);
  assert.equal(scene.ok,true,JSON.stringify(scene.issues));
  assert.equal(scene.boardPath,"demo/Boards/start.brd");
  assert.equal(scene.characterName,"Bob");
  const gate=scene.boardPrograms.find(p=>p.kind==="step");
  assert.ok(gate);
  assert.equal(gate.source,'send("out.brd", 112, 192, 1);');
  assert.deepEqual(gate.bounds,
    {minX:283,maxX:327,minY:305,maxY:322});
  assert.equal(gate.layer,1);
  const before={x:270,y:312,layer:1},
    after={x:300,y:312,layer:1};
  assert.equal(selectTk3BoardStep(scene,before,after)?.slot,gate.slot);
  const result=resolveTk3BoardTransfer(startTk3BoardProgram(
    initialTk3ScriptState(),gate),scene,artifacts,graph);
  assert.equal(result.transferred,true,result.state.diagnostic?.text);
  assert.equal(result.scene.boardPath,"demo/Boards/out.brd");
  assert.deepEqual(result.scene.start,{x:112,y:192,layer:1});
  const oldman=artifacts.get("demo/Prg/oldman.prg");
  const talked=startTk3Script(initialTk3ScriptState(),
    oldman.program.rows.map(row=>row.line).join("\n"),oldman.path);
  assert.equal(talked.status,"waiting",talked.state.diagnostic?.text);
  assert.match(talked.state.message,/Welcome to the demo!/);
  console.log("Owner's original demo test ZIP: production scene detects native step-on outbound door, Send lands on out.brd, oldman semicolon dialogue waits.");
}
