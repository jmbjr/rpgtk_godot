// Planning snapshot evaluator. No writes to the project or studio; no schedule optimizer.
export function snapshot(project, studio, scenario) {
  if (scenario.projectRef.id !== project.id || scenario.projectRef.revision !== project.planningRevision ||
      scenario.studioRef.id !== studio.id || scenario.studioRef.revision !== studio.revision)
    throw new Error('Scenario baseline revisions do not match the loaded project and studio.');
  const people = [...studio.people, ...scenario.addPeople].map(p => ({...p, ...(scenario.peopleOverrides[p.id] || {})}));
  if (new Set(people.map(p => p.id)).size !== people.length) throw new Error('Duplicate person IDs.');
  if (people.length > studio.scale.maximumPeople) throw new Error('This plan supports at most five people.');
  for (const p of people) {
    if (!p.id || !Array.isArray(p.capabilities) || ![true,false,null].includes(p.willing) ||
        !(p.availabilityHours === null || Number.isFinite(p.availabilityHours) && p.availabilityHours >= 0))
      throw new Error('Invalid person capability, willingness or capacity record.');
  }
  for (const [overrides, records] of [[scenario.toolAvailability, studio.tools], [scenario.inputAvailability, project.inputs]]) {
    for (const [id,value] of Object.entries(overrides)) {
      if (!records.some(r=>r.id===id) || ![true,false,null].includes(value))
        throw new Error('Unknown override identity or invalid readiness: ' + id);
    }
  }
  if (Object.keys(scenario.peopleOverrides).some(id=>!studio.people.some(p=>p.id===id)))
    throw new Error('Unknown person override identity.');
  const tools = studio.tools.map(t => ({...t, available: Object.hasOwn(scenario.toolAvailability,t.id) ? scenario.toolAvailability[t.id] : t.available}));
  const inputs = project.inputs.map(i => ({...i, available: Object.hasOwn(scenario.inputAvailability,i.id) ? scenario.inputAvailability[i.id] : i.available}));
  const toolIndex = new Map(tools.map(t => [t.id,t]));
  const inputIndex = new Map(inputs.map(i => [i.id,i]));
  const processIndex = new Map(studio.processes.map(p => [p.id,p]));
  const results = project.workItems.map(work => {
    const routes = work.routes.map(route => {
      const missing = [], unknown = [];
      for (const id of route.inputIds) {
        const input = inputIndex.get(id); const label = input?.label || id;
        if (input?.available === false) missing.push('Input: ' + label);
        else if (input?.available !== true) unknown.push('Input unverified: ' + label);
      }
      for (const id of route.tools) {
        const tool = toolIndex.get(id); const label = tool?.label || id;
        if (tool?.available === false) missing.push('Tool unavailable: ' + label);
        else if (tool?.available !== true) unknown.push('Tool access/support unverified: ' + label);
      }
      for (const id of route.toolCapabilities) {
        if (!route.tools.some(t => toolIndex.get(t)?.capabilities.includes(id)))
          missing.push('No route tool provides ' + id);
      }
      for (const id of route.processIds || []) {
        const process = processIndex.get(id);
        if (process?.available === false) missing.push('Process unavailable: ' + (process?.label || id));
        else if (process?.available !== true) unknown.push('Process unverified: ' + (process?.label || id));
      }
      const capable = people.filter(p => route.personCapabilities.every(c => p.capabilities.includes(c)));
      const providers = capable.filter(p => p.willing === true && Number.isFinite(p.availabilityHours) && p.availabilityHours > 0);
      if (!capable.length) unknown.push('No declared person provides ' + route.personCapabilities.join(', ') + '; roster/capabilities need confirmation');
      else if (!providers.length) {
        const uncertain = capable.some(p => p.willing !== false && p.availabilityHours !== 0 && (p.willing == null || p.availabilityHours == null));
        (uncertain ? unknown : missing).push('No confirmed willing provider with positive known capacity');
      }
      return {...route, missing, unknown, providers:providers.map(p => p.id), state: missing.length ? 'blocked' : unknown.length ? 'unverified' : 'startable'};
    });
    const state = routes.some(r => r.state === 'startable') ? 'startable' : routes.some(r => r.state === 'unverified') ? 'unverified' : 'blocked';
    return {id:work.id, title:work.title, requirementId:work.requirement.id, state, routes};
  });
  const contention = people.map(person => ({personId:person.id, name:person.name, hours:person.availabilityHours,
    workIds: results.filter(w => w.state === 'startable' && w.routes.some(r => r.state === 'startable' && r.providers.includes(person.id))).map(w=>w.id)
  })).filter(p=>p.workIds.length>1);
  return {people, tools, inputs, results, contention, counts: Object.fromEntries(['startable','blocked','unverified'].map(s=>[s,results.filter(w=>w.state===s).length]))};
}
