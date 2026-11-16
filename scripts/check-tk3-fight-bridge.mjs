import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { compileTk3Interaction, initialTk3ScriptState,
  startPlacedTk3Script, advanceTk3Script, resumeTk3Effect,
  startTk3Script } from "../tk3-script-slice.mjs";
import { resolveTk3FightRequest, simulateTk3FightVictory,
  cancelTk3FightTest } from "../tk3-fight-bridge.mjs";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

const enemyBase = fixtures.find(f => f.path === "Enemy/foe.ene")?.bytes;
const backgroundBase = fixtures.find(f => f.path === "Bkrounds/room.bkg")?.bytes;
assert.ok(enemyBase && backgroundBase);
const packed = (...parts) => Buffer.concat(parts);
const zstr = value => Buffer.from(value + "\0","ascii");
const word = (...numbers) => {
  const data=Buffer.alloc(numbers.length*2);
  numbers.forEach((n,i)=>data.writeInt16LE(n,i*2));
  return data;
};
const long = (...numbers) => {
  const data=Buffer.alloc(numbers.length*4);
  numbers.forEach((n,i)=>data.writeInt32LE(n,i*4));
  return data;
};
function binaryEnemyBytes(name, win) {
  return packed(zstr("RPGTLKIT ENEMY"),word(2,1),zstr(name),
    long(12,3,2,1),Buffer.from([1]),word(0,0),
    // Inclusive special count 0 (one empty entry); no weaknesses,
    // strengths, graphics or custom animations.
    word(0),zstr(""),word(-1),word(-1),
    Buffer.from([0,0]),zstr(""),long(4,2),
    zstr(win),zstr(""),word(-1),word(-1),word(0));
}
function binaryBackgroundBytes(name) {
  return packed(zstr("RPGTLKIT BKG"),word(2,3),
    zstr(name),...Array.from({length:5},()=>zstr("")));
}

function enemyBytes(name, win) {
  // Exact native ENE 2.0 layout from the independent format fixture.
  const tiles = Array(133).fill("");
  const movesAndWeaknesses = Array(202).fill("");
  return Buffer.from([
    "RPGTLKIT ENEMY", 2, 0, name, 12, 3, 2, 1, 1, 0, 0,
    1, 1, ...tiles, ...movesAndWeaknesses,
    // Extra empty line terminates the 2.0 text file; the decoder discards
    // it before reading the Escape PRG and four sound fields.
    0, 0, "", 4, 2, win, "", "", "", "", "", "",
  ].join("\r\n"), "ascii");
}
function encounterScript(spec) {
  return [
    'mwin("'+spec.characterName+': A stranger blocks the way.");',
    "wait();", "mwincls();",
    'fightEnemy("opponent_'+spec.id+'.ene", "field_'+spec.id+'.bkg");',
  ].join("\n");
}
function victoryScript(spec) {
  return [
    'mwin("'+spec.characterName+': Victory recorded for this game.");',
    "wait();", "mwincls();", 'eraseItem("source");',
    "defeated_"+spec.id+" = 1;",
  ].join("\n");
}
async function sample(spec, change = {}) {
  const zip = await buildScriptFixtureZip(spec);
  const root = spec.root, enemy = "opponent_"+spec.id+".ene",
    bkg = "field_"+spec.id+".bkg", win = "reward_"+spec.id+".prg";
  zip.file(root+"/Prg/"+spec.script,change.start ??
    encounterScript(spec));
  if (!change.noEnemy) zip.file(root+"/Enemy/"+enemy,
    spec.id==="grove" ?
      binaryEnemyBytes("Guardian of "+spec.id,change.noWin?"":win) :
      enemyBytes("Guardian of "+spec.id, change.noWin ? "" : win));
  if (!change.noBkg) zip.file(root+"/Bkrounds/"+bkg,
    spec.id==="grove" ?
      binaryBackgroundBytes("arena_"+spec.id+".png") : backgroundBase);
  if (!change.noWin) zip.file(root+"/Prg/"+win,change.win ?? victoryScript(spec));
  if (change.duplicateEnemy) zip.file(root+"/Enemy/"+enemy.toUpperCase(),
    enemyBytes("Duplicate guardian",win));
  const bytes = await zip.generateAsync({type:"uint8array",
    compression:"DEFLATE"});
  const archive = await openGameArchive(bytes, b=>JSZip.loadAsync(b));
  const artifacts=(await readArtifacts(archive,{})).artifacts;
  const graph=buildReferences(artifacts);
  const scene=buildPlayableScene(artifacts,graph);
  assert.equal(scene.ok,true,JSON.stringify(scene.issues));
  const player={...spec.position};
  const script=startPlacedTk3Script(initialTk3ScriptState(),
    scene,player,artifacts);
  return {script,artifacts,scene,graph,enemy,bkg,win,zip};
}

