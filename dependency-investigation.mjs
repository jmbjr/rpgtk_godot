import { connectionNeighbors } from "./connection-map.mjs";
import { artifactId } from "./records.mjs";

export const dependencyLimits = Object.freeze({ rows: 120, depth: 6, batch: 8, evidence: 60, evidenceBatch: 12 });

// A view over the shared outgoing edges, not a dependency resolver or runtime
// reachability analysis. Each occurrence retains its exact original edges.
export function createDependencyInvestigation(root, graph, artifacts) {
  if (artifacts.get(root)?.type !== "brd") throw new Error("Choose an imported board first.");
  const groups = new Map(), expanded = new Set(["root"]), pages = new Map();
  const children = path => {
    if (!groups.has(path)) groups.set(path, connectionNeighbors(
      (graph.outgoing.get(path) ?? []).filter(edge => !edge.external), false));
    return groups.get(path);
  };
  let latest;
  function snapshot() {
    const seen = new Map([[root, "root"]]), rows = [], branches = [];
    function visit(id, path, ancestors, depth) {
      const all = children(path), wanted = pages.get(id) ?? dependencyLimits.batch;
      const branch = { id, path, total: all.length, shown: 0, hidden: all.length, depthLimited: depth >= dependencyLimits.depth };
      branches.push(branch);
      if (branch.depthLimited) return;
      for (let i = 0; i < Math.min(all.length, wanted) && rows.length < dependencyLimits.rows; i++) {
        const group = all[i], key = id + "/" + i, target = group.path;
        const cycle = Boolean(target && ancestors.includes(target));
        const first = target && seen.get(target);
        const row = { ...group, id: key, parent: id, owner: path, depth: depth + 1,
          assetId: target ? artifactId(target) : undefined, cycle, shared: Boolean(first && !cycle), first,
          trail: [...ancestors], expandable: Boolean(target && artifacts.has(target) && !cycle && children(target).length),
          expanded: expanded.has(key) };
        rows.push(row); branch.shown++;
        if (target && !first) seen.set(target, key);
        if (row.expanded && row.expandable) visit(key, target, [...ancestors, target], depth + 1);
      }
      branch.hidden = all.length - branch.shown;
    }
    visit("root", root, [root], 0);
    latest = { root, rows, branches, rowLimit: dependencyLimits.rows, depthLimit: dependencyLimits.depth };
    return latest;
  }
  return {
    root, snapshot,
    toggle(id) {
      const row = (latest ?? snapshot()).rows.find(row => row.id === id);
      if (!row?.expandable) return;
      if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    },
    more(id) {
      if (!(latest ?? snapshot()).branches.some(branch => branch.id === id && !branch.depthLimited)) return;
      pages.set(id, (pages.get(id) ?? dependencyLimits.batch) + dependencyLimits.batch);
    },
  };
}
