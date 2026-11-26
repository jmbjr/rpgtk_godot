export const EVALUATOR_VERSION = 'rpgtk-director/0.2.0';
const fail = message => { throw new Error(message); };
const list = (value, label) => Array.isArray(value) ? value : fail(`${label} must be an array.`);
const nonempty = (value, label) => typeof value === 'string' && value.trim() ? value : fail(`${label} must be nonempty text.`);
const index = (records, label) => {
  const result = new Map();
  for (const record of list(records, label)) {
    nonempty(record.id, `${label} ID`);
    if (result.has(record.id)) fail(`Duplicate ${label} ID: ${record.id}`);
    result.set(record.id, record);
  }
  return result;
};
const ref = (records, id, label) => records.get(id) || fail(`Unknown ${label}: ${id}`);
const revision = (value, label) => Number.isSafeInteger(value) && value > 0 || fail(`Invalid ${label} revision.`);
const tri = (value, label) => [true, false, null].includes(value) || fail(`Invalid ${label}; use true, false or null.`);
const supportStates = ['verified', 'partial', 'missing', 'unverified'];
const finiteHours = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
function sameRef(actual, id, rev, label) {
  if (actual?.id !== id || actual?.revision !== rev) fail(`${label} baseline revisions do not match; reconcile the saved records explicitly.`);
}
function validatePerson(person, caps) {
  nonempty(person.name, 'Person name');
  for (const id of list(person.capabilities, 'Person capabilities')) {
    if (ref(caps, id, 'person capability').provider !== 'person') fail(`Not a contributor capability: ${id}`);
  }
  tri(person.willing, 'willingness');
  if (!finiteHours(person.availabilityHours)) fail('Person availability must be nonnegative finite hours or null.');
}
export function validatePlan({project, studio, scenarios, capabilities, intake}) {
  for (const [record, format, version] of [[project, null, 1], [studio, 'rpgtk-studio-planning-draft', 1],
    [scenarios, 'rpgtk-studio-scenarios-draft', 1], [capabilities, 'rpgtk-capability-ledger', 1], [intake, 'rpgtk-owner-intake', 1]]) {
    nonempty(record?.id, 'Record ID');
    if (format && record.format !== format || record.version !== version) fail('Unsupported planning record format/version.');
    revision(record === project ? project.planningRevision : record.revision, 'Record');
  }
  sameRef(project.studioRef, studio.id, studio.revision, 'Studio');
  sameRef(project.capabilitiesRef, capabilities.id, capabilities.revision, 'Capabilities');
  sameRef(project.intakeRef, intake.id, intake.revision, 'Intake');
  const caps = index(capabilities.records, 'capability');
  for (const capability of caps.values()) if (!/^(?:authoring:C\d{2}|player:C\d{2}|person:[a-z-]+|(?:infrastructure|inspection|execution):[a-z-]+)$/.test(capability.id)) fail(`Unqualified capability identity: ${capability.id}`);
  const assets = index(project.assetRequirements, 'asset');
  const goals = index(project.projectRequirements, 'project requirement');
  const inputs = index(project.inputs, 'input');
  const tools = index(studio.tools, 'tool');
  const processes = index(studio.processes, 'process');
  const people = index(studio.people, 'person');
  const work = index(project.workItems, 'work');
  const sources = index(project.sources, 'source');
  for (const asset of assets.values()) {
    revision(asset.revision, 'Asset'); ref(goals, asset.projectRequirementId, 'project requirement');
    for (const id of asset.sourceIds || []) ref(sources, id, 'asset evidence');
  }
  for (const input of inputs.values()) {
    tri(input.available, 'input availability');
    if (input.available === true && !(typeof input.evidence === 'string' && input.evidence.trim()) && !input.binding) fail(`Available baseline input lacks evidence: ${input.id}`);
  }
  for (const tool of tools.values()) {
    tri(tool.available, 'tool access');
    for (const id of list(tool.capabilities, 'Tool capabilities')) {
      const capability = ref(caps, id, 'tool capability');
      if (capability.provider === 'person' || capability.provider === 'player') fail(`Not a tool capability: ${id}`);
      if (!supportStates.includes(tool.capabilitySupport?.[id])) fail(`Missing tool support state: ${tool.id}/${id}`);
    }
    for (const id of Object.keys(tool.capabilitySupport || {})) if (!tool.capabilities.includes(id)) fail(`Tool support names an undeclared capability: ${id}`);
  }
  for (const process of processes.values()) tri(process.available, 'process support');
  for (const person of people.values()) validatePerson(person, caps);
  if (!Number.isSafeInteger(studio.scale?.maximumPeople) || studio.scale.maximumPeople < 1) fail('Invalid studio size limit.');
  for (const task of work.values()) {
    const asset = ref(assets, task.requirement?.id, 'work requirement');
    sameRef(task.requirement, asset.id, asset.revision, 'Work requirement');
    if (!list(task.routes, 'Production routes').length) fail(`Work has no production route: ${task.id}`);
    index(task.routes, 'route');
    for (const route of task.routes) {
      for (const id of list(route.inputIds, 'Route inputs')) ref(inputs, id, 'route input');
      for (const id of list(route.tools, 'Route tools')) ref(tools, id, 'route tool');
      for (const id of list(route.personCapabilities, 'Route contributor capabilities')) {
        if (ref(caps, id, 'route capability').provider !== 'person') fail(`Wrong route contributor capability: ${id}`);
      }
      for (const id of list(route.toolCapabilities, 'Route tool capabilities')) ref(caps, id, 'route capability');
      for (const id of route.processIds || []) ref(processes, id, 'route process');
    }
    for (const id of list(task.producesInputIds, 'Work outputs')) ref(inputs, id, 'work output');
    if (!finiteHours(task.effortHours)) fail('Effort must be finite nonnegative hours or null.');
  }
  for (const asset of assets.values()) for (const id of asset.workItemIds || []) {
    if (ref(work, id, 'asset work').requirement.id !== asset.id) fail('Asset and work link disagree.');
  }
  const dependencies = new Map();
  for (const edge of list(project.assetDependencies, 'Asset dependencies')) {
    ref(assets, edge.assetId, 'dependent asset');
    for (const id of list(edge.requiresAll, 'Asset prerequisites')) ref(assets, id, 'asset prerequisite');
    if (dependencies.has(edge.assetId)) fail('Duplicate asset dependency record.');
    dependencies.set(edge.assetId, edge.requiresAll);
  }
  const done = new Set();
  function visit(id, ancestors = new Set()) {
    if (ancestors.has(id)) fail(`Cyclic mandatory asset dependencies: ${id}`);
    if (done.has(id)) return;
    for (const next of dependencies.get(id) || []) visit(next, new Set([...ancestors, id]));
    done.add(id);
  }
  for (const id of assets.keys()) visit(id);
  for (const milestone of index(project.milestones, 'milestone').values()) for (const id of milestone.assetIds) ref(assets, id, 'milestone asset');
  for (const mapping of project.authoringMappings) {
    ref(assets, mapping.assetId, 'capability mapping asset');
    for (const id of mapping.capabilityIds) ref(caps, id, 'asset capability');
  }
  for (const edge of capabilities.historicalEdges) { ref(caps, edge.from, 'capability edge'); ref(caps, edge.to, 'capability edge'); }
  for (const rule of capabilities.productionRules) for (const id of [...rule.anyOf, ...rule.thenAllOf, ...rule.conditional]) ref(caps, id, 'production rule');
  // Review and selection evidence refers to exact saved bytes, not an editable label.
  const variants = new Map();
  for (const variant of list(project.variants, 'Variants')) {
    const asset = ref(assets, variant.requirement?.id, 'variant requirement');
    revision(variant.revision, 'Variant'); revision(variant.requirement.revision, 'Variant requirement');
    if (!/^[a-f0-9]{64}$/.test(variant.contentHash)) fail('Variant needs an exact SHA-256 content identity.');
    const key = `${variant.id}@${variant.revision}`;
    if (variants.has(key)) fail('Duplicate variant revision.');
    if (variant.requirement.revision > asset.revision) fail('Variant references a future requirement.');
    variants.set(key, variant);
  }
  for (const input of inputs.values()) if (input.binding) {
    const bound = ref(variants, `${input.binding.variantRef?.id}@${input.binding.variantRef?.revision}`, 'bound input variant');
    if (bound.contentHash !== input.binding.variantRef.contentHash) fail('Input binding content identity mismatch.');
  }
  for (const review of list(project.reviews, 'Reviews')) {
    const variant = ref(variants, `${review.variantRef?.id}@${review.variantRef?.revision}`, 'review variant');
    if (review.variantRef.contentHash !== variant.contentHash) fail('Review content identity mismatch.');
    sameRef(review.requirement, variant.requirement.id, variant.requirement.revision, 'Review requirement');
    nonempty(review.reviewer, 'Reviewer'); nonempty(review.evidence, 'Review evidence');
    if (!['accepted', 'provisional', 'changes-requested'].includes(review.decision)) fail('Invalid review decision.');
    nonempty(review.target, 'Review target'); nonempty(review.scope, 'Review scope');
  }
  for (const build of list(project.buildSelections, 'Build selections')) for (const binding of list(build.bindings, 'Build bindings')) {
    const variant = ref(variants, `${binding.variantRef?.id}@${binding.variantRef?.revision}`, 'selected variant');
    if (binding.variantRef.contentHash !== variant.contentHash) fail('Build content identity mismatch.');
    sameRef(binding.requirement, variant.requirement.id, variant.requirement.revision, 'Build requirement');
  }
  if (!list(scenarios.scenarios, 'Scenarios').length) fail('At least one scenario is required.');
  for (const scenario of index(scenarios.scenarios, 'scenario').values()) validateScenario(project, studio, capabilities, scenario);
  for (const id of [scenarios.viewedScenarioId, scenarios.adoptedScenarioId]) if (id !== null && !scenarios.scenarios.some(s => s.id === id)) fail('Unknown viewed or adopted scenario.');
  return {caps, assets, inputs, tools, processes, people, work};
}
export function validateScenario(project, studio, capabilities, scenario) {
  sameRef(scenario.projectRef, project.id, project.planningRevision, 'Project');
  sameRef(scenario.studioRef, studio.id, studio.revision, 'Studio');
  sameRef(scenario.capabilitiesRef, capabilities.id, capabilities.revision, 'Capabilities');
  revision(scenario.revision, 'Scenario');
  for (const field of ['peopleOverrides', 'toolAvailability', 'inputAvailability', 'processAvailability', 'toolSupportOverrides']) {
    if (!scenario[field] || typeof scenario[field] !== 'object' || Array.isArray(scenario[field])) fail(`Invalid scenario ${field}.`);
  }
  const caps = index(capabilities.records, 'capability');
  const people = [...studio.people, ...list(scenario.addPeople, 'Assumed people')].map(p => ({...p, ...(scenario.peopleOverrides[p.id] || {})}));
  index(people, 'person');
  if (people.length > studio.scale.maximumPeople) fail(`Scenario exceeds ${studio.scale.maximumPeople}-person studio limit.`);
  for (const id of Object.keys(scenario.peopleOverrides)) if (![...studio.people, ...scenario.addPeople].some(p => p.id === id)) fail(`Unknown person override: ${id}`);
  for (const person of people) validatePerson(person, caps);
  for (const [overrides, records] of [[scenario.toolAvailability, studio.tools], [scenario.inputAvailability, project.inputs], [scenario.processAvailability, studio.processes]]) {
    for (const [id, value] of Object.entries(overrides)) { if (!records.some(r => r.id === id)) fail(`Unknown override identity: ${id}`); tri(value, 'scenario override'); }
  }
  for (const [id, overrides] of Object.entries(scenario.toolSupportOverrides)) {
    const tool = studio.tools.find(t => t.id === id) || fail(`Unknown tool support override: ${id}`);
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) fail('Invalid tool support override.');
    for (const [cap, state] of Object.entries(overrides)) if (!tool.capabilities.includes(cap) || !supportStates.includes(state)) fail(`Unknown tool capability override: ${id}/${cap}`);
  }
  const work = index(project.workItems, 'work');
  for (const id of list(scenario.scheduledWork, 'Scheduled work')) ref(work, id, 'scheduled work');
  return people;
}
export function technicalSupport(route, tools, inputs, processes) {
  const toolIndex = index(tools, 'tool'), inputIndex = index(inputs, 'input'), processIndex = index(processes, 'process');
      const missing = [], unknown = [];
      for (const id of route.inputIds) {
        const input = ref(inputIndex, id, 'input');
        if (input.available === false) missing.push(`Input: ${input.label}`);
        else if (input.available !== true) unknown.push(`Input unverified: ${input.label}`);
      }
      for (const id of route.tools) {
        const tool = ref(toolIndex, id, 'tool');
        if (tool.available === false) missing.push(`Tool access: ${tool.label}`);
        else if (tool.available !== true) unknown.push(`Tool access unverified: ${tool.label}`);
      }
      for (const cap of route.toolCapabilities) {
        const candidates = route.tools.map(id => toolIndex.get(id)).filter(t => t.capabilities.includes(cap));
        if (!candidates.length || candidates.every(t => t.capabilitySupport[cap] === 'missing')) missing.push(`Tool capability missing: ${cap}`);
        else if (!candidates.some(t => t.available === true && t.capabilitySupport[cap] === 'verified')) unknown.push(`Tool capability not verified with access: ${cap}`);
      }
      for (const id of route.processIds || []) {
        const process = ref(processIndex, id, 'process');
        if (process.available === false) missing.push(`Process: ${process.label}`);
        else if (process.available !== true) unknown.push(`Process unverified: ${process.label}`);
      }
  return {missing, unknown};
}
export function snapshot(project, studio, scenario, capabilities) {
  const people = validateScenario(project, studio, capabilities, scenario);
  const apply = (records, overrides) => records.map(record => ({...record, available: Object.hasOwn(overrides, record.id) ? overrides[record.id] : record.available}));
  const tools = apply(studio.tools, scenario.toolAvailability).map(t => ({...t, capabilitySupport: {...t.capabilitySupport, ...scenario.toolSupportOverrides[t.id]}}));
  const inputs = apply(project.inputs, scenario.inputAvailability);
  const processes = apply(studio.processes, scenario.processAvailability);
  const results = project.workItems.map(work => {
    const routes = work.routes.map(route => {
      const {missing, unknown} = technicalSupport(route, tools, inputs, processes);
      const capable = people.filter(p => route.personCapabilities.every(c => p.capabilities.includes(c)));
      const providers = capable.filter(p => p.willing === true && p.availabilityHours > 0);
      if (!capable.length) (studio.rosterComplete === true ? missing : unknown).push(`No declared contributor: ${route.personCapabilities.join(', ') || 'roster incomplete'}`);
      else if (!providers.length) {
        const uncertain = capable.some(p => p.willing !== false && p.availabilityHours !== 0 && (p.willing === null || p.availabilityHours === null));
        (uncertain ? unknown : missing).push('No confirmed willing contributor with positive known capacity');
      }
      return {...route, missing, unknown, providers: providers.map(p => p.id), state: missing.length ? 'blocked' : unknown.length ? 'unverified' : 'startable'};
    });
    const state = routes.some(r => r.state === 'startable') ? 'startable' : routes.some(r => r.state === 'unverified') ? 'unverified' : 'blocked';
    return {...work, state, routes};
  });
  const contention = people.map(p => ({personId:p.id, name:p.name, hours:p.availabilityHours,
    workIds:results.filter(w => w.routes.some(r => r.state === 'startable' && r.providers.includes(p.id))).map(w => w.id)})).filter(p => p.workIds.length > 1);
  // Proposed work, assumed inputs and available capacity never complete assets.
  const assets = project.assetRequirements.map(asset => {
    const variants = project.variants.filter(v => v.requirement.id === asset.id && v.requirement.revision === asset.revision);
    const reviews = project.reviews.filter(r => variants.some(v => r.variantRef.id === v.id && r.variantRef.revision === v.revision && r.variantRef.contentHash === v.contentHash));
    const accepted = reviews.filter(r => r.decision === 'accepted' && r.scope === 'whole-requirement' && r.target === 'tk3');
    const selected = project.buildSelections.flatMap(b => b.bindings).filter(b => b.requirement.id === asset.id && b.requirement.revision === asset.revision);
    return {...asset, proposedRevisionCount:variants.length, acceptedRevisionCount:accepted.length, selectedRevisionCount:selected.length,
      fulfillment:accepted.length ? 'accepted-revision-recorded' : variants.length ? 'proposed-revision-recorded' : 'no-variant-recorded',
      work:results.filter(w => w.requirement.id === asset.id)};
  });
  const milestones = project.milestones.map(m => ({...m, assets:assets.filter(a => m.assetIds.includes(a.id)),
    acceptanceRecorded: m.assetIds.filter(id => assets.find(a => a.id === id).acceptedRevisionCount > 0).length}));
  return {evaluatorVersion:EVALUATOR_VERSION, projectRef:scenario.projectRef, studioRef:scenario.studioRef, capabilitiesRef:scenario.capabilitiesRef,
    scenarioRef:{id:scenario.id,revision:scenario.revision}, people, tools, inputs, processes, results, assets, milestones, contention,
    counts:Object.fromEntries(['startable','blocked','unverified'].map(s => [s, results.filter(w => w.state === s).length]))};
}