for (const spec of scriptFixtureSpecs) {
  const game=await sample(spec);
  const {script,artifacts,win,scene}=game;
  assert.equal(script.status,"waiting",script.state.diagnostic?.text);
  assert.match(script.state.message,new RegExp(spec.characterName));
  const waiting=advanceTk3Script(script.state);
  assert.equal(waiting.status,"fight",waiting.state.diagnostic?.text);
  assert.equal(waiting.encounter.path,spec.root+"/Prg/"+spec.script);
  assert.equal(waiting.encounter.line,4);
  assert.equal(waiting.encounter.enemy,game.enemy);
  assert.equal(waiting.encounter.background,game.bkg);
  assert.equal(waiting.state.pendingFight.enemy,game.enemy);
  const ready=resolveTk3FightRequest(waiting,artifacts);
  assert.equal(ready.status,"ready",JSON.stringify({
    diagnostic:ready.state?.diagnostic?.text,
    enemy: (({type,decodeStatus,error}) => ({type,decodeStatus,error}))(
      artifacts.get(spec.root+"/Enemy/"+game.enemy) ?? {}),
    background: (({type,decodeStatus,error}) => ({type,decodeStatus,error}))(
      artifacts.get(spec.root+"/Bkrounds/"+game.bkg) ?? {}),
  }));
  assert.equal(ready.encounter.name,"Guardian of "+spec.id);
  assert.equal(artifacts.get(spec.root+"/Enemy/"+game.enemy).version,
    spec.id==="grove"?"2.1":undefined);
  assert.equal(artifacts.get(spec.root+"/Bkrounds/"+game.bkg).order,
    spec.id==="grove"?"native-image":"column-major");
  assert.equal(ready.encounter.hp,12);
  assert.equal(ready.encounter.victoryProgram?.path,
    spec.root+"/Prg/"+win);
  // No source effects occur before the user's explicit simulated victory.
  assert.equal(ready.state.variables["defeated_"+spec.id],undefined);
  const won=simulateTk3FightVictory(ready.state,ready.encounter);
  assert.equal(won.status,"waiting",won.state.diagnostic?.text);
  assert.equal(won.state.message,
    spec.characterName+": Victory recorded for this game.");
  assert.equal(won.state.execution.path,spec.root+"/Prg/"+win);
  assert.equal(won.state.scriptStack.length,1,
    "Victory PRG executes before the original fightEnemy continuation.");
  const remove=advanceTk3Script(won.state);
  assert.equal(remove.status,"effect",remove.state.diagnostic?.text);
  assert.equal(remove.effect.kind,"erase-item");
  assert.equal(remove.effect.alias,"source");
  assert.equal(remove.effect.sourceBoardPath,scene.boardPath);
  assert.equal(remove.effect.sourceItemSlot,script.target.slot);
  const done=resumeTk3Effect(remove.state);
  assert.equal(done.status,"completed",done.state?.diagnostic?.text);
  assert.equal(done.state.variables["defeated_"+spec.id],1);
  assert.equal(done.state.execution,null);
  assert.equal(done.state.pendingFight,null);
  assert.deepEqual(done.state.scriptStack,[]);
  assert.equal(startPlacedTk3Script(initialTk3ScriptState(),
    scene,spec.position,artifacts).status,"waiting",
    "Fresh game launch restores original source object and state.");

  const rejected=cancelTk3FightTest(ready.state);
  assert.equal(rejected.status,"aborted");
  assert.equal(rejected.state.variables["defeated_"+spec.id],undefined);
  assert.equal(rejected.state.execution,null);
  assert.equal(rejected.state.pendingFight,null);

  for(const [opts,message] of [
    [{noEnemy:true},/Enemy.*missing/],
    [{duplicateEnemy:true},/Enemy.*ambiguous/],
    [{noBkg:true},/background.*missing/],
    [{noWin:true,start:encounterScript(spec)},/NO_ERROR_EXPECTED/],
    [{win:'UnknownCommand("bad");'},/unsupported syntax/i],
  ]) {
    const bad=await sample(spec,opts);
    const interrupted=advanceTk3Script(bad.script.state);
    const result=resolveTk3FightRequest(interrupted,bad.artifacts);
    if(opts.noWin) {
      assert.equal(result.status,"ready");
      assert.equal(result.encounter.victoryProgram,null);
      assert.equal(simulateTk3FightVictory(result.state,result.encounter).status,
        "completed");
      continue;
    }
    assert.equal(result.status,"error",JSON.stringify(opts));
    assert.equal(result.state.execution,null);
    assert.equal(result.state.diagnostic.path,
      spec.root+"/Prg/"+spec.script);
    assert.equal(result.state.diagnostic.line,4);
    assert.match(result.state.diagnostic.text,message);
  }
  assert.equal(compileTk3Interaction('fightEnemy("e.ene", "b.bkg");',
    spec.root+"/Prg/standalone.prg").ok,true);
  assert.equal(compileTk3Interaction('eraseItem("source");',
    spec.root+"/Prg/reward.prg").ok,true);
  console.log(spec.id+": player Talk -> authored encounter dialogue -> ENE/BKG -> explicit test victory -> authored win PRG/eraseItem, reset and errors passed.");
}
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const app=await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs",import.meta.url),"utf8");
const workflow=await readFile(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");
for(const id of ["play-fight-test","play-fight-details","play-fight-simulate",
  "play-fight-abort"])assert.ok(html.includes('id="'+id+'"'));
for(const symbol of ["resolveTk3FightRequest","simulateTk3FightVictory",
  "cancelTk3FightTest","resumeTk3Effect","removedItemSlots"])
  assert.ok(app.includes(symbol));
assert.match(workflow,/node scripts\/check-tk3-fight-bridge\.mjs/);
assert.match(workflow,/tk3-fight-bridge\.mjs site\//);
console.log("Browser fight bridge and source reward UI wiring present.");

// Original demo ZIP is optional read-only local evidence. Never in CI.
if(process.argv[2]) {
  const bytes=await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f");
  const input=await openGameArchive(bytes,b=>JSZip.loadAsync(b));
  const artifacts=(await readArtifacts(input,{})).artifacts;
  const graph=buildReferences(artifacts);
  const scene=buildPlayableScene(artifacts,graph,null,
    {boardPath:"demo/Boards/out.brd",spawn:{x:336,y:128,layer:1}});
  assert.equal(scene.ok,true,JSON.stringify(scene.issues));
  const pirate=scene.placements.find(p=>p.filename==="man.itm");
  assert.ok(pirate,"Original pirate item is present on second board.");
  const before=startPlacedTk3Script(initialTk3ScriptState(),scene,
    pirate.position,artifacts);
  assert.equal(before.status,"waiting",before.state.diagnostic?.text);
  assert.match(before.state.message,/Arr, prepare to fight!/);
  const fight=advanceTk3Script(before.state);
  assert.equal(fight.status,"fight",fight.state.diagnostic?.text);
  const plan=resolveTk3FightRequest(fight,artifacts);
  assert.equal(plan.status,"ready",plan.state?.diagnostic?.text);
  assert.equal(plan.encounter.name,"Pirate Bob");
  assert.equal(plan.encounter.victoryProgram?.path,"demo/Prg/win.prg");
  const victory=simulateTk3FightVictory(plan.state,plan.encounter);
  assert.equal(victory.status,"waiting",victory.state.diagnostic?.text);
  assert.match(victory.state.message,/Arr, ye beat me!/);
  const erase=advanceTk3Script(victory.state);
  assert.equal(erase.status,"effect",erase.state.diagnostic?.text);
  assert.equal(erase.effect.sourceItemSlot,pirate.slot);
  assert.equal(resumeTk3Effect(erase.state).status,"completed");
  console.log("Owner ZIP read-only: original Pirate Bob ENE/BKG, win.prg, and source eraseItem all resolve via production archive.");
}
