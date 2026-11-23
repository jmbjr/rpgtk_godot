import { createDependencyInvestigation, dependencyLimits } from "./dependency-investigation.mjs";
import { referenceDestination } from "./connection-map.mjs";
import { assetIdentity, referenceExplanation } from "./asset-presentation.mjs";

const node = (tag, text = "", className = "") => {
  const result = document.createElement(tag); result.textContent = text; result.className = className; return result;
};
const name = path => path?.split("/").at(-1) ?? "Unspecified";
const label = row => name(row.path ?? row.label) + (row.tile ? " · Tile " + row.tile : "");
const evidenceLabel = edge => [edge.evidence, edge.line ? "line " + edge.line : "", edge.value].filter(Boolean).join(" · ");

export function mountDependencyView(container, { open, source, changed, closed }) {
  let session, artifacts, active, activeControl, snapshot;
  const control = (text, action) => { const button = node("button", text); button.type = "button"; button.addEventListener("click", action); return button; };
  const focus = element => { element.focus({ preventScroll: true }); element.scrollIntoView({ block: element === heading || element === evidence ? "start" : "nearest" }); };
  const heading = node("h3", "Board dependencies"); heading.id = "dependency-title"; heading.tabIndex = -1;
  const rootLabel = node("p", "", "technical"); rootLabel.id = "dependency-root";
  const tools = node("div", "", "task-buttons");
  tools.append(control("Return to board", () => open({ path: session.root })), control("Close investigation", () => { clear(); changed(); closed(); }));
  const summary = node("p", "", "technical"); summary.id = "dependency-summary"; summary.setAttribute("role", "status");
  const outline = node("ol", "", "dependency-outline"); outline.setAttribute("aria-label", "Board dependency trail");
  const evidence = node("section", "", "dependency-evidence"); evidence.id = "dependency-evidence"; evidence.tabIndex = -1; evidence.hidden = true;
  container.append(heading, rootLabel, node("p", "Expand outgoing references to investigate why assets belong here. These are evidenced static links, not a complete runtime or required-file list. Candidates are not dependencies until resolved."), tools, summary, outline, evidence);
  function clear() { session = undefined; active = undefined; container.hidden = true; outline.replaceChildren(); evidence.replaceChildren(); evidence.hidden = true; }
  function showEvidence(row, button) {
    active = row.id; activeControl = button;
    for (const b of outline.querySelectorAll('[aria-pressed]')) b.setAttribute("aria-pressed", String(b === button));
    evidence.hidden = false;
    evidence.replaceChildren(node("h4", label(row)), node("p", "Trail: " + [...row.trail, row.path ?? row.label].join(" → "), "technical"));
    if (row.path) evidence.append(node("p", assetIdentity(artifacts.get(row.path)).support));
    const explanation = node("p", referenceExplanation(row.edges[0])); evidence.append(explanation);
    const list = node("ul", "", "edge-list"); evidence.append(list);
    let shown = 0;
    const more = control("", () => { append(); focus(list.children[shown - 1]); });
    function append() {
      const end = Math.min(row.edges.length, shown + dependencyLimits.evidenceBatch, dependencyLimits.evidence);
      for (const edge of row.edges.slice(shown, end)) {
        const item = node("li"); item.tabIndex = -1;
        item.append(node("p", edge.from, "technical"), node("p", evidenceLabel(edge)));
        const fields = [edge.inlineSlot === undefined ? "" : "Program slot " + edge.inlineSlot,
          edge.argument === undefined ? "" : "Argument " + edge.argument,
          edge.position ? "Position " + JSON.stringify(edge.position) : "",
          edge.tiles === undefined ? "" : edge.tiles + " board placements"];
        if (fields.some(Boolean)) item.append(node("p", fields.filter(Boolean).join(" · "), "technical"));
        const target = referenceDestination(edge, false, artifacts), owner = referenceDestination(edge, true, artifacts);
        if (target) item.append(control("Open target" + (target.tile ? " · Tile " + target.tile : "") + " · " + name(target.path), () => open(target)));
        if (owner) item.append(control(edge.line ? "View source · line " + edge.line : "Inspect owner fields", () => source(owner)));
        const candidates = edge.candidates ?? [];
        for (const path of candidates.slice(0, 12)) item.append(control("Inspect candidate · " + path, () => open({ path })));
        if (candidates.length > 12) item.append(node("p", (candidates.length - 12) + " candidates hidden; inspect the owner's Connections for all candidates."));
        for (const candidate of (edge.projectCandidates ?? []).slice(0, 12)) item.append(node("p", "Other project candidate · " + (typeof candidate === "string" ? candidate : JSON.stringify(candidate)), "technical"));
        if ((edge.projectCandidates?.length ?? 0) > 12) item.append(node("p", "Further other-project candidates hidden; inspect the owner's Connections."));
        list.append(item);
      }
      shown = end; more.hidden = shown >= Math.min(row.edges.length, dependencyLimits.evidence);
      more.textContent = "Show more evidence (" + (row.edges.length - shown) + " hidden)";
      count.textContent = shown + " of " + row.edges.length + " recorded references shown." + (row.edges.length > dependencyLimits.evidence ? " Evidence limit: 60. Inspect owner Connections for the remainder." : "");
    }
    const count = node("p", "", "technical"); evidence.append(count, more, control("Back to dependency trail", () => focus(activeControl)));
    append(); focus(evidence);
  }
  function render(focusId) {
    snapshot = session.snapshot(); outline.replaceChildren(); evidence.hidden = true; active = undefined;
    const branchNodes = new Map([["root", outline]]);
    for (const row of snapshot.rows) {
      const li = node("li", "", "dependency-row"); li.dataset.occurrence = row.id; if (row.assetId) li.dataset.assetId = row.assetId;
      li.dataset.path = row.path ?? ""; li.dataset.owner = row.owner; if (row.tile) li.dataset.tile = row.tile;
      li.append(node("p", "Hop " + row.depth + " · from " + name(row.owner), "technical"));
      const title = node("p"); title.append(node("strong", label(row)), node("span", " · " + (row.path ? artifacts.get(row.path)?.type?.toUpperCase() ?? "File" : row.status)));
      li.append(title, node("p", row.path ?? row.label, "technical"), node("p", evidenceLabel(row.edges[0]), "dependency-reason"));
      if (row.cycle) li.append(node("p", "Cycle · returns to an ancestor; expansion stops here.", "dependency-marker"));
      else if (row.shared) li.append(node("p", "Shared asset · already shown in this investigation. This route keeps its own evidence.", "dependency-marker"));
      const buttons = node("div", "", "task-buttons");
      const inspect = control("Evidence · " + label(row) + " (" + row.edges.length + ")", () => showEvidence(row, inspect));
      inspect.dataset.evidence = row.id; inspect.setAttribute("aria-pressed", "false"); buttons.append(inspect);
      if (row.expandable) {
        const expand = control((row.expanded ? "Collapse · " : "Expand · ") + label(row), () => { session.toggle(row.id); render(row.id); });
        expand.dataset.expand = row.id; expand.setAttribute("aria-expanded", String(row.expanded)); buttons.prepend(expand);
      } else if (row.path && !row.cycle) li.append(node("p", "No outgoing references in the indexed fields.", "technical"));
      li.append(buttons); const list = node("ol"); li.append(list); branchNodes.set(row.id, list);
      branchNodes.get(row.parent).append(li);
    }
    for (const branch of snapshot.branches) {
      const list = branchNodes.get(branch.id);
      if (branch.hidden) {
        const row = node("li", "", "dependency-limit");
        row.append(node("p", branch.shown + " of " + branch.total + " dependency groups shown · " + branch.hidden + " hidden."));
        if (branch.depthLimited) row.append(node("p", "Hop limit reached (6). Open this asset in the inspector to continue its direct Connections."));
        else if (snapshot.rows.length >= dependencyLimits.rows) row.append(node("p", "View limit reached (120). Collapse a branch to free space, or inspect an asset's direct Connections."));
        else { const more = control("Show more dependencies · " + name(branch.path), () => { session.more(branch.id); render(branch.id); }); more.dataset.more = branch.id; row.append(more); }
        list.append(row);
      }
      if (!branch.total) list.append(node("li", "No outgoing references in the indexed fields."));
    }
    summary.textContent = snapshot.rows.length + " visible relationship groups · at most 120 groups / 6 hops. Expand or show more to reveal hidden results; repeated assets retain each route's evidence.";
    if (focusId) { const target = [...outline.querySelectorAll('button')].find(b => b.dataset.expand === focusId || b.dataset.more === focusId); if (target) focus(target); else focus(heading); }
  }
  return {
    get root() { return session?.root; }, clear,
    start(root, graph, assets) { artifacts = assets; session = createDependencyInvestigation(root, graph, assets); rootLabel.textContent = root; container.hidden = false; render(); changed(); focus(heading); },
    reveal() { if (session) focus(heading); },
  };
}
