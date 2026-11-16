import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { mainFileBindings } from "../model.mjs";
import { readLegacyDialogueDefinitions, initialLegacyDialogueState }
  from "../tk3-source-dialogue.mjs";
import { listTk3RuntimeKeys } from "../tk3-runtime-keys.mjs";
import { compileTk3SourceMenu, openTk3SourceMenu, selectTk3SourceMenu,
  confirmTk3MenuProfile, cancelTk3SourceMenu } from "../tk3-source-menu.mjs";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

function replaceNative(bytes, oldText, newText) {
  const buf=Buffer.from(bytes), old=Buffer.from(oldText,"latin1"),
    next=Buffer.from(newText,"latin1");
  const offset=buf.indexOf(old);
  assert.ok(offset>=0 && buf.indexOf(old,offset+1)<0,
    "Unique GAM native substring " + JSON.stringify(oldText));
  return Buffer.concat([buf.subarray(0,offset),next,buf.subarray(offset+old.length)]);
}
const settings=[
  {id:"harbor", names:["Supplies","Map","Crafting","Crew","Signals","Ship"],
    profiles:["Mira","Seth"], award:"harbor_complete"},
  {id:"grove", names:["Seeds","Trails","Tools","Wildlife","Weather","Shelter"],
    profiles:["Orio","Tala"], award:"forest_complete"},
];
async function synthetic(spec, opts={}) {
  const fixture=await buildScriptFixtureZip(spec);
  const game=settings.find(x=>x.id===spec.id);
  const main=spec.main;
  const prgName="choices_"+spec.id+".prg";
  let gam=await fixture.file(main).async("uint8array");
  gam=replaceNative(gam,"menuMain.prg\0",prgName+"\0");
  const asBuffer=Buffer.from(gam), marker=Buffer.concat([
    Buffer.from([29,0]), Buffer.from(prgName+"\0")]);
  const offset=asBuffer.indexOf(marker);
  assert.ok(offset>=0);
  asBuffer.writeInt16LE(13,offset);
  fixture.file(main,asBuffer);
  const root=spec.root+"/Prg/";
  const layout="Layout_"+spec.id+".prg", book="Choices_"+spec.id+".prg";
  const events=game.names.map((_,i)=>"event_"+spec.id+"_"+i);
  const init=[
    "maxclues = 6", "ItemTalkThreshold = 500",
    ...events.map((e,i)=>e+" = "+i),
    ...game.names.map((name,i)=>
      'CampCmap->setGraphic(SIDEMENU, '+i+',0,"mm'+name+'_inactive.png")'),
    'CampCmap->setGraphic(PROFMENU, 0,0, "prof" + _crew[0] + "_inactive.png")',
    'CampCmap->setGraphic(PROFMENU, 0,1, "prof" + _crew[1] + "_inactive.png")',
    "method updateClues(note)","{"," if(remainingclues == 0)","{",
    "  "+game.award+" = 1","}","}","",
  ].join("\n");
  fixture.file(root+spec.startup, [
    '#include("'+layout+'")',
    '_crew[0] = "'+game.profiles[0]+'"',
    '_crew[1] = "'+game.profiles[1]+'"',"",
  ].join("\n"));
  fixture.file(root+layout,opts.removeLabels?
    init.replace(/CampCmap->setGraphic\(SIDEMENU, 3,0,[^\n]+\n/,""):init);
  fixture.file(root+prgName,
    '#include("'+(opts.badInclude?"Missing.prg":book)+'")\nInspectChoices()\n');
  const bodies=game.names.map((name,i)=>{
    const gate=[1,2,3].includes(i);
    const first= [
      "   if(checked["+events[i]+"]==0)", "   {",
      "     clues++", '     updateClues("Learned '+name+
        ' in '+game.id+'")', "   }",
    ];
    const body=gate?[
      "  CampCmap->setActiveWinID(PROFMENU)",
      "  CampCmap->ShowIt(index)", "  if(index~=-1)", "  {",
      ...first.map(l=>"  "+l),
      "    CampScreen(index)", "  }",
    ]:[...first, "   CampScreen()"];
    return ["  case "+i+":","  {",...body,
      "   checked["+events[i]+"]++","  }"].join("\n");
  });
  let helper=["method InspectChoices()","{"," while(true)"," {",
    "  switch (index)","  {",...bodies,
    "  case -1:","  {","   returnmethod(index)","  }","  }",
    " }","}",""].join("\n");
  if(opts.unknownEvent) helper=helper.replace(events[0],"undefined_event");
  if(opts.badUpdate) helper=helper.replace('updateClues("Learned '+
    game.names[0]+' in '+game.id+'")','Send("outside.brd",1,1)');
  fixture.file(root+book,helper);
  return {fixture,game,prgName,events,book,helper};
}
async function load(fixture) {
  const binary=await fixture.generateAsync({type:"uint8array",compression:"DEFLATE"});
  const zip=await openGameArchive(binary,b=>JSZip.loadAsync(b));
  const artifacts=(await readArtifacts(zip,{})).artifacts;
  const scene=buildPlayableScene(artifacts,buildReferences(artifacts));
  assert.equal(scene.ok,true,JSON.stringify(scene.issues));
  const def=readLegacyDialogueDefinitions(artifacts,scene);
  const action=listTk3RuntimeKeys(scene,artifacts)
    .find(x=>x.label==="Enter"&&x.program?.startsWith("choices_"));
  assert.ok(action,"Source GAM must bind the test's menu PRG to Enter");
  return {artifacts,scene,def,action};
}
for(const spec of scriptFixtureSpecs) {
  const {fixture,game}=await synthetic(spec);
  const {artifacts,scene,def,action}=await load(fixture);
  assert.equal(action.path,spec.root+"/Prg/choices_"+spec.id+".prg",
    JSON.stringify({ action,
      sourcePaths:[...artifacts.keys()].filter(x=>x.includes("choices_")),
      binding:new Map(mainFileBindings(artifacts.get(scene.mainPath),
        [...artifacts.keys()])).get(action.evidence),
      startup:artifacts.get(scene.mainPath)?.startup }));
  assert.equal(def.supported,true);
  const plan=compileTk3SourceMenu(artifacts,scene,action,def);
  assert.equal(plan.ok,true,plan?.diagnostic?.text);
  assert.equal(plan.choices.length,6);
  assert.deepEqual(plan.choices.map(c=>c.label),game.names);
  assert.deepEqual(plan.choices.map(c=>c.eventIndex),[0,1,2,3,4,5]);
  assert.deepEqual(plan.choices.map(c=>c.needsProfile),
    [false,true,true,true,false,false]);
  assert.deepEqual(plan.profiles.map(p=>p.name),game.profiles);
  assert.equal(plan.awardFlag,game.award);
  let state=initialLegacyDialogueState(def);
  let opened=openTk3SourceMenu(state,plan);
  assert.equal(opened.status,"open");
  state=opened.state;
  let first=selectTk3SourceMenu(state,plan,0);
  assert.equal(first.status,"clue");
  assert.equal(first.state.variables.clues,1);
  assert.equal(first.state.menu.message,"Learned "+game.names[0]+" in "+game.id);
  state=first.state;
  const again=selectTk3SourceMenu(state,plan,0);
  assert.equal(again.status,"repeat");
  assert.equal(again.state.variables.clues,1);
  assert.equal(again.state.variables.checked[0],2);
  state=again.state;
  for(const id of [1,2,3]) {
    const pending=selectTk3SourceMenu(state,plan,id);
    assert.equal(pending.status,"choose-profile");
    assert.equal(pending.state.variables.clues,state.variables.clues,
      "Opening the source profile picker must not award a clue");
    const wrong=confirmTk3MenuProfile(pending.state,plan,89);
    assert.equal(wrong.status,"invalid-profile");
    const cancelled=cancelTk3SourceMenu(pending.state);
    assert.equal(cancelled.status,"back");
    assert.deepEqual(cancelled.state.variables,state.variables,
      "Cancelling must not spend the source clue");
    const againPending=selectTk3SourceMenu(cancelled.state,plan,id);
    const chosen=confirmTk3MenuProfile(againPending.state,plan,1);
    assert.equal(chosen.status,"clue");
    assert.equal(chosen.state.variables.checked[id],1);
    state=chosen.state;
  }
  for(const id of [4,5]) {
    const out=selectTk3SourceMenu(state,plan,id);
    assert.equal(out.status,"clue");
    state=out.state;
  }
  assert.equal(state.variables.clues,6);
  assert.equal(state.variables.remainingclues,0);
  assert.equal(state.variables[game.award],1,
    "Final flag must derive from included source updateClues method");
  assert.deepEqual(state.variables.checked,[2,1,1,1,1,1]);
  assert.equal(cancelTk3SourceMenu(state).status,"closed");
  const fresh=openTk3SourceMenu(initialLegacyDialogueState(def),plan);
  assert.equal(selectTk3SourceMenu(fresh.state,plan,0).state.variables.clues,1,
    "New session resets all source menu clue visits");

  for(const [variant,word] of [
    [{badInclude:true},"missing"],
    [{removeLabels:true},"no label"],
    [{unknownEvent:true},"Unknown source clue event"],
    [{badUpdate:true},"Expected exactly one"],
  ]) {
    const negative=await synthetic(spec,variant);
    const parsed=await load(negative.fixture);
    const invalid=compileTk3SourceMenu(parsed.artifacts,parsed.scene,
      parsed.action,parsed.def);
    assert.equal(invalid.ok,false,JSON.stringify(variant));
    assert.ok(invalid.diagnostic.path.includes(spec.root+"/Prg/"));
    assert.ok(invalid.diagnostic.line>=1);
    assert.match(invalid.diagnostic.text,new RegExp(word,"i"));
  }
  console.log(spec.id+": six source-owned CCmap menu clues, profile/cancel, repeat, reset, final flag and error paths passed.");
}
const html=await readFile(new URL("../index.html",import.meta.url),"utf8");
const browser=await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs",import.meta.url),"utf8");
const workflow=await readFile(new URL("../.github/workflows/pages.yml",import.meta.url),"utf8");
for(const id of ["play-source-menu","play-source-menu-actions",
  "play-source-menu-profiles","play-source-menu-note","play-source-menu-close"])
  assert.ok(html.includes('id="'+id+'"'));
for(const symbol of ["compileTk3SourceMenu","openTk3SourceMenu",
  "selectTk3SourceMenu","confirmTk3MenuProfile","cancelTk3SourceMenu"])
  assert.ok(browser.includes(symbol));
assert.match(workflow,/node scripts\/check-tk3-source-menu\.mjs/);
assert.match(workflow,/tk3-source-menu\.mjs site\//);
console.log("Source-owned synthetic menus and imported board UI wiring passed.");

// Original archive is LOCAL/READ ONLY, and must never run in GitHub Actions.
if(process.argv[2]) {
  const bytes=await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const archive=await openGameArchive(bytes,b=>JSZip.loadAsync(b));
  const artifacts=(await readArtifacts(archive,{})).artifacts;
  const scene=buildPlayableScene(artifacts,buildReferences(artifacts));
  assert.equal(scene.ok,true);
  const definitions=readLegacyDialogueDefinitions(artifacts,scene);
  const mainMenu=listTk3RuntimeKeys(scene,artifacts)
    .find(a=>a.program==="menuMain.prg");
  assert.ok(mainMenu);
  const menu=compileTk3SourceMenu(artifacts,scene,mainMenu,definitions);
  assert.equal(menu.ok,true,menu.diagnostic?.text);
  assert.deepEqual(menu.choices.map(x=>x.label),
    ["Items","Tactics","Equip","Status","Options","System"]);
  assert.deepEqual(menu.choices.map(x=>x.eventIndex),[3,4,5,6,7,8]);
  assert.equal(menu.awardFlag,"enddemo");
  assert.deepEqual(menu.profiles.map(x=>x.name),["Bruce","Loyalis"]);
  console.log("Read-only original BSTW ZIP: GAM menuMain → menus.prg → six source-authored clue choices and two profile choices resolved.");
}
