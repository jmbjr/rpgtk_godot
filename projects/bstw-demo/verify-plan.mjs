import fs from 'node:fs';
import assert from 'node:assert/strict';
import {snapshot} from './planner.mjs';
const root=new URL('.',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,root));
const project=JSON.parse(read('bstw.project.json'));
const studio=JSON.parse(read('bstw.studio.json'));
const file=JSON.parse(read('bstw.scenarios.json'));
const clone=x=>structuredClone(x);
const results=file.scenarios.map(s=>snapshot(project,studio,s));
const startable=r=>r.results.filter(w=>w.state==='startable').map(w=>w.id).sort();
assert.deepEqual(startable(results[0]),[]);
assert.deepEqual(startable(results[1]),['BSTW-W-TILE-ISLAND']);
assert.deepEqual(startable(results[2]),['STUDIO-W-BOARD-TOOL','STUDIO-W-TILESET-TOOL']);
assert.deepEqual(startable(results[3]),['BSTW-W-TILE-ISLAND','STUDIO-W-BOARD-TOOL','STUDIO-W-TILESET-TOOL']);
assert.deepEqual(startable(results[4]),['BSTW-W-BOARD-ISLAND']);
assert.equal(results[2].contention.length,1);
assert.equal(results[2].contention[0].hours,6);
assert.equal(results[2].inputs.find(i=>i.id==='island-tileset').available,false);
// A supplied alternative route is enough even while the internal tool is absent.
assert.equal(results[4].tools.find(t=>t.id==='rpgtk-board-editor').available,false);
const board=results[0].results.find(w=>w.id==='BSTW-W-BOARD-ISLAND');
assert(board.routes[0].missing.some(x=>x.includes('numbered island tileset')));
assert(board.routes[0].missing.some(x=>x.includes('board editor')));
assert(board.routes[0].unknown.some(x=>x.includes('No declared person')));
// A skilled resource who declines cannot provide a ready route.
const declined=clone(file.scenarios[1]);declined.addPeople[0].willing=false;
assert(!startable(snapshot(project,studio,declined)).includes('BSTW-W-TILE-ISLAND'));
// Unknown capacity or tool support does not become ready.
const hours=clone(file.scenarios[1]);hours.addPeople[0].availabilityHours=null;
assert.equal(snapshot(project,studio,hours).results.find(w=>w.id==='BSTW-W-TILE-ISLAND').state,'unverified');
const tool=clone(file.scenarios[1]);tool.toolAvailability['rpgtk-pencil']=null;
assert(!startable(snapshot(project,studio,tool)).includes('BSTW-W-TILE-ISLAND'));
// An input gap stays blocking even when the person and editor exist.
const input=clone(file.scenarios[1]);input.inputAvailability['island-art-brief']=false;
assert.equal(snapshot(project,studio,input).results.find(w=>w.id==='BSTW-W-TILE-ISLAND').state,'blocked');
// Baseline data and all source scenarios remain unchanged during evaluation.
const before=JSON.stringify({project,studio,file});file.scenarios.forEach(s=>snapshot(project,studio,s));
assert.equal(JSON.stringify({project,studio,file}),before);
const wrong=clone(file.scenarios[0]);wrong.projectRef.revision=2;
assert.throws(()=>snapshot(project,studio,wrong),/revisions/);
const many=clone(file.scenarios[0]);many.addPeople=Array.from({length:5},(_,i)=>({id:'p'+i,capabilities:[],availabilityHours:null,willing:null}));
assert.throws(()=>snapshot(project,studio,many),/five people/);
const duplicate=clone(file.scenarios[0]);duplicate.addPeople=[clone(studio.people[0])];
assert.throws(()=>snapshot(project,studio,duplicate),/Duplicate/);
// Verify every stable identity and dependency link.
const goals=new Set(project.projectRequirements.map(x=>x.id)), assets=new Map(project.assetRequirements.map(x=>[x.id,x]));
const inputs=new Set(project.inputs.map(x=>x.id)), tools=new Set(studio.tools.map(x=>x.id));
const caps=new Set(project.capabilityVocabulary.map(x=>x.id));
for(const a of assets.values())assert(goals.has(a.projectRequirementId));
for(const w of project.workItems){assert.equal(assets.get(w.requirement.id).revision,w.requirement.revision);for(const r of w.routes){r.inputIds.forEach(id=>assert(inputs.has(id)));r.tools.forEach(id=>assert(tools.has(id)));r.personCapabilities.concat(r.toolCapabilities).forEach(id=>assert(caps.has(id)));}w.producesInputIds.forEach(id=>assert(inputs.has(id)));}
assert.deepEqual(project.variants,[]);assert.deepEqual(project.reviews,[]);assert.deepEqual(project.buildSelections,[]);
console.log('PASS: five expected scenario outcomes; all route blockers; alternatives; declined/unknown resources; no output bootstrapping; shared capacity; isolation; revisions; team limit; identity links.');
