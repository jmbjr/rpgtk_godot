import { mainFileBindings } from "./model.mjs";

// Source references, not execution semantics: #Include and #Run are distinct
// observed directives. Do not interpret conditional branches or variable values.
const importDirective = /^#(include|run)$/i;
const isProgram = (artifacts, path) => path && artifacts.get(path)?.type === "prg";

export function traceProgramDependencies(artifacts, graph, entry, maxPrograms = 500) {
  const steps = [];
  const links = [];
  const gaps = [];
  if (!isProgram(artifacts, entry)) {
    return { entry: entry ?? null, steps, links, gaps, truncated: false };
  }
  const queue = [{ path: entry, from: null, line: null, directive: "Entry", depth: 0 }];
  const visited = new Set([entry]);
  let truncated = false;
  for (let i = 0; i < queue.length; i++) {
    const step = queue[i];
    steps.push(step);
    for (const edge of graph.outgoing.get(step.path) ?? []) {
      if (!importDirective.test(edge.evidence)) continue;
      // A reference remains evidence even when its name is dynamic,
      // ambiguous, missing, external, or points to a non-PRG artifact.
      const linked = {
        from: step.path, value: edge.value, directive: edge.evidence,
        line: edge.line ?? null, to: isProgram(artifacts, edge.to) ? edge.to : null,
        status: edge.status, depth: step.depth + 1,
      };
      links.push(linked);
      if (!linked.to || edge.status !== "Resolved") {
        gaps.push(linked);
        continue;
      }
      if (visited.has(linked.to)) continue; // Shared includes and cycles.
      if (visited.size >= maxPrograms) {
        truncated = true;
        continue;
      }
      visited.add(linked.to);
      queue.push({ path: linked.to, from: step.path, line: edge.line ?? null,
        directive: edge.evidence, depth: step.depth + 1 });
    }
  }
  return { entry, steps, links, gaps, truncated };
}

export function traceProjectDependencies(artifacts, graph, mainFile) {
  const entrypoints = [];
  const paths = [...artifacts.keys()];
  const chosen = mainFile ?? (() => {
    const files = [...artifacts.values()].filter(
      item => item.type === "gam" && item.decodeStatus === "decoded");
    return files.length === 1 ? files[0] : null;
  })();
  const seen = new Set();
  const add = (label, from, edge, sourceLine = null) => {
    const path = isProgram(artifacts, edge?.to ?? edge?.path) ? (edge?.to ?? edge?.path) : null;
    const rawStatus = edge?.status ?? (path ? "Resolved" : "Missing");
    const status = rawStatus[0].toUpperCase() + rawStatus.slice(1);
    const key = JSON.stringify([label, from, path, edge?.value, sourceLine]);
    if (seen.has(key)) return;
    seen.add(key);
    const trace = traceProgramDependencies(artifacts, graph, path);
    entrypoints.push({
      label, from: from ?? null, path, value: edge?.value ?? "",
      status, sourceLine: sourceLine ?? edge?.line ?? null,
      trace,
    });
  };
  let boardPath = null;
  if (chosen) {
    const bindings = mainFileBindings(chosen, paths);
    for (const [label, binding] of bindings) {
      if (label === "Opening board") boardPath = binding.path ?? null;
      if (label === "Configured startup" || label === "Runtime program" ||
          label.startsWith("Runtime key · ") || label === "Fight program" ||
          label === "Game-over program") {
        add(label, chosen.path ?? chosen.filename ?? null, binding);
      }
    }
  }
  const board = artifacts.get(boardPath);
  if (board?.type === "brd") {
    const edges = graph.outgoing.get(boardPath) ?? [];
    for (const edge of edges) {
      if (/^(?:Native board program · slot |Native sprite activation program · slot |Native sprite multitask program · slot |Board entry program$|Board program \()/i.test(edge.evidence)) {
        add(edge.evidence, boardPath, edge);
      }
    }
    // ITM pickup/on-board programs are configured from placements but are
    // NOT established as triggered or reachable during gameplay.
    for (const spriteEdge of edges.filter(edge => /^Native board sprite · slot /i.test(edge.evidence))) {
      if (artifacts.get(spriteEdge.to)?.type !== "itm") continue;
      for (const itemEdge of graph.outgoing.get(spriteEdge.to) ?? []) {
        if (!["Pickup program", "On-board program"].includes(itemEdge.evidence)) continue;
        add(spriteEdge.evidence + " → " + itemEdge.evidence, spriteEdge.to, itemEdge);
      }
    }
  }
  const all = new Set();
  let links = 0, unresolved = 0, dynamic = 0;
  for (const { trace, status } of entrypoints) {
    for (const step of trace.steps) all.add(step.path);
    links += trace.links.length;
    unresolved += trace.gaps.length + Number(status !== "Resolved");
    dynamic += trace.gaps.filter(gap => gap.status === "Dynamic").length;
  }
  return {
    mainFile: chosen?.path ?? chosen?.filename ?? null,
    openingBoard: boardPath,
    entries: entrypoints,
    summary: {
      entryCount: entrypoints.length, uniqueScripts: all.size,
      observedImports: links, unresolved, dynamic,
    },
    limitations: [
      "These are configured script entrypoints, not proven runtime reachability.",
      "Only literal #Include/#Run references are traversed; dynamic targets are preserved as gaps.",
      "Conditional branches, runtime state, plugin calls and side effects are not executed.",
    ],
  };
}
