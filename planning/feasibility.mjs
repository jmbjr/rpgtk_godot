import {snapshot, technicalSupport, validatePlan} from './planner.mjs';
export const EVALUATOR_VERSION = 'rpgtk-director/0.3.0';
const states = ['verified','partial','missing','unverified'];
const fail = message => {throw Error(message);};
const array = (x,label) => Array.isArray(x) ? x : fail(`${label} must be an array.`);
const object = (x,label) => x && typeof x==='object' && !Array.isArray(x) ? x : fail(`${label} must be an object.`);
const text = (x,label) => typeof x==='string' && x.trim() ? x : fail(`${label} needs text.`);
const positive = n => Number.isSafeInteger(n) && n>0;
const index = (rows,label) => {const m=new Map();for(const r of array(rows,label)){text(r.id,label);if(m.has(r.id))fail(`Duplicate ${label}: ${r.id}`);m.set(r.id,r);}return m;};
const requireRef = (m,id,label) => m.get(id) || fail(`Unknown ${label}: ${id}`);
const sameRef = (r,id,revision,label) => {if(r?.id!==id||r?.revision!==revision)fail(`${label} baseline revisions do not match; reconcile saved records explicitly.`);};
const verdict = (missing,unknown) => missing.length ? 'blocked' : unknown.length ? 'unverified' : 'startable';
const anyState = routes => routes.some(r=>r.state==='startable')?'startable':routes.some(r=>r.state==='unverified')?'unverified':routes.length?'blocked':'blocked';
const triAll = xs => xs.includes(false)?false:xs.includes(null)?null:true;
const triAny = xs => xs.includes(true)?true:xs.includes(null)?null:false;
function checkValue(def,value) {
  if(value===null)return;
  if(def.type==='enum' && def.values.includes(value))return;
  if(def.type==='boolean' && typeof value==='boolean')return;
  fail(`Invalid assumption ${def.id}: ${JSON.stringify(value)}`);
}
// Small, closed predicate language. Unknown is never treated as false.
export function condition(predicate, values, depth=0) {
  if(depth>24)fail('Condition nesting exceeds 24 levels.');
  if([true,false,null].includes(predicate))return {value:predicate,trace:[`Constant: ${predicate===null?'unknown':predicate}`]};
  object(predicate,'Condition');
  if(Object.keys(predicate).length!==1)fail('Condition requires exactly one operator.');
  if(Object.hasOwn(predicate,'equals')) {
    const e=object(predicate.equals,'Equality');
    if(Object.keys(e).sort().join(',')!=='assumption,value'||!Object.hasOwn(values,e.assumption))fail(`Unknown condition assumption: ${e.assumption}`);
    return {value:values[e.assumption]===null?null:values[e.assumption]===e.value,trace:[`${e.assumption} = ${JSON.stringify(values[e.assumption])}; requires ${JSON.stringify(e.value)}`]};
  }
  for(const op of ['allOf','anyOf'])if(Object.hasOwn(predicate,op)) {
    const terms=array(predicate[op],op);if(!terms.length)fail(`${op} condition cannot be empty.`);
    const results=terms.map(p=>condition(p,values,depth+1));
    return {value:(op==='allOf'?triAll:triAny)(results.map(r=>r.value)),trace:[op,...results.flatMap(r=>r.trace)]};
  }
  if(Object.hasOwn(predicate,'not')){const r=condition(predicate.not,values,depth+1);return {value:r.value===null?null:!r.value,trace:['not',...r.trace]};}
  fail('Unsupported condition operator.');
}
function inspectPredicate(p,defs) {
  condition(p,Object.fromEntries([...defs].map(([id])=>[id,null])));
  if(p && typeof p==='object') {
    if(p.equals)checkValue(requireRef(defs,p.equals.assumption,'assumption'),p.equals.value);
    for(const op of ['allOf','anyOf'])for(const child of p[op]||[])inspectPredicate(child,defs);
    if(Object.hasOwn(p,'not'))inspectPredicate(p.not,defs);
  }
}
export function validateFeasibility(plan) {
  validatePlan(plan);
  const m=plan.feasibility;if(!m)return;
  if(m.format!=='rpgtk-capability-feasibility'||m.version!==1||!positive(m.revision))fail('Unsupported feasibility record.');
  text(m.id,'Feasibility ID');
  sameRef(m.projectRef,plan.project.id,plan.project.planningRevision,'Feasibility project');
  sameRef(m.studioRef,plan.studio.id,plan.studio.revision,'Feasibility studio');
  sameRef(m.capabilitiesRef,plan.capabilities.id,plan.capabilities.revision,'Feasibility capabilities');
  const defs=index(m.assumptions,'assumption'), horizons=index(m.horizons,'horizon'), qualities=index(m.qualities,'quality'), profiles=index(m.profiles,'profile');
  for(const def of defs.values()) {
    if(!['enum','boolean'].includes(def.type))fail('Unsupported assumption type.');
    if(def.type==='enum'&&(!array(def.values,'Assumption domain').length||new Set(def.values).size!==def.values.length||def.values.some(v=>typeof v!=='string')))fail('Invalid assumption domain.');
    checkValue(def,def.baseline);text(def.owner,'Assumption owner');text(def.evidence,'Assumption evidence');
  }
  for(const h of horizons.values())if(!Number.isFinite(h.startDay)||!Number.isFinite(h.endDay)||h.startDay<0||h.endDay<=h.startDay)fail('Invalid relative horizon.');
  requireRef(horizons,m.defaultHorizon,'default horizon');
  for(const q of qualities.values())text(q.acceptance,'Quality acceptance');
  for(const p of profiles.values()){if(!positive(p.revision))fail('Invalid profile revision.');for(const id of array(p.qualityIds,'Profile qualities'))requireRef(qualities,id,'profile quality');}
  const profileDef=requireRef(defs,m.profileAssumption,'profile assumption');
  if(profileDef.type!=='enum'||profileDef.values.some(id=>!profiles.has(id)))fail('Profile assumption must enumerate recorded profiles.');
  const assets=index(plan.project.assetRequirements,'asset'), work=index(plan.project.workItems,'work'), inputs=index(plan.project.inputs,'input'), tools=index(plan.studio.tools,'tool');
  for(const [kind,records] of [['assets',assets],['work',work]])for(const [id,p] of Object.entries(object(m.applicability[kind],kind))){requireRef(records,id,kind);inspectPredicate(p,defs);}
  for(const rule of array(m.routeRules,'Route rules')) {
    const task=requireRef(work,rule.workId,'rule work'),route=task.routes.find(r=>r.id===rule.routeId)||fail('Unknown rule route.');
    inspectPredicate(rule.when,defs);
    if(rule.useArtProfile!==true&&rule.useArtProfile!==false)fail('Route profile selection must be explicit.');
    for(const [id,p] of Object.entries(object(rule.inputConditions,'Input conditions'))){if(!route.inputIds.includes(id))fail(`Conditional edge is not a route input: ${id}`);inspectPredicate(p,defs);}
  }
  const routeKeys=m.routeRules.map(r=>r.workId+'/'+r.routeId);if(new Set(routeKeys).size!==routeKeys.length)fail('Duplicate route rule.');
  for(const [tool,claims] of Object.entries(object(m.toolQualities,'Tool qualities'))) {
    requireRef(tools,tool,'quality tool');for(const [id,claim] of Object.entries(object(claims,'Quality claims'))){requireRef(qualities,id,'quality');if(!states.includes(claim.state))fail('Invalid quality support.');text(claim.evidence,'Quality evidence');}
  }
  const proposed=index(m.proposedCapabilities,'proposed capability');
  for(const c of proposed.values()){if(!/^[a-z-]+:[a-z-]+$/.test(c.id))fail('Proposed capability needs a qualified identity.');if(plan.capabilities.records.some(x=>x.id===c.id))fail('Proposed capability shadows an existing identity.');text(c.scope,'Proposed capability scope');}
  for(const [id,reason] of Object.entries(object(m.applicabilityReasons.assets,'Applicability reasons'))){requireRef(assets,id,'applicability reason asset');text(reason,'Applicability reason');}
  index(m.questions,'capability question');
  for(const q of m.questions) {
    requireRef(proposed,q.capabilityId,'question proposed capability');inspectPredicate(q.when,defs);text(q.gap,'Question refinement gap');
    for(const r of array(q.routes,'Question routes')) {
      for(const id of r.tools)requireRef(tools,id,'question tool');
      for(const id of r.inputIds)requireRef(inputs,id,'question input');
      for(const id of r.toolCapabilities)if(!plan.capabilities.records.some(c=>c.id===id&&c.provider!=='person'))fail('Unknown question tool capability.');
      for(const id of r.personCapabilities)if(!plan.capabilities.records.some(c=>c.id===id&&c.provider==='person'))fail('Unknown question contributor capability.');
      for(const id of r.processIds||[])if(!plan.studio.processes.some(p=>p.id===id))fail('Unknown question process.');
      inspectPredicate(r.when,defs);
    }
    index(q.routes,'question route');
  }
  const gateIndex=index(m.dependencyGates,'dependency gate');
  for(const q of m.questions)for(const id of array(q.dependencyGateIds,'Question dependencies'))requireRef(gateIndex,id,'question dependency gate');
  for(const g of m.dependencyGates) {
    if(!['allOf','anyOf'].includes(g.operator))fail('Unsupported dependency gate.');
    text(g.reason,'Dependency gate reason');inspectPredicate(g.when,defs);index(g.members,'dependency member');
    for(const edge of g.members){inspectPredicate(edge.when,defs);text(edge.reason,'Dependency reason');if(edge.inputId)requireRef(inputs,edge.inputId,'dependency input');else text(edge.gap,'Dependency definition gap');}
  }
  for(const c of array(m.contradictions,'Contradictions')){inspectPredicate(c.when,defs);text(c.message,'Contradiction explanation');}
  for(const s of plan.scenarios.scenarios)validateFeasibilityScenario(plan,s);
}
export function validateFeasibilityScenario(plan,s) {
  const m=plan.feasibility;if(!m)return;
  sameRef(s.feasibilityRef,m.id,m.revision,'Feasibility');
  const defs=index(m.assumptions,'assumption'), values=Object.fromEntries(m.assumptions.map(d=>[d.id,d.baseline]));
  for(const [id,v] of Object.entries(object(s.projectAssumptions,'Project assumptions'))){checkValue(requireRef(defs,id,'scenario assumption'),v);values[id]=v;}
  for(const c of m.contradictions)if(condition(c.when,values).value===true)fail(`Contradictory scenario: ${c.message}`);
  const horizons=index(m.horizons,'horizon');requireRef(horizons,s.viewingHorizon,'viewing horizon');
  for(const person of [...plan.studio.people,...s.addPeople].map(p=>({...p,...s.peopleOverrides[p.id]}))) {
    if(person.availabilityWindow!==undefined&&person.availabilityWindow!==null)requireRef(horizons,person.availabilityWindow,'person availability window');
    // One capacity offer per person in this first increment. No duplicated budgets or prorating.
  }
  const qualities=index(m.qualities,'quality'),tools=index(plan.studio.tools,'tool');
  for(const [tool,claims] of Object.entries(object(s.toolQualityOverrides,'Quality assumptions'))) {
    requireRef(tools,tool,'quality override tool');object(claims,'Quality override');
    for(const [id,v] of Object.entries(claims)){requireRef(qualities,id,'quality override');if(!states.includes(v))fail('Invalid quality assumption.');}
  }
  return values;
}
function staffing(route, people, studio, horizon, horizons) {
  const capable=people.filter(p=>route.personCapabilities.every(c=>p.capabilities.includes(c)));
  const providers=[],laterProviders=[],unknown=[];
  for(const p of capable) {
    if(p.willing===false||p.availabilityHours===0)continue;
    if(p.willing!==true||p.availabilityHours===null||!p.availabilityWindow){unknown.push(`${p.name}: willingness, hours or availability window unverified`);continue;}
    const w=horizons.find(h=>h.id===p.availabilityWindow);
    if(w.startDay>=horizon.startDay&&w.endDay<=horizon.endDay)providers.push(p.id);
    else if(w.startDay>=horizon.endDay)laterProviders.push(p.id);
    else if(w.endDay>horizon.startDay)unknown.push(`${p.name}: partial overlap does not establish capacity in this horizon`);
  }
  const state=providers.length?'supported':unknown.length?'unverified':laterProviders.length?'later':capable.length||studio.rosterComplete?'unavailable':'unverified';
  return {state,providers,laterProviders,unknown,capableIds:capable.map(p=>p.id),reason:!capable.length?'No declared contributor; roster completeness is separate evidence':state==='later'?'Known offer is later than the selected horizon':state==='unavailable'?'No positive willing capacity offer in this horizon':null};
}
function profileCheck(route,m,s,tools,values) {
  const id=values[m.profileAssumption],missing=[],unknown=[];
  if(id===null)return {id:null,missing,unknown:['Artwork profile is unselected; production sufficiency is unverified'],qualities:[]};
  const p=m.profiles.find(x=>x.id===id),qualities=p.qualityIds.map(id=>{
    const candidates=route.tools.map(t=>({toolId:t,state:s.toolQualityOverrides[t]?.[id]||m.toolQualities[t]?.[id]?.state||'unverified',evidence:Object.hasOwn(s.toolQualityOverrides[t]||{},id)?'Scenario assumption only':m.toolQualities[t]?.[id]?.evidence||'No quality evidence'}));
    // All qualities must be supplied by the same usable authoring tool, not a fictitious union of partial tools.
    return {id,candidates};
  });
  const viable=route.tools.some(t=>tools.find(x=>x.id===t)?.available===true&&route.toolCapabilities.every(c=>tools.find(x=>x.id===t)?.capabilitySupport[c]==='verified')&&p.qualityIds.every(q=>(s.toolQualityOverrides[t]?.[q]||m.toolQualities[t]?.[q]?.state)==='verified'));
  if(!viable) {
    for(const q of qualities) {
      if(q.candidates.every(c=>c.state==='missing'))missing.push(`Profile quality missing: ${q.id}`);
      else if(!q.candidates.some(c=>c.state==='verified'&&tools.find(t=>t.id===c.toolId)?.available===true))unknown.push(`Profile quality not verified with access: ${q.id}`);
    }
    if(!missing.length&&!unknown.length)unknown.push('No single accessible tool supplies all profile qualities');
  }
  if(p.gap)unknown.push(`Profile needs refinement: ${p.gap}`);
  return {id,revision:p.revision,missing,unknown,qualities};
}
export function derivePlan(plan,s) {
  validateFeasibility(plan); // Validate saved scenario set as well as the selected/editable scenario.
  const base=snapshot(plan.project,plan.studio,s,plan.capabilities),m=plan.feasibility;
  if(!m)return {...base,evaluatorVersion:EVALUATOR_VERSION,modelGap:'No feasibility record; target/profile/window evaluation unavailable.'};
  const values=validateFeasibilityScenario(plan,s), horizon=m.horizons.find(h=>h.id===s.viewingHorizon);
  const applies=p=>condition(p,values);
  function routeResult(route,rule,needCondition) {
    const applicability=applies({allOf:[needCondition,rule?.when??null]});
    if(applicability.value===false)return {...route,applicability,state:'not-applicable',missing:[],unknown:[],providers:[]};
    const edges=route.inputIds.map(id=>({id,...applies(rule?.inputConditions?.[id]??true)}));
    const activeRoute={...route,inputIds:edges.filter(e=>e.value===true).map(e=>e.id)};
    const technical=technicalSupport(activeRoute,base.tools,base.inputs,base.processes);
    for(const e of edges.filter(e=>e.value===null))technical.unknown.push(`Dependency applicability unverified: ${e.id}`);
    const profile=rule?.useArtProfile?profileCheck(route,m,s,base.tools,values):null;
    if(profile){technical.missing.push(...profile.missing);technical.unknown.push(...profile.unknown);}
    const staff=staffing(route,base.people,plan.studio,horizon,m.horizons),missing=[...technical.missing],unknown=[...technical.unknown];
    if(applicability.value===null)unknown.push('Route applicability is unverified');
    if(staff.state==='unavailable'||staff.state==='later')missing.push(staff.reason);
    else if(staff.state==='unverified')unknown.push(...staff.unknown,staff.reason||'Contributor support unverified');
    return {...route,applicability,edges,profile,technical:{...technical,state:verdict(technical.missing,technical.unknown)},staff,missing,unknown,providers:staff.providers,state:verdict(missing,unknown)};
  }
  const results=plan.project.workItems.map(w=>{
    const needCondition=m.applicability.work[w.id]??m.applicability.assets[w.requirement.id]??null,applicability=applies(needCondition);
    applicability.reason=m.applicabilityReasons.assets[w.requirement.id]||'No applicability rationale recorded';
    const routes=w.routes.map(r=>routeResult(r,m.routeRules.find(x=>x.workId===w.id&&x.routeId===r.id),needCondition));
    const active=routes.filter(r=>r.state!=='not-applicable');
    return {...w,applicability,routes,state:applicability.value===false?'not-applicable':anyState(active),definitionGap:!Object.hasOwn(m.applicability.work,w.id)?'Work applicability has no explicit refinement; inherits asset condition':null};
  });
  const assets=base.assets.map(a=>({...a,applicability:applies(m.applicability.assets[a.id]??null),work:results.filter(w=>w.requirement.id===a.id)}));
  const milestones=base.milestones.map(m=>({...m,applicableAssetIds:m.assetIds.filter(id=>assets.find(a=>a.id===id).applicability.value!==false),notApplicable:m.assetIds.every(id=>assets.find(a=>a.id===id).applicability.value===false)}));
  const contention=base.people.map(p=>({personId:p.id,name:p.name,hours:p.availabilityHours,window:p.availabilityWindow,workIds:results.filter(w=>w.routes.some(r=>r.state==='startable'&&r.providers.includes(p.id))).map(w=>w.id)})).filter(p=>p.workIds.length>1);
  const dependencyGates=m.dependencyGates.map(g=>{
    const applicability=applies(g.when),members=g.members.map(e=>{const a=applies(e.when),input=base.inputs.find(i=>i.id===e.inputId);return {...e,applicability:a,value:a.value===false?null:a.value===null?null:input?input.available:null};});
    const active=members.filter(e=>e.applicability.value!==false),value=applicability.value!==true?null:!active.length?null:(g.operator==='allOf'?triAll:triAny)(active.map(e=>e.value));
    return {...g,applicability,members,value};
  });
  const questions=m.questions.map(q=>({...q,applicability:applies(q.when),dependencies:q.dependencyGateIds.map(id=>dependencyGates.find(g=>g.id===id)),routes:q.routes.map(r=>routeResult(r,{when:r.when,useArtProfile:q.useArtProfile,inputConditions:{}},q.when))}));
  return {...base,evaluatorVersion:EVALUATOR_VERSION,feasibilityRef:s.feasibilityRef,values,horizon,results,assets,milestones,contention,questions,dependencyGates,
    assumptionTrace:m.assumptions.map(d=>({...d,value:values[d.id],basis:Object.hasOwn(s.projectAssumptions,d.id)?'scenario hypothesis':'recorded baseline'})),
    counts:Object.fromEntries(['startable','blocked','unverified','not-applicable'].map(k=>[k,results.filter(w=>w.state===k).length])),
    definitionGaps:m.definitionGaps};
}
