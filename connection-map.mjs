export function referenceDestination(edge, incoming, artifacts) {
  const path = incoming ? edge.from : edge.to;
  if (!artifacts.has(path) || (incoming && edge.external)) return;
  return { path, tile: incoming ? undefined : edge.tile, line: incoming ? edge.line : undefined };
}

export function connectionCounts(edges, incoming) {
  const files = new Set();
  let placements = 0;
  let unresolved = 0;
  for (const edge of edges) {
    if (incoming || edge.to) files.add(incoming ? JSON.stringify([!!edge.external, edge.from]) : edge.to);
    else unresolved++;
    placements += edge.tiles ?? 0;
  }
  return { files: files.size, references: edges.length, placements, unresolved };
}

export function connectionNeighbors(edges, incoming) {
  const neighbors = new Map();
  for (const edge of edges) {
    const path = incoming ? edge.from : edge.to;
    const tile = incoming ? undefined : edge.tile;
    const external = incoming && !!edge.external;
    const key = JSON.stringify(path ? [path, tile, external] : [null, edge.value, edge.status]);
    if (!neighbors.has(key)) {
      neighbors.set(key, {
        path, tile, external, label: path ?? edge.value, status: path ? undefined : edge.status, edges: [],
      });
    }
    neighbors.get(key).edges.push(edge);
  }
  return [...neighbors.values()].sort((a, b) => b.edges.length - a.edges.length || a.label.localeCompare(b.label));
}

export function connectionType(path, tile, external, artifacts) {
  if (!path) return "no-target";
  if (tile) return "gph";
  if (external) return "gam";
  return artifacts.get(path)?.type || "file";
}

export function filterConnections(edges, incoming, artifacts, filters) {
  if (filters.direction && filters.direction !== (incoming ? "incoming" : "outgoing")) return [];
  return edges.filter(edge => {
    const type = connectionType(incoming ? edge.from : edge.to, incoming ? undefined : edge.tile,
      incoming && edge.external, artifacts);
    if (filters.type && type !== filters.type) return false;
    if (!filters.resolution) return true;
    if (filters.resolution === "no-target") return !edge.to;
    return filters.resolution === (edge.status?.toLowerCase() ?? (edge.to ? "resolved" : ""));
  });
}

export function connectionFilterOptions(incoming, outgoing, artifacts) {
  const types = new Set();
  const statuses = new Map();
  for (const edge of incoming) types.add(connectionType(edge.from, undefined, edge.external, artifacts));
  for (const edge of outgoing) {
    types.add(connectionType(edge.to, edge.tile, false, artifacts));
    if (!edge.to && edge.status) statuses.set(edge.status.toLowerCase(), edge.status);
  }
  return { types: [...types], statuses };
}
