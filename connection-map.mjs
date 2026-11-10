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
