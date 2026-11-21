import assert from "node:assert/strict";
import { buildBoardEntryGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { enterTk3Board } from "../tk3-board-entry.mjs";
import { initialTk3ScriptState, startTk3Script, advanceTk3Script } from "../tk3-script-slice.mjs";
import { resolveTk3BoardTransfer } from "../tk3-board-transfer.mjs";
for(const id of ['harbor','grove']) {
  const {artifacts}=await readArtifacts(await buildBoardEntryGame(id),{}), graph=buildReferences(artifacts);
  const scene=buildPlayableScene(artifacts,graph);
  assert.equal(scene.boardEntry.owner,scene.boardPath);
  assert.equal(scene.boardEntry.status,'resolved');
  let entry=enterTk3Board(initialTk3ScriptState(),scene,artifacts);
  assert.equal(entry.status,'waiting'); assert.equal(entry.state.variables.entry_visits,1);
  entry=advanceTk3Script(entry.state); assert.equal(entry.status,'completed');
  const destination=id==='harbor'?'channel.brd':'ridge.brd';
  let sent=startTk3Script(entry.state,'local(value)=19; Send("'+destination+'",19,27); result=value+destination_visits;','caller.prg');
  const transfer=resolveTk3BoardTransfer(sent,scene,artifacts,graph,{deferResume:true});
  assert.ok(transfer.transferred);
  entry=enterTk3Board(transfer.state,transfer.scene,artifacts);
  assert.equal(entry.status,'waiting'); assert.equal(entry.state.variables.result,undefined);
  entry=advanceTk3Script(entry.state);assert.equal(entry.state.variables.result,20);
  const missing={...scene,boardEntry:{...scene.boardEntry,path:null,status:'missing'}};
  assert.match(enterTk3Board(entry.state,missing,artifacts).state.diagnostic.text,/entry.*missing/i);
  sent=startTk3Script(initialTk3ScriptState(),'Send("'+destination+'",19,27);','loop.prg');
  assert.match(resolveTk3BoardTransfer({...sent,state:{...sent.state,transferCount:32}},scene,artifacts,graph).state.diagnostic.text,/Transfer budget/);
}
console.log('Board entry passed: shared binding, nested call/wait/caller locals, rooted failure and transfer bounds.');
