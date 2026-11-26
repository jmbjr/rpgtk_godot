import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {derivePlan,condition,validateFeasibility} from '../planning/feasibility.mjs';
const read=async n=>JSON.parse(await readFile(new URL('../projects/bstw-demo/'+n,import.meta.url),'utf8'));
const plan={project:await read('bstw.project.json'),studio:await read('bstw.studio.json'),scenarios:await read('bstw.scenarios.json'),capabilities:await read('capabilities.json'),intake:await read('intake.json'),feasibility:await read('feasibility.json')};
const clone=structuredClone,s=()=>clone(plan.scenarios.scenarios[3]),compute=(x,p=plan)=>derivePlan(p,x),work=(r,id='BSTW-W-TILE-CAVE')=>r.results.find(w=>w.id===id);
validateFeasibility(plan);
assert.equal(condition({allOf:[null,false]},{}).value,false);assert.equal(condition({anyOf:[null,true]},{}).value,true);assert.equal(condition({not:null},{}).value,null);
assert.throws(()=>condition({mystery:1},{}));assert.throws(()=>condition({equals:{assumption:'absent',value:true}},{}));
const before=JSON.stringify(plan),normal=compute(s());assert.deepEqual(normal,compute(s()));assert.equal(JSON.stringify(plan),before);
assert.equal(normal.assets.find(a=>a.id==='BSTW-STORY').applicability.value,true);
assert.equal(work(normal).state,'startable');assert.equal(normal.contention[0].hours,6);
const physical=s();physical.projectAssumptions['project.target']='physical-only';let r=compute(physical);
assert.equal(work(r).state,'not-applicable');assert.equal(work(r,'BSTW-W-MAIN').state,'not-applicable');
assert(r.questions.some(q=>q.id==='shared-editable-artwork'&&q.applicability.value===true));
assert.equal(r.assets.find(a=>a.id==='BSTW-STORY').applicability.value,null);
assert(r.assets.some(a=>a.applicability.value===null),'Unknown applicability remains inspectable');
assert(r.milestones[0].notApplicable);assert.equal(r.dependencyGates[0].value,null);
assert.equal(r.dependencyGates[0].members.find(e=>e.id==='tk3-output').applicability.value,false);
assert(r.dependencyGates[0].members.find(e=>e.id==='physical-output').gap);
assert.equal(normal.dependencyGates[0].value,false,'Digital output still missing; no automatic output chaining');
const prod=s();prod.projectAssumptions['project.artProfile']='production-art';r=compute(prod);
assert.equal(work(r).routes[0].technical.state,'blocked');assert(work(r).routes[0].missing.some(x=>x.includes('undo')));
assert.equal(work(r).routes[1].technical.state,'unverified');assert.equal(work(r).state,'unverified','Unknown external OR route prevents universal blocked claim');
assert(work(r).routes[0].unknown.some(x=>x.includes('needs refinement')));
const external=s();external.toolAvailability['rpgtk-pencil']=false;external.toolAvailability['external-art-editor']=true;external.toolSupportOverrides['external-art-editor']={'authoring:C01':'verified'};external.toolQualityOverrides['external-art-editor']={'save-reopen':'verified'};assert.equal(work(compute(external)).state,'startable','A viable external route does not require pencil integration');
const exactProduction=clone(plan);delete exactProduction.feasibility.profiles.find(p=>p.id==='production-art').gap;external.projectAssumptions['project.artProfile']='production-art';external.toolQualityOverrides['external-art-editor']=Object.fromEntries(exactProduction.feasibility.qualities.map(q=>[q.id,'verified']));assert.equal(work(compute(external,exactProduction)).state,'startable','Synthetic refined profile can be met by one verified external tool');
const later=s();later.addPeople.find(p=>p.id==='assumed-artist').availabilityWindow='later';r=compute(later);
assert.equal(work(r).routes[0].technical.state,'startable');assert.equal(work(r).routes[0].staff.state,'later');assert.equal(work(r).routes[0].staff.laterProviders[0],'assumed-artist');assert.notEqual(work(r).state,'startable');
later.viewingHorizon='later';assert.equal(work(compute(later)).state,'startable');
const unknown=s();delete unknown.addPeople[0].availabilityWindow;assert.equal(work(compute(unknown)).state,'unverified','Hours alone are not a window');
const declined=s();declined.addPeople[0].willing=false;assert.equal(work(compute(declined)).state,'blocked','All recorded routes lack a willing provider despite unknown external technical support');assert.equal(work(compute(declined)).routes[0].staff.state,'unavailable');
const overlap=clone(plan);overlap.feasibility.horizons.push({id:'overlap',startDay:7,endDay:21,label:'Overlapping offer'});const os=s();os.addPeople[0].availabilityWindow='overlap';r=compute(os,overlap);assert.equal(work(r).routes[0].staff.state,'unverified');assert(work(r).routes[0].staff.unknown.some(x=>x.includes('partial overlap')));
const noProfile=s();noProfile.projectAssumptions['project.artProfile']=null;assert.equal(work(compute(noProfile)).routes[0].technical.state,'unverified');
const independent=s();independent.toolAvailability['rpgtk-pencil']=false;r=compute(independent);assert.equal(work(r).routes[0].staff.state,'supported');assert.equal(work(r).routes[0].technical.state,'blocked');
// Conditional route inputs are evaluated before support. An excluded missing input is not a phantom blocker.
const conditional=clone(plan),rule=conditional.feasibility.routeRules.find(r=>r.workId==='BSTW-W-TILE-CAVE'&&r.routeId==='pencil');
rule.inputConditions['cave-art-brief']={equals:{assumption:'project.target',value:'physical-only'}};
const cs=s();cs.inputAvailability['cave-art-brief']=false;r=compute(cs,conditional);assert.equal(work(r).routes[0].state,'startable');assert.equal(work(r).routes[0].edges[0].value,false);
cs.projectAssumptions['project.target']=null;r=compute(cs,conditional);assert.equal(work(r).routes[0].state,'unverified');assert(work(r).routes[0].unknown.some(x=>x.includes('Dependency applicability')));
const noRoute=clone(plan);for(const rule of noRoute.feasibility.routeRules.filter(x=>x.workId==='BSTW-W-TILE-CAVE'))rule.when=false;
assert.equal(work(compute(s(),noRoute)).state,'blocked');assert.match(work(compute(s(),noRoute)).missing[0],/no applicable recorded route/);
// AND and OR gates retain inactive/unknown members and do not count an empty branch as success.
const gate=clone(plan);gate.feasibility.dependencyGates[0].operator='anyOf';assert.equal(compute(s(),gate).dependencyGates[0].value,false);
gate.feasibility.dependencyGates[0].members.push({id:'known-fixture',when:true,inputId:'synthetic-tool-fixtures',reason:'Synthetic OR witness only'});assert.equal(compute(s(),gate).dependencyGates[0].value,true);gate.feasibility.dependencyGates[0].operator='allOf';assert.equal(compute(s(),gate).dependencyGates[0].value,false);gate.feasibility.dependencyGates[0].members.pop();
gate.feasibility.dependencyGates[0].members[0].when=false;assert.equal(compute(s(),gate).dependencyGates[0].value,null);
for(const mutate of [
 p=>delete p.scenarios.scenarios[0].feasibilityRef,
 p=>p.scenarios.scenarios[0].feasibilityRef.revision=99,
 p=>p.scenarios.scenarios[0].projectAssumptions['unknown']=true,
 p=>p.scenarios.scenarios[0].projectAssumptions['project.target']='not-a-target',
 p=>p.scenarios.scenarios[0].projectAssumptions={'project.target':'physical-only','project.requireVideoExecution':true},
 p=>p.scenarios.scenarios[0].toolQualityOverrides={'unknown':{'undo':'verified'}},
 p=>p.scenarios.scenarios[0].toolQualityOverrides={'rpgtk-pencil':{'unknown':'verified'}},
 p=>p.scenarios.scenarios[0].peopleOverrides['owner-director']={availabilityWindow:'absent'},
 p=>p.feasibility.routeRules[0].inputConditions={'absent':true},
 p=>p.feasibility.routeRules.push(clone(p.feasibility.routeRules[0])),
 p=>p.feasibility.applicability.work['absent']=true,
 p=>p.feasibility.horizons[0].endDay=0,
 p=>p.feasibility.assumptions[0].baseline='invalid',
]){const p=clone(plan);mutate(p);assert.throws(()=>validateFeasibility(p));}
assert(r.assets.every(a=>a.acceptedRevisionCount===0));assert.equal(normal.inputs.find(i=>i.id==='cave-tileset').available,false);
const persisted=clone(physical);persisted.projectAssumptions['project.artProfile']='production-art';persisted.addPeople[0].availabilityWindow='later';persisted.viewingHorizon='later';assert.deepEqual(compute(JSON.parse(JSON.stringify(persisted))),compute(persisted));
assert.deepEqual(compute(JSON.parse(JSON.stringify(s()))),normal,'Exact scenario JSON reopen reproduces explanations');
const legacy=clone(plan);delete legacy.feasibility;assert.match(compute(s(),legacy).modelGap,/No feasibility record/);
console.log('PASS: tri-state predicates; target exclusions; conditional AND/OR edges; shared art/refinement gaps; quality/tool alternatives; independent staffing; later/overlap/unknown capacity; contradictory/stale/malformed records; deterministic persistence; no acceptance or output chaining.');
