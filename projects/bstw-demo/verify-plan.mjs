import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, relative} from 'node:path';
import {snapshot, validatePlan} from '../../planning/planner.mjs';
import {readPlan} from '../../planning/load-plan.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=async name=>JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const plan={project:await read('bstw.project.json'),studio:await read('bstw.studio.json'),scenarios:await read('bstw.scenarios.json'),capabilities:await read('capabilities.json'),intake:await read('intake.json')};
const {project,studio,capabilities,scenarios}=plan, clone=structuredClone;
validatePlan(plan);
const compute=s=>snapshot(project,studio,s,capabilities);
const ready=s=>compute(s).results.filter(w=>w.state==='startable').map(w=>w.id).sort();
assert.deepEqual(scenarios.scenarios.map(ready),[[],['BSTW-W-TILE-CAVE'],['STUDIO-W-BOARD-TOOL','STUDIO-W-TILESET-TOOL'],['BSTW-W-TILE-CAVE','STUDIO-W-BOARD-TOOL','STUDIO-W-TILESET-TOOL'],['BSTW-W-BOARD-CAVE']]);
assert.equal(project.assetRequirements.find(a=>a.id==='A05').title,'Merlin’s Cave board (BRD)');
assert.deepEqual(project.milestones[0].assetIds,['A01','A02','A03','A04','A05','A06']);
assert.deepEqual(project.workItems.find(w=>w.id==='BSTW-W-MAIN').routes[0].inputIds,['bruce-definition','cave-board']);
assert(!project.workItems.find(w=>w.id==='BSTW-W-MAIN').routes[0].inputIds.includes('ending-program'));
for(let i=1;i<=12;i++)assert(capabilities.records.some(c=>c.id===`authoring:C${String(i).padStart(2,'0')}`));
assert.notEqual(capabilities.records.find(c=>c.id==='player:C01').label,capabilities.records.find(c=>c.id==='authoring:C01').label);
const allBefore=JSON.stringify(plan), a=compute(scenarios.scenarios[3]), b=compute(scenarios.scenarios[3]);
assert.deepEqual(a,b);assert.equal(JSON.stringify(plan),allBefore);
assert.equal(a.contention.length,1);assert.equal(a.contention[0].hours,6);
assert.equal(a.inputs.find(i=>i.id==='cave-tileset').available,false);
assert(a.assets.every(x=>x.acceptedRevisionCount===0));
const blocked=compute(scenarios.scenarios[0]).results.find(w=>w.id==='BSTW-W-BOARD-CAVE');
assert(blocked.routes[0].missing.length>=3);assert(blocked.routes[0].unknown.length>=1);
assert.equal(compute(scenarios.scenarios[4]).results.find(w=>w.id==='BSTW-W-BOARD-CAVE').state,'startable');
assert(compute(scenarios.scenarios[4]).results.find(w=>w.id==='BSTW-W-BOARD-CAVE').routes.some(r=>r.state==='blocked'));
for(const [field,value,state] of [['willing',false,'blocked'],['availabilityHours',0,'blocked'],['availabilityHours',null,'unverified']]) {
 const s=clone(scenarios.scenarios[1]);s.addPeople[0][field]=value;
 assert.equal(compute(s).results.find(w=>w.id==='BSTW-W-TILE-CAVE').state,state);
}
const access=clone(scenarios.scenarios[1]);access.toolSupportOverrides={};
assert(!ready(access).includes('BSTW-W-TILE-CAVE'),'Access does not turn missing support into verification');
const partial=clone(scenarios.scenarios[1]);partial.toolSupportOverrides['rpgtk-pencil']['authoring:C01']='partial';
assert.equal(compute(partial).results.find(w=>w.id==='BSTW-W-TILE-CAVE').state,'unverified');
const noInput=clone(scenarios.scenarios[1]);noInput.inputAvailability['cave-art-brief']=false;assert(!ready(noInput).length);
for(const mutate of [
 p=>p.scenarios.scenarios[0].projectRef.revision=1,
 p=>p.scenarios.scenarios[0].toolAvailability.unknown=true,
 p=>p.scenarios.scenarios[0].inputAvailability.unknown=true,
 p=>p.scenarios.scenarios[0].toolSupportOverrides['rpgtk-pencil']={'authoring:C04':'verified'},
 p=>p.scenarios.scenarios[0].peopleOverrides.unknown={willing:true},
 p=>p.studio.people[0].availabilityHours=-1,
 p=>p.studio.people[0].availabilityHours=Infinity,
 p=>p.studio.people[0].capabilities=['C01'],
 p=>p.project.workItems[0].requirement.revision=1,
 p=>p.project.workItems[0].routes[0].inputIds=['absent-input'],
 p=>p.project.inputs[0].available=true,
 p=>p.project.assetDependencies.push({assetId:'A02',requiresAll:['A04']}),
 p=>p.capabilities.records.push(clone(p.capabilities.records[0])),
 p=>p.capabilities.records.push({id:'C01',label:'Ambiguous identity'}),
 p=>p.project.inputs[0].binding={},
 p=>p.scenarios.scenarios=[],
 p=>p.scenarios.adoptedScenarioId='absent',
 p=>p.scenarios.scenarios[0].addPeople=Array.from({length:5},(_,i)=>({id:'p'+i,name:'Assumed',capabilities:[],willing:true,availabilityHours:1})),
]) {const changed=clone(plan);mutate(changed);assert.throws(()=>validatePlan(changed));}
// Exact review scope, bytes and requirement revision: partial contributions never accept a set.
const evidence=clone(plan), hash='a'.repeat(64);
evidence.project.variants=[{id:'diagnostic-contribution',revision:1,requirement:{id:'A01',revision:2},contentHash:hash}];
evidence.project.reviews=[{variantRef:{id:'diagnostic-contribution',revision:1,contentHash:hash},requirement:{id:'A01',revision:2},reviewer:'Diagnostic reviewer',evidence:'Synthetic test only',decision:'accepted',target:'tk3',scope:'partial-contribution'}];
validatePlan(evidence);
assert.equal(snapshot(evidence.project,studio,scenarios.scenarios[1],capabilities).assets.find(x=>x.id==='A01').acceptedRevisionCount,0);
evidence.project.reviews[0].scope='whole-requirement';
assert.equal(snapshot(evidence.project,studio,scenarios.scenarios[1],capabilities).assets.find(x=>x.id==='A01').acceptedRevisionCount,1);
evidence.project.assetRequirements.find(x=>x.id==='A01').revision=3;
assert.equal(snapshot(evidence.project,studio,scenarios.scenarios[1],capabilities).assets.find(x=>x.id==='A01').acceptedRevisionCount,0);
evidence.project.reviews[0].variantRef.contentHash='b'.repeat(64);assert.throws(()=>validatePlan(evidence));
// Normal source loader verifies manifest hashes and linked records; a changed file cannot hide behind the same revision.
const fetcher=async url=>{const path=resolve(root,'.'+url.pathname);if(relative(root,path).startsWith('..'))return {ok:false,status:403};try{return {ok:true,status:200,text:()=>readFile(path,'utf8')};}catch{return {ok:false,status:404};}};
const url='http://planning.test/projects/bstw-demo/project.manifest.json';
const loaded=await readPlan(url,fetcher);assert.equal(loaded.project.id,project.id);
assert.equal(loaded.fingerprints.project,createHash('sha256').update(await readFile(resolve(root,'projects/bstw-demo/bstw.project.json'))).digest('hex'));
const corrupt=async url=>{const result=await fetcher(url);if(url.pathname.endsWith('bstw.project.json'))return {...result,text:async()=>JSON.stringify({...project,title:'Changed without repinning'})};return result;};
await assert.rejects(()=>readPlan(url,corrupt),/fingerprint mismatch/);
await assert.rejects(()=>readPlan(url,async()=>({ok:false,status:404})),/HTTP 404/);
assert.deepEqual(compute(scenarios.scenarios[3]),snapshot(loaded.project,loaded.studio,loaded.scenarios.scenarios[3],loaded.capabilities));
console.log('PASS: recovered launch/identity graph; five scenarios; OR/AND blockers; support/access; willingness/hours; contention; no output chaining; exact/partial/stale reviews; malformed references; cycle/roster limits; hashes and deterministic reopen.');
