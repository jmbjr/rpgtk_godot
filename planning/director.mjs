import {readPlan} from './load-plan.mjs';
import {snapshot, validatePlan, EVALUATOR_VERSION} from './planner.mjs';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelState = state => ({startable:'Can start', blocked:'Blocked', unverified:'Unverified'}[state] || state);
const badge = state => `<span class="badge ${esc(state)}">${esc(labelState(state))}</span>`;
let plan, original, selected, scenarios, loadedURL, generation = 0;
const capName = id => plan.capabilities.records.find(c => c.id === id)?.label || id;
const current = () => scenarios.scenarios.find(s => s.id === selected);
const evaluate = s => snapshot(plan.project, plan.studio, s, plan.capabilities);
const select = (kind, id, value, options, cap = '') => `<select aria-label="${esc(kind+' '+id+(cap?' '+cap:''))}" data-kind="${esc(kind)}" data-id="${esc(id)}" data-cap="${esc(cap)}">${options.map(([v,l]) => `<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
const triOptions = [['unknown','Unverified'],['true','Available'],['false','Unavailable']];
const triValue = v => v === true ? 'true' : v === false ? 'false' : 'unknown';
const triSelect = (kind,id,v) => select(kind,id,triValue(v),triOptions);
const clone = value => structuredClone(value);
function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url),0);
}
function safeLink(value, label) {
  if (!value) return esc(label);
  try { const url = new URL(value, loadedURL); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return esc(label); return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`; }
  catch { return esc(label); }
}
function renderComparison() {
  const rows = scenarios.scenarios.map(s => ({scenario:s,state:evaluate(s)}));
  $('compare').innerHTML = `<thead><tr><th>Planning option</th>${rows.map(({scenario:s}) => `<th>${esc(s.title)}</th>`).join('')}</tr></thead><tbody><tr><th>Assumptions</th>${rows.map(({scenario:s}) => `<td>${esc(s.description)}</td>`).join('')}</tr>${['startable','blocked','unverified'].map(key => `<tr><th>${esc(labelState(key))}</th>${rows.map(({state:s}) => `<td>${s.counts[key]}</td>`).join('')}</tr>`).join('')}<tr><th>Shared capacity</th>${rows.map(({state:s}) => `<td>${s.contention.map(p => esc(p.name)+' · '+p.hours+' hours shared across '+p.workIds.length+' tasks').join('<br>') || 'No confirmed contention'}</td>`).join('')}</tr></tbody>`;
}
function renderResults() {
  const state = evaluate(current()); renderComparison();
  $('identity').textContent = `Project ${plan.project.id}@${plan.project.planningRevision} · Studio ${plan.studio.id}@${plan.studio.revision} · ${EVALUATOR_VERSION} · Scenario ${current().id}@${current().revision}`;
  $('milestone-cards').innerHTML = state.milestones.map(m => `<article class="card"><p class="eyebrow">${esc(m.id)}</p><h3>${esc(m.title)}</h3><p class="metric">${m.acceptanceRecorded} / ${m.assetIds.length}</p><p>Needs with whole-requirement acceptance recorded</p><p class="note">${m.assetIds.map(esc).join(' · ')}</p></article>`).join('');
  const ready = state.results.filter(w => w.state === 'startable');
  $('startable').innerHTML = ready.length ? ready.map(w => `<div class="record"><strong>${esc(w.title)}</strong> ${badge(w.state)}<p>${esc(w.brief)}</p>${w.enablesCapabilities?.length ? `<p class="note">Enables: ${w.enablesCapabilities.map(esc).join(', ')} · support must be verified after delivery.</p>` : ''}<p class="note">${esc(w.id)} → ${esc(w.requirement.id)}@${w.requirement.revision} · Effort: ${w.effortHours === null ? 'unknown' : w.effortHours+' hours'}</p><p class="note">Eligible people: ${[...new Set(w.routes.filter(r => r.state === 'startable').flatMap(r => r.providers))].map(id => esc(state.people.find(p => p.id === id).name)).join(', ')}</p></div>`).join('') : '<p>No work has a fully confirmed route under these assumptions. Expand a need to inspect all blockers and unknowns.</p>';
  $('contention').innerHTML = state.contention.map(p => `<p class="warning">Shared capacity: ${esc(p.name)} has ${p.hours} hours across ${p.workIds.length} eligible tasks. Hours are not multiplied by capability or task; no allocation is implied.</p>`).join('');
  const filter = $('filter').value;
  const groups = [...new Set(state.assets.map(a => a.group))];
  $('asset-list').innerHTML = groups.map(group => {
    const assets = state.assets.filter(a => a.group === group && (filter === 'all' || a.work.some(w => w.state === filter))).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (!assets.length) return '';
    return `<h3>${esc(group)} · ${assets.length} needs</h3>${assets.map(asset => {
      const dependency = plan.project.assetDependencies.find(e => e.assetId === asset.id);
      const mapping = plan.project.authoringMappings.find(m => m.assetId === asset.id);
      return `<details data-asset="${esc(asset.id)}"><summary>${esc(asset.id)} · ${esc(asset.title)} <span class="badge">${esc(asset.fulfillment)}</span></summary><p>${esc(asset.constraints)}</p><p><strong>Acceptance:</strong> ${esc(asset.acceptance)}</p><p class="note">Requirement revision ${asset.revision} · ${esc(asset.status)} · Proposed revisions: ${asset.proposedRevisionCount} · Accepted: ${asset.acceptedRevisionCount} · Selected uses: ${asset.selectedRevisionCount}</p><p class="dependency">Requires: ${(dependency?.requiresAll || []).map(esc).join(' AND ') || 'See production-route inputs'}<br>Authoring capabilities: ${(mapping?.capabilityIds || []).map(esc).join(', ') || 'No separate mapping recorded'}</p>${asset.work.map(w => `<details data-work="${esc(w.id)}"><summary>${esc(w.title)} ${badge(w.state)}</summary><p>${esc(w.brief)}</p>${w.enablesCapabilities?.length ? `<p class="note">Enables: ${w.enablesCapabilities.map(esc).join(', ')} · support must be verified after delivery.</p>` : ''}<p class="note">${esc(w.id)} · ${esc(w.acceptance)} · Effort: ${w.effortHours === null ? 'unknown' : w.effortHours+' hours'}</p>${w.routes.map(r => `<div class="panel"><h3>${esc(r.label)} ${badge(r.state)}</h3><p class="note">Contributor: ${r.personCapabilities.map(capName).map(esc).join(', ')}<br>Tool capabilities: ${r.toolCapabilities.map(esc).join(', ') || 'None required'}</p>${r.missing.length+r.unknown.length ? `<ul>${[...r.missing,...r.unknown].map(reason => `<li>${esc(reason)}</li>`).join('')}</ul>` : '<p>All route prerequisites are satisfied under this scenario.</p>'}${r.inputIds.length ? `<p class="note">Inputs and producer work: ${r.inputIds.map(id => `${esc(id)} ← ${plan.project.workItems.filter(x => x.producesInputIds.includes(id)).map(x => esc(x.id)).join(', ') || 'no producer recorded'}`).join('<br>')}</p>` : ''}</div>`).join('')}</details>`).join('') || '<p class="note">No bounded production work released. Review the recorded scope before assigning it.</p>'}</details>`;
    }).join('')}`;
  }).join('') || '<p>No needs match this readiness filter.</p>';
}
function renderControls() {
  const s = current(), state = evaluate(s);
  $('scenario').innerHTML = scenarios.scenarios.map(x => `<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.title)}</option>`).join('');
  $('scenario-note').textContent = `${s.description} ${s.assumptionNote} Adopted scenario: ${scenarios.adoptedScenarioId || 'none'}. Scheduled work: ${s.scheduledWork.length}.`;
  $('people').innerHTML = state.people.map(p => `<div class="record"><input class="person-name" aria-label="Name ${esc(p.id)}" data-kind="name" data-id="${esc(p.id)}" value="${esc(p.name)}"><div class="controls"><label>Hours <input aria-label="Hours ${esc(p.id)}" type="number" min="0" step="0.5" data-kind="hours" data-id="${esc(p.id)}" value="${p.availabilityHours ?? ''}" placeholder="Unknown"></label><label>Willingness ${select('willing',p.id,triValue(p.willing),[['unknown','Unverified'],['true','Willing'],['false','Declined']])}</label></div><div class="checks">${plan.capabilities.records.filter(c => c.provider === 'person').map(c => `<label><input type="checkbox" data-kind="cap" data-id="${esc(p.id)}" data-cap="${esc(c.id)}" ${p.capabilities.includes(c.id)?'checked':''}>${esc(c.label)}</label>`).join('')}</div></div>`).join('');
  $('tools').innerHTML = state.tools.map(t => `<details><summary>${esc(t.label)}</summary><p class="note">${esc(t.support)} · Evidence: ${esc(t.evidence || 'unverified')}</p><label>Access ${triSelect('tool',t.id,t.available)}</label>${t.capabilities.map(id => `<div class="record"><label>${esc(capName(id))} ${select('tool-support',t.id,t.capabilitySupport[id],[['verified','Verified'],['partial','Partial'],['missing','Missing'],['unverified','Unverified']],id)}</label></div>`).join('')}</details>`).join('');
  $('inputs').innerHTML = state.inputs.map(i => `<div class="record"><label>${esc(i.label)} ${triSelect('input',i.id,i.available)}</label></div>`).join('');
  $('processes').innerHTML = state.processes.map(p => `<div class="record"><label>${esc(p.label)} ${triSelect('process',p.id,p.available)}</label><p class="note">${esc(p.status)}</p></div>`).join('');
  $('add-person').disabled = state.people.length >= plan.studio.scale.maximumPeople;
  renderResults();
}
function renderFixed() {
  const p = plan.project;
  $('title').textContent = p.title; document.title = p.title+' · Studio director';
  $('scope').textContent = p.scope.game;
  $('route').innerHTML = p.scope.confirmedRoute.map(step => `<span>${esc(step)}</span>`).join('');
  $('studio').innerHTML = `<div class="panel"><h3>Resources</h3><p>${plan.studio.people.length} recorded people; scenario limit ${plan.studio.scale.maximumPeople} unique people. Unknown capability, willingness and availability remain unknown.</p><p class="note">${esc(plan.studio.title)}</p></div><div class="panel"><h3>Processes</h3>${plan.studio.processes.map(x => `<p><strong>${esc(x.label)}</strong><br>${esc(x.status)}</p>`).join('')}</div><div class="panel"><h3>Values</h3>${plan.studio.values.map(x => `<p>${esc(x.rule)}</p>`).join('')}</div>`;
  $('decisions').innerHTML = p.decisions.map(d => `<p><strong>${esc(d.id)} · ${esc(d.title)}</strong> <span class="badge">${esc(d.state)}</span></p>`).join('');
  $('capabilities').innerHTML = `<p>${plan.capabilities.identityNotes.map(esc).join('<br>')}</p><div class="table-wrap"><table><thead><tr><th>Qualified identity</th><th>Original ID</th><th>Capability</th><th>Kind</th></tr></thead><tbody>${plan.capabilities.records.map(c => `<tr><td>${esc(c.id)}</td><td>${esc(c.sourceId)}</td><td>${esc(c.label)}</td><td>${esc(c.kind)}</td></tr>`).join('')}</tbody></table></div><p>Recovered graph edges are a historical decomposition. Actual route requirements and alternative tile supply determine work readiness.</p><ul>${plan.capabilities.historicalEdges.map(e => `<li>${esc(e.from)} → ${esc(e.to)} · ${esc(e.status)}</li>`).join('')}</ul>`;
  $('fingerprints').innerHTML = `<p>${esc(EVALUATOR_VERSION)}</p>${Object.entries(plan.fingerprints).map(([key,digest]) => `<p>${safeLink(plan.recordURLs[key] || plan.manifestURL,key)}<br><code>SHA-256 ${esc(digest)}</code></p>`).join('')}`;
  $('sources').innerHTML = `<p>${safeLink(new URL('INTAKE.md',loadedURL).href,'Recovered intake and reconciliation')}</p>${p.sources.map(s => `<p><strong>${safeLink(s.url,s.id)}</strong><br>${esc(s.summary)}</p>`).join('')}<h3>Remaining gaps</h3><ul>${p.coverageGaps.map(g => `<li>${esc(g.description)}</li>`).join('')}</ul>`;
}
async function openProject(url) {
  const request = ++generation; $('error').textContent = ''; $('scope').textContent = 'Loading linked records…';
  document.body.dataset.state = 'loading';
  try {
    const next = await readPlan(url); if (request !== generation) return;
    plan = next; loadedURL = next.manifestURL; original = clone(plan.scenarios); scenarios = clone(original);
    selected = scenarios.viewedScenarioId || scenarios.scenarios[0].id;
    renderFixed(); renderControls(); document.body.dataset.state = 'ready';
    const locationURL = new URL(location.href); locationURL.searchParams.set('project',loadedURL); history.replaceState(null,'',locationURL);
    $('project-picker').value = loadedURL;
  } catch (error) { document.body.dataset.state = 'error'; $('startable').textContent=''; $('identity').textContent=''; $('title').textContent='Project unavailable'; $('error').textContent = `Plan could not be derived: ${error.message}`; $('scope').textContent = 'Fix the linked record or revision mismatch and reopen the project.'; }
}
$('scenario').onchange = e => { selected=e.target.value; renderControls(); };
$('filter').onchange = renderResults;
$('copy').onclick = () => {
  const s = clone(current()); let n=1; while(scenarios.scenarios.some(x => x.id === 'scenario-'+n)) n++;
  s.id='scenario-'+n; s.revision=1; s.title='Planning option '+n; s.status='hypothetical-not-a-commitment'; s.scheduledWork=[];
  scenarios.scenarios.push(s); selected=s.id; renderControls();
};
$('restore').onclick = () => { const saved=original.scenarios.find(s => s.id===selected); if (!saved) { $('error').textContent='This copied scenario has no baseline. Load its saved record or select an original scenario.'; return; } scenarios.scenarios=scenarios.scenarios.map(s => s.id===selected?clone(saved):s); $('error').textContent=''; renderControls(); };
$('save').onclick = () => download('planning.scenarios.json',{...scenarios,viewedScenarioId:selected});
$('export-snapshot').onclick = () => download('director.snapshot.json',{format:'rpgtk-derived-director-snapshot',version:1,manifest:plan.manifest,fingerprints:plan.fingerprints,assumptions:clone(current()),snapshot:evaluate(current())});
$('load').onchange = async e => {
  try { const file=e.target.files[0]; if (!file) return; if (file.size>2_000_000) throw Error('Scenario file exceeds 2 MB.'); const candidate=JSON.parse(await file.text()); validatePlan({...plan,scenarios:candidate}); scenarios=candidate; selected=candidate.viewedScenarioId || candidate.scenarios[0].id; $('error').textContent=''; renderControls(); }
  catch(error) { $('error').textContent='Could not load scenarios: '+error.message; }
};
$('add-person').onclick = () => {
  if (evaluate(current()).people.length >= plan.studio.scale.maximumPeople) return;
  const existing=evaluate(current()).people; let n=1; while(existing.some(p => p.id==='assumed-person-'+n)) n++;
  current().addPeople.push({id:'assumed-person-'+n,name:'Hypothetical person '+n,capabilities:[],availabilityHours:null,willing:null,evidence:'Scenario assumption only'});
  current().revision++; renderControls();
};
document.addEventListener('change', e => {
  const {kind,id,cap}=e.target.dataset; if (!kind || !plan) return;
  const before=clone(current()), s=current(), value=e.target.value, tri=value==='true'?true:value==='false'?false:null;
  try {
    if (['name','hours','willing','cap'].includes(kind)) {
      let person=s.addPeople.find(p => p.id===id);
      if (!person) { s.peopleOverrides[id] ||= {}; person=s.peopleOverrides[id]; }
      if (kind==='name') person.name=value;
      if (kind==='hours') person.availabilityHours=value===''?null:Number(value);
      if (kind==='willing') person.willing=tri;
      if (kind==='cap') { const all=evaluate(before).people.find(p => p.id===id).capabilities; person.capabilities=e.target.checked?[...new Set([...all,cap])]:all.filter(c => c!==cap); }
    }
    if (kind==='tool') s.toolAvailability[id]=tri;
    if (kind==='tool-support') { s.toolSupportOverrides[id] ||= {}; s.toolSupportOverrides[id][cap]=value; }
    if (kind==='input') s.inputAvailability[id]=tri;
    if (kind==='process') s.processAvailability[id]=tri;
    s.revision++; s.status='edited-what-if'; evaluate(s); $('error').textContent=''; renderResults();
  } catch(error) { scenarios.scenarios=scenarios.scenarios.map(x => x.id===s.id?before:x); $('error').textContent=error.message; renderControls(); }
});
try {
  const registryURL=new URL('../docs/planning/index.json',import.meta.url), response=await fetch(registryURL,{cache:'no-store'});
  if (!response.ok) throw Error(`Project index HTTP ${response.status}`);
  const registry=await response.json(); if(registry.format!=='rpgtk-project-index'||registry.version!==1||!registry.projects?.length) throw Error('Invalid project index.');
  const projects=registry.projects.map(p => ({title:p.title,url:new URL(p.path,registryURL).href}));
  $('project-picker').innerHTML=projects.map(p => `<option value="${esc(p.url)}">${esc(p.title)}</option>`).join('');
  $('project-picker').onchange=e => openProject(e.target.value);
  await openProject(new URL(location.href).searchParams.get('project') || projects[0].url);
} catch(error) { $('error').textContent='Project index could not be opened: '+error.message; }
