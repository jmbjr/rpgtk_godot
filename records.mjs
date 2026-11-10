const partialFormats = new Set(["gam", "prg", "tem", "brd", "gif", "jpg", "jpeg", "wav", "mid", "doc", "___"]);

export function artifactId(path, mainFile = false) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${mainFile ? "rpgtk-main" : "rpgtk"}:/${encoded}`;
}

function edgeRecord(edge) {
  const { value, evidence, line, status, to, from, external, tile, tiles, position } = edge;
  return {
    value,
    evidence,
    ...(line === undefined ? {} : { line }),
    status: (status ?? "resolved").toLowerCase().replaceAll(" ", "-"),
    ...(from ? { source: { $ref: artifactId(from, external) } } : {}),
    ...(to ? {
      target: {
        $ref: artifactId(to) + (tile === undefined ? "" : `#/data/tiles/${tile - 1}`),
        ...(tile === undefined ? {} : { tileIndex: tile }),
      },
    } : {}),
    ...(position ? { position } : {}),
    ...(tiles === undefined ? {} : { placements: tiles }),
  };
}

function tilesetData(bytes, count) {
  const tileSize = 3072;
  return {
    width: 32,
    height: 32,
    count,
    encoding: "base64 RGB24, column-major",
    transparentRgb: [0, 1, 2],
    tiles: Array.from({ length: count }, (_, i) => {
      const offset = 6 + i * tileSize;
      return { number: i + 1, rgb: btoa(String.fromCharCode(...bytes.subarray(offset, offset + tileSize))) };
    }),
  };
}

export function artifactRecord(artifact, graph, { external = false, bindings = [] } = {}) {
  const { path, type, decodeStatus, error, refs, bytes, ...data } = artifact;
  const incoming = external ? [] : (graph.incoming.get(path) ?? []);
  const outgoing = external ? bindings.map(([evidence, binding]) => ({
    evidence, value: binding.value, status: binding.status, to: binding.path, from: path, external: true,
  })) : (graph.outgoing.get(path) ?? []).filter(edge => !edge.external);

  let decoded = data;
  if (bytes && type === "tst") decoded = { byteLength: data.byteLength, ...tilesetData(bytes, data.count) };
  const program = type === "prg" ? data.program : undefined;
  if (program) decoded = {
    byteLength: data.byteLength,
    lines: program.rows.map(row => row.line),
    symbols: [...program.groups.values()],
    builtInCalls: program.count,
  };
  if (type === "brd" && data.runs) {
    const { lookup, runs, ...metadata } = data;
    const byIndex = new Map(outgoing.filter(edge => edge.index !== undefined).map(edge => [edge.index, edgeRecord(edge)]));
    decoded = {
      ...metadata,
      tileLookup: lookup.map((value, index) => ({
        value,
        ...(byIndex.has(index) ? { reference: byIndex.get(index) } : {}),
      })),
      cellOrder: "zero-based offset; layer, row, column",
      runs: runs.map(({ index, ...run }) => ({ ...run, lookupIndex: index })),
    };
  }
  return {
    schemaVersion: 1,
    $id: artifactId(path, external),
    path,
    format: type || "unknown",
    decode: {
      status: decodeStatus === "decoded" && partialFormats.has(type) ? "partial" : decodeStatus,
      ...(error ? { message: error } : {}),
    },
    data: decoded,
    references: { outgoing: outgoing.map(edgeRecord), incoming: incoming.map(edgeRecord) },
  };
}
