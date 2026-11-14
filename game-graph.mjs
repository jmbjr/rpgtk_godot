import { buildReferences } from "./artifacts.mjs";
import { mainFileBindings } from "./model.mjs";
import { traceProjectDependencies } from "./script-trace.mjs";
import { artifactId, artifactRecord } from "./records.mjs";

export const rpgcodeRoles = [
  { id: "game-developer", name: "Game Developer", relation: "authors", description: "RPGCode program" },
  { id: "translator", name: "Translator / Trans2", relation: "interprets", description: "RPGCode commands" },
];

const ref = id => ({ $ref: id });
const entityId = (kind, key) => `rpgtk-${kind}:/${encodeURIComponent(key)}`;
const mainRelations = {
  "Configured startup": "startup-program",
  "Opening board": "opening-board",
  "Initial character": "initial-character",
};
const limits = [
  "Records cover indexed Toolkit fields. Raw archive files and media payloads are not embedded.",
  "Reference resolution uses archive names and indexed fields. Unresolved edges retain their source evidence.",
  "RPGCode indexing is static and partial. Execution order, runtime state, and reachability are unknown.",
];

function referenceType(record, edge) {
  if (record.format === "gam") {
    if (mainRelations[edge.evidence]) return mainRelations[edge.evidence];
    if (edge.evidence.startsWith("Declared plugin") ||
        edge.evidence.endsWith(" system plugin")) return "plugin-declaration";
    return "project-asset";
  }
  if (record.format === "prg") return "script-file";
  if (record.format === "brd") {
    if (edge.placements !== undefined) return "board-tile";
    if (edge.evidence.startsWith("Board program ")) return "board-program";
  }
  return "asset-reference";
}

export function connectedGameRecord(artifacts, catalog, { archiveName, externalMain } = {}) {
  const paths = [...artifacts.keys()].sort();
  const mains = paths.filter(path => artifacts.get(path).type === "gam" && artifacts.get(path).decodeStatus === "decoded");
  const bindings = externalMain && mainFileBindings(externalMain, paths);
  const mainBindings = mains.map(path => ({
    name: path, bindings: mainFileBindings(artifacts.get(path), paths), external: false,
  }));
  if (externalMain) mainBindings.push({ name: externalMain.filename, bindings, external: true });
  const graph = buildReferences(artifacts, mainBindings);
  const records = paths.map(path => artifactRecord(artifacts.get(path), graph));
  if (externalMain) {
    const { filename, ...data } = externalMain;
    records.push(artifactRecord({ ...data, path: filename, type: "gam", decodeStatus: "decoded" },
      graph, { external: true, bindings }));
  }
  const root = externalMain ? { status: "configured", origin: "external", mainFile: ref(artifactId(externalMain.filename, true)) } :
    mains.length === 1 ? { status: "configured", origin: "archive", mainFile: ref(artifactId(mains[0])) } :
    mains.length > 1 ? { status: "ambiguous", candidates: mains.map(path => ref(artifactId(path))) } : { status: "missing" };

  const actors = {};
  const commands = {};
  const capabilities = {};
  const edges = [];
  const add = (type, source, target, evidence) =>
    edges.push({ type, source: ref(source), target: ref(target), status: "resolved", evidence });
  const [author, translator] = rpgcodeRoles.map(role => entityId("actor", role.id));
  const decodeCounts = {};
  for (const record of records) {
    const id = record.$id;
    const status = record.decode.status;
    decodeCounts[status] = (decodeCounts[status] ?? 0) + 1;
    for (const edge of record.references.outgoing) {
      edges.push({ ...edge, type: referenceType(record, edge) });
    }
    if (["tem", "ene"].includes(record.format) && status !== "error") {
      const actorId = entityId("actor", record.path);
      const kind = record.format === "tem" ? "character" : "enemy";
      actors[actorId] = { $id: actorId, kind, name: record.data.name || record.path };
      add("defined-by", actorId, id, "Decoded Toolkit actor definition");
    }
    if (record.format !== "prg" || !record.data.symbols) continue;
    if (!Object.hasOwn(actors, author)) {
      for (const role of rpgcodeRoles) {
        const roleId = entityId("actor", role.id);
        actors[roleId] = { $id: roleId, kind: "toolkit-role", name: role.name };
      }
    }
    add("authors", author, id, "Viewer authoring role");
    for (const symbol of record.data.symbols) {
      if (symbol.kind !== "builtin") continue;
      const commandId = entityId("command", symbol.name);
      const { feature, featureTitle, ...entry } = catalog[symbol.name];
      if (!Object.hasOwn(commands, commandId)) {
        commands[commandId] = { $id: commandId, ...entry };
        add("interprets", translator, commandId, "Viewer translator role");
        const capabilityId = entityId("capability", feature);
        capabilities[capabilityId] = { $id: capabilityId, code: feature, name: featureTitle };
        add("implements-capability", commandId, capabilityId, "Toolkit command catalog");
      }
      for (const line of symbol.lines) {
        edges.push({ type: "invokes", source: ref(id), target: ref(commandId), status: "resolved",
          evidence: symbol.value, line });
      }
    }
  }
  const referenceCounts = {};
  for (const { status } of edges) referenceCounts[status] = (referenceCounts[status] ?? 0) + 1;

  return {
    format: "rpgtk-connected-game",
    schemaVersion: 1,
    archive: { name: archiveName, fileCount: artifacts.size },
    root,
    artifacts: Object.fromEntries(records.map(record => [record.$id, record])),
    actors, commands, capabilities, edges,
    scriptTrace: traceProjectDependencies(artifacts, graph,
      externalMain ?? (mains.length === 1 ? artifacts.get(mains[0]) : null)),
    coverage: { decodeCounts, referenceCounts, limitations: limits },
  };
}
