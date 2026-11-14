import { mainFileBindings } from "./model.mjs";

// Static evidence only: no RPGCode execution, collision or plugin invocation.
const directions = ["South", "North", "East", "West"];
const edgeValue = edge => ({
  evidence: edge?.evidence ?? "", path: edge?.to ?? edge?.path ?? null,
  value: edge?.value ?? "", status: edge?.status ?? (edge?.path ? "Resolved" : "Missing"),
});
const decoded = (artifact, type) => artifact?.type === type && artifact.decodeStatus === "decoded";
const sourceLines = (artifact, patterns, limit = 12) => {
  const found = [];
  for (const [i, row] of (artifact?.program?.rows ?? []).entries()) {
    if (!patterns.some(pattern => pattern.test(row.line))) continue;
    found.push({ path: artifact.path, line: i + 1, text: row.line.trim().slice(0, 200) });
    if (found.length >= limit) break;
  }
  return found;
};

export function assessPlayability(artifacts, graph, mainFile = null, { interactionProgram = null } = {}) {
  const mains = [...artifacts.values()].filter(item =>
    item.type === "gam" && item.decodeStatus === "decoded");
  const main = mainFile ?? (mains.length === 1 ? mains[0] : null);
  const bindings = new Map(main ? mainFileBindings(main, [...artifacts.keys()]) : []);
  const get = label => {
    const binding = bindings.get(label);
    return binding ? { ...edgeValue(binding), evidence: label } :
      { evidence: label, path: null, value: "", status: "Missing" };
  };
  const startup = get("Configured startup");
  const boardRef = get("Opening board");
  const actorRef = get("Initial character");
  const program = artifacts.get(startup.path);
  const board = artifacts.get(boardRef.path);
  const character = artifacts.get(actorRef.path);
  const stages = [];

  stages.push({
    id: "title", label: "Title and New-game selection", source: startup.path,
    status: decoded(program, "prg") ? "source-linked" : "missing",
    references: [startup],
    facts: decoded(program, "prg") ? [
      "Startup RPGCode is indexed; its menu branches are not executed.",
      "Menu input and the transition to the opening board require runtime behavior.",
    ] : ["Configured startup is not decoded RPGCode."],
    sourceLines: sourceLines(program, [
      /case\s+0\s*:/i, /\binitvar\s*\(/i, /\bsetplayer\s*\(/i,
      /\binitcmaps\s*\(/i, /^\s*end\s*\(/i,
    ]), runtimeStatus: "not-tested",
  });

  stages.push({
    id: "board", label: "Opening board and collision vectors", source: boardRef.path,
    status: decoded(board, "brd") ? "source-linked" : "missing",
    references: [boardRef],
    facts: decoded(board, "brd") ? [
      board.width + " × " + board.height + " × " + board.layers +
        " stored grid; coordinate code " + (board.coordinateType ?? "unknown") + ".",
      (board.vectors?.length ?? 0) + " vector records and " +
        (board.sprites?.length ?? board.items?.length ?? 0) + " item/sprite placements.",
      board.start ? "Source player start (" + board.start.x + ", " +
        board.start.y + ", layer " + board.start.layer + ")." :
        "No decoded player start position.",
      "Static board artwork does not establish runtime collision or movement.",
    ] : ["Opening board is unavailable or not decoded."],
    sourceLines: [], runtimeStatus: "not-tested",
  });

  const movement = [];
  if (decoded(character, "tem")) for (const direction of directions) {
    const named = character.walkingAnimations?.find(item => item.direction === direction);
    const edge = (graph.outgoing.get(character.path) ?? []).find(item =>
      item.evidence === "Walk " + direction + " animation");
    const animation = artifacts.get(edge?.to);
    const frames = decoded(animation, "anm") ?
      (graph.outgoing.get(animation.path) ?? [])
        .filter(item => /^Frame \d+ image$/.test(item.evidence))
        .map(item => ({ image: item.value, path: item.to ?? null,
          tile: item.tile ?? null, status: item.status })) : [];
    movement.push({
      direction, value: named?.value ?? "", animation: edge?.to ?? null,
      status: edge?.status ?? "Missing", frameCount: frames.length, frames,
    });
  }
  const movementReady = movement.length === 4 && movement.every(item =>
    item.status === "Resolved" && item.frameCount > 0 &&
    item.frames.every(frame => frame.status === "Resolved"));
  stages.push({
    id: "character", label: "Character and four walking directions",
    source: actorRef.path,
    status: movementReady ? "source-linked" : decoded(character, "tem") ? "partial" : "missing",
    references: [actorRef, ...movement.map(item => ({
      evidence: "Walk " + item.direction + " animation", path: item.animation,
      value: item.value, status: item.status,
    }))],
    facts: [
      decoded(character, "tem") ? "Character: " + character.name + "." : "Initial character is not decoded.",
      movement.filter(item => item.frameCount > 0).length + "/4 cardinal ANMs have stored image frames.",
      "Linked animation frames do not prove keyboard movement or timing fidelity.",
    ],
    sourceLines: [], runtimeStatus: "not-tested",
  });

  const requested = interactionProgram?.toLowerCase() ?? null;
  const chosen = (decoded(board, "brd") ? board.sprites ?? [] : []).find(item =>
    item.activationProgram && (!requested ||
      item.activationProgram.toLowerCase() === requested)) ?? null;
  const edges = graph.outgoing.get(board?.path) ?? [];
  const scriptEdge = chosen && edges.find(edge =>
    edge.evidence === "Native sprite activation program · slot " + chosen.slot);
  const itemEdge = chosen && edges.find(edge =>
    edge.evidence === "Native board sprite · slot " + chosen.slot);
  const script = artifacts.get(scriptEdge?.to), item = artifacts.get(itemEdge?.to);
  const selectedInteraction = chosen ? {
    slot: chosen.slot, filename: chosen.filename, itemPath: itemEdge?.to ?? null,
    activationProgram: chosen.activationProgram, programPath: scriptEdge?.to ?? null,
    position: chosen.position, status: scriptEdge?.status ?? "Missing",
  } : null;
  const interactionReady = selectedInteraction && decoded(script, "prg") &&
    decoded(item, "itm") && scriptEdge?.status === "Resolved";
  stages.push({
    id: "interaction", label: "Placed item and interaction script",
    source: script?.path ?? null,
    status: interactionReady ? "source-linked" : selectedInteraction ? "partial" : "missing",
    references: [
      ...(itemEdge ? [edgeValue(itemEdge)] : []),
      ...(scriptEdge ? [edgeValue(scriptEdge)] : []),
    ],
    facts: selectedInteraction ? [
      "Slot " + chosen.slot + ": " + chosen.filename + " at (" +
        chosen.position.x + ", " + chosen.position.y + ", layer " + chosen.position.layer + ").",
      "Configured activation program: " + chosen.activationProgram + ".",
      "Conditions, dialogue, clue state and plugin calls are not executed.",
    ] : [requested ?
      "No opening-board item activates " + interactionProgram + "." :
      "No opening-board sprite has a configured activation program."],
    sourceLines: sourceLines(script, [
      /#include\s*\(/i, /\bgettickcount\s*\(/i, /\bchecked\s*\[/i,
      /\bsettxt\s*\(/i, /\bclues\s*\+\+/i, /\bupdateclues\s*\(/i,
    ]), runtimeStatus: "not-tested",
  });

  const gaps = [
    { id: "title-control", stage: "title", need: "Translate New-menu input to a deterministic start transition.", acceptance: "New enters the configured board with the selected party." },
    { id: "board-movement", stage: "board", need: "Render actor input and movement with an explicit collision/vector policy.", acceptance: "Directional input moves a synthetic actor without crossing a known solid vector." },
    { id: "movement-fidelity", stage: "character", need: "Connect four heading ANMs with animation timing and frame selection.", acceptance: "Each cardinal input produces its expected animation." },
    { id: "item-activation", stage: "interaction", need: "Detect interaction range, target and stored activation conditions.", acceptance: "The selected item requests its configured script exactly once per activation." },
    { id: "dialogue-state", stage: "interaction", need: "Implement only the necessary RPGCode dialogue/state subset through an explicit adapter.", acceptance: "First and repeat conversations differ and tracked clue state updates as specified." },
    { id: "plugin-scope", stage: "interaction", need: "Audit whether selected behaviors depend on a bundled DLL before writing adapters.", acceptance: "Each needed external call is mapped to a source-owned adapter or deferred." },
  ];
  return {
    mainFile: main?.path ?? main?.filename ?? null,
    interactionProgram: interactionProgram ?? null, selectedInteraction,
    stages, movement,
    summary: {
      sourceLinked: stages.filter(stage => stage.status === "source-linked").length,
      partial: stages.filter(stage => stage.status === "partial").length,
      missing: stages.filter(stage => stage.status === "missing").length,
      runtimeVerified: false,
    },
    gaps,
    limitations: [
      "Source-linked means decoded files and references exist; it never means the game runs.",
      "The selected interaction is a configured candidate, not proven reachable gameplay.",
      "Source excerpts are text evidence; dynamic RPGCode, plugin calls and state changes are not interpreted.",
    ],
  };
}
