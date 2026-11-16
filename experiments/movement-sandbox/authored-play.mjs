import { tilePixels } from "../../artifacts.mjs";
import { tileBitmapSprite } from "../../sprites.mjs";
import { spriteDrawOrder, spritePixelOrigin } from "../../placed-sprites.mjs";
import { keyFrameColor } from "../../sprites.mjs";
import { initialMovementState, stepMovement } from "./engine.mjs";
import { initialInnState, advanceInn, currentInnMessage, conversationMessages }
  from "./inn-dialogue.mjs";
import { nearAuthoredInn, activateAuthoredInn } from "./imported-inn.mjs";
import { initialTk3ScriptState, selectTk3ScriptTarget, startPlacedTk3Script,
  advanceTk3Script } from "../../tk3-script-slice.mjs";
import { resolveTk3BoardTransfer } from "../../tk3-board-transfer.mjs";
import { readLegacyDialogueDefinitions, compileLegacyDialogue,
  initialLegacyDialogueState, openLegacyDialogue, advanceLegacyDialogue,
  currentLegacyDialogue } from "../../tk3-source-dialogue.mjs";
import { listTk3RuntimeKeys, startTk3RuntimeKey } from "../../tk3-runtime-keys.mjs";
import { compileTk3SourceMenu, openTk3SourceMenu, selectTk3SourceMenu,
  confirmTk3MenuProfile, cancelTk3SourceMenu } from "../../tk3-source-menu.mjs";
import { describePlayableTargets } from "./playtest-guidance.mjs";

// Reuse the sandbox movement engine and keyboard/touch input. Only the
// explicit source-verified RPGCode subset or existing inn adapter may run;
// unsupported PRG commands and plugin code are never executed.
const keyDirections = new Map([
  ["ArrowUp", "north"], ["KeyW", "north"],
  ["ArrowDown", "south"], ["KeyS", "south"],
  ["ArrowLeft", "west"], ["KeyA", "west"],
  ["ArrowRight", "east"], ["KeyD", "east"],
]);
const axes = {
  north: { x: 0, y: -1 }, south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }, east: { x: 1, y: 0 },
};

function pixelCanvas(pixels, width = 32, height = 32) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("A 2D canvas is required to render the original game tiles.");
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

export function mountAuthoredBoard(section, scene, artifacts, graph, options = {}) {
  if (!scene.ok) throw Error("Cannot mount an unresolved playable scene.");
  section.querySelector("#play-heading").textContent =
    "Authored board · " + scene.boardPath;
  const canvas = section.querySelector("#play-canvas");
  const status = section.querySelector("#play-status");
  const collisionLabel = section.querySelector("#play-collision");
  const vectorOverlay = section.querySelector("#play-vector-overlay");
  const markerToggle = section.querySelector("#play-markers-enabled");
  const markerLayer = section.querySelector("#play-map-markers");
  const mapFrame = section.querySelector("#play-map-frame");
  const targetHint = section.querySelector("#play-target-hint");
  // Source-owned 3×2 test boards should not be magnified to desktop width.
  mapFrame.classList.toggle("play-map-frame--compact",
    scene.board.width <= 5 && scene.board.height <= 5);
  const collision = scene.world.vectorCollision;
  const solidCount = collision?.solids?.length ?? 0;
  const ignoredCount = collision?.ignored?.length ?? 0;
  const unsupportedCount = collision?.unsupported?.length ?? 0;
  collisionLabel.textContent = "Collision: " + (collision?.status ?? "bounds-only") +
    " · " + solidCount + " supported solid vector(s), " +
    ignoredCount + " nonblocking/other-layer, " +
    unsupportedCount + " unsupported · " +
    (collision?.reason ?? "No supported source geometry.") +
    " Browser 9px circle + axis sliding; Toolkit uses an authored base polygon.";
  const hud = section.querySelector("#play-hud");
  const feedback = section.querySelector("#play-feedback");
  const dialoguePanel = section.querySelector("#play-dialogue");
  const dialogueSpeaker = section.querySelector("#play-dialogue-speaker");
  const dialogueText = section.querySelector("#play-dialogue-text");
  const dialogueProgress = section.querySelector("#play-dialogue-progress");
  const talkButton = section.querySelector("#play-talk");
  const runtimeButtons = section.querySelector("#play-runtime-actions");
  const menuPanel = section.querySelector("#play-source-menu");
  const menuActions = section.querySelector("#play-source-menu-actions");
  const menuProfiles = section.querySelector("#play-source-menu-profiles");
  const menuNote = section.querySelector("#play-source-menu-note");
  const menuClose = section.querySelector("#play-source-menu-close");
  const scriptVariables = section.querySelector("#play-script-variables");
  const scriptDiagnostic = section.querySelector("#play-script-diagnostic");
  const pad = [...section.querySelectorAll("[data-move]")];
  const ctx = canvas?.getContext("2d", { alpha: false });
  if (!ctx) throw Error("The browser cannot create a 2D canvas.");
  canvas.width = scene.board.width * 32;
  canvas.height = scene.board.height * 32;
  // Tiny synthetic boards have different aspect ratios from BSTW 20×15.
  canvas.style.aspectRatio = scene.board.width + " / " + scene.board.height;
  ctx.imageSmoothingEnabled = false;

  const cache = new Map();
  const imageFor = (tile, shade = [0, 0, 0], keyColor = null) => {
    const key = [tile.path, tile.tile, ...shade, keyColor].join(":");
    if (!cache.has(key)) {
      const asset = artifacts.get(tile.path);
      if (!asset?.bytes) throw Error("A referenced tileset became unavailable: " + tile.path);
      const rgba = tilePixels(asset, tile.tile);
      if (!rgba) throw Error("A referenced tile is unavailable: " + key);
      if (shade.some(Boolean)) {
        for (let pixel = 0; pixel < rgba.length; pixel += 4) {
          if (!rgba[pixel + 3]) continue;
          for (let channel = 0; channel < 3; channel++) rgba[pixel + channel] += shade[channel];
        }
      }
      if (keyColor !== null && keyColor >= 0) keyFrameColor(rgba, keyColor);
      cache.set(key, pixelCanvas(rgba));
    }
    return cache.get(key);
  };

  const layerCanvases = Array.from({ length: scene.board.layers }, () => {
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    return layer;
  });
  const area = scene.board.width * scene.board.height;
  for (const run of scene.board.runs) {
    const shade = run.shade.map((value, i) => value + scene.board.ambient[i]);
    const image = imageFor(run.tile, shade);
    for (let offset = run.offset; offset < run.offset + run.length; offset++) {
      const layer = Math.floor(offset / area);
      const cell = offset % area;
      const x = cell % scene.board.width;
      const y = Math.floor(cell / scene.board.width);
      layerCanvases[layer].getContext("2d").drawImage(image, x * 32, y * 32);
    }
  }

  // Predecode the four cardinal walking animations. Keep original ANM
  // timing and per-frame transparency keys; all art stays in memory.
  const animations = Object.fromEntries(Object.entries(scene.walking).map(([dir, data]) =>
    [dir, { pauseMs: data.pauseSeconds * 1000,
      frames: data.frames.map(frame => imageFor(frame, [0, 0, 0], frame.transparentColor)) }]));

  const placedImages = new Map();
  const artFailures = new Map();
  const placed = scene.placements ?? [];
  for (const placement of placed) {
    if (!placement.artwork) continue;
    try {
      const frame = placement.artwork;
      if (frame.kind === "tst") {
        placedImages.set(placement.slot, imageFor(frame, [0, 0, 0], frame.transparentColor));
      } else if (frame.kind === "tbm") {
        const sprite = tileBitmapSprite(artifacts.get(frame.path), artifacts, graph);
        if (!sprite || !sprite.parts.length || sprite.width !== frame.width ||
            sprite.height !== frame.height) throw Error("Unsupported bitmap composition");
        const rgba = sprite.pixels;
        if (frame.transparentColor !== null && frame.transparentColor >= 0)
          keyFrameColor(rgba, frame.transparentColor);
        placedImages.set(placement.slot, pixelCanvas(rgba, sprite.width, sprite.height));
      } else throw Error("Unsupported artwork kind");
    } catch (error) {
      artFailures.set(placement.slot, error.message);
    }
  }
  const diagnostic = section.querySelector("#play-placements");
  diagnostic.replaceChildren();
  for (const placement of placed) {
    const row = document.createElement("li");
    const pos = placement.position;
    const frameState = artFailures.has(placement.slot) ?
      "render failed (" + artFailures.get(placement.slot) + ")" :
      placement.artStatus + (placement.artReason ? " (" + placement.artReason + ")" : "");
    row.textContent = "Slot " + placement.slot + " · " + placement.filename +
      " · (" + pos.x + ", " + pos.y + ", layer " + pos.layer + ")" +
      " · ITM: " + placement.itemStatus + " · artwork: " + frameState +
      (placement.artSource ? " via " + placement.artSource : "") +
      (placement.itemPath ? " · ITM " + placement.itemPath : "") +
      (placement.animationPath ? " · ANM " + placement.animationPath : "") +
      (placement.artwork ? " · image " + placement.artwork.path : "") +
      (placement.isInnDoor ? " · INN DOOR (mwininn.prg)" : "");
    if (placement.isInnDoor) row.classList.add("play-inn-entry");
    diagnostic.append(row);
  }
  const innLabel = section.querySelector("#play-inn");
  if (scene.innDoor) {
    const p = scene.innDoor;
    innLabel.textContent = "Inn door: slot " + p.slot + " at (" +
      p.position.x + ", " + p.position.y + ", layer " +
      p.position.layer + ") · " + p.programPath +
      " · Talk within 46 px on the same layer.";
  } else {
    innLabel.textContent = "Inn door: " +
      (scene.innStatus === "ambiguous" ? "multiple resolved candidates" :
        "no resolved mwininn.prg placement") +
      "; the BSTW inn adapter is unavailable, but other source PRGs may be talkable.";
  }

  let actor = initialMovementState(scene.world);
  // A fresh mount always starts with a fresh, in-memory inn conversation.
  let inn = options.innState ?? initialInnState();
  let scriptSession = options.scriptSession ?? initialTk3ScriptState();
  // Compile only fully supported source programs; never guess from names.
  const dialogueDefinitions = readLegacyDialogueDefinitions(artifacts, scene);
  const sourcePlans = new Map();
  if (dialogueDefinitions.supported) for (const placement of placed) {
    if (placement.programStatus !== "resolved" || !placement.programPath) continue;
    const plan = compileLegacyDialogue(
      artifacts.get(placement.programPath), artifacts, dialogueDefinitions, scene);
    if (plan.ok) sourcePlans.set(placement.programPath, plan);
  }
  let legacy = options.legacyState ??
    (sourcePlans.size ? initialLegacyDialogueState(dialogueDefinitions,
      scriptSession.variables) : null);
  if (legacy) scriptSession = { ...scriptSession,
    variables: { ...scriptSession.variables, ...legacy.variables } };
  const runtimeActions = listTk3RuntimeKeys(scene, artifacts);
  const sourceMenuPlans = new Map(runtimeActions.map(action =>
    [action.path, compileTk3SourceMenu(artifacts, scene, action, dialogueDefinitions)])
    .filter(([, plan]) => plan !== null));
  let activeMenuPlan = null;
  if (!legacy && [...sourceMenuPlans.values()].some(plan => plan.ok)) {
    legacy = initialLegacyDialogueState(dialogueDefinitions, scriptSession.variables);
    scriptSession = { ...scriptSession,
      variables: { ...scriptSession.variables, ...legacy.variables } };
  }
  runtimeButtons.replaceChildren();
  const runtimeControls = runtimeActions.map(action => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "play-runtime-button";
    button.textContent = (action.label || "Source key " + action.key) +
      " · " + action.program;
    button.title = action.status === "resolved" ?
      "Run the configured archive RPGCode program" :
      "Unresolved source program; activate to see the diagnostic";
    runtimeButtons.append(button);
    return { action, button };
  });
  let interactionFeedback = options.arrivalFeedback ?? "";
  let lastMenuUiSignature = null;
  const actorAtLayer = () => ({ ...actor, layer: scene.start.layer });

  // Separate DOM labels remain a readable size even when a tiny source
  // canvas is pixel-scaled 5–10×. They do not touch art or interaction.
  const makeMarker = (kind, label) => {
    const marker = document.createElement("div");
    marker.className = "play-map-marker play-map-marker--" + kind;
    const caption = document.createElement("span");
    caption.className = "play-map-marker__label";
    caption.textContent = label;
    marker.append(caption);
    markerLayer.append(marker);
    return marker;
  };
  const locateMarker = (element, item) => {
    element.style.left = item.xPct + "%";
    element.style.top = item.yPct + "%";
    element.classList.toggle("label-left", item.labelLeft);
    element.classList.toggle("label-above", item.labelAbove);
  };
  const initialGuidance = describePlayableTargets(scene, actorAtLayer());
  markerLayer.replaceChildren();
  const playerMarker = makeMarker("player", initialGuidance.player.label);
  const targetMarkers = new Map(initialGuidance.targets.map(target =>
    [target.slot, makeMarker("target", target.label + " · TALK")]));
  const updatePlaytestMarkers = () => {
    const guide = describePlayableTargets(scene, actorAtLayer());
    locateMarker(playerMarker, guide.player);
    for (const target of guide.targets) {
      const marker = targetMarkers.get(target.slot);
      if (!marker) continue;
      locateMarker(marker, target);
      marker.classList.toggle("is-near", target.inRange);
    }
    const talking = Boolean(inn.conversation || legacy?.dialogue ||
      scriptSession.execution?.waiting);
    const instruction = talking ?
      "Conversation active: use Next / Finish, E or Space." : guide.hint;
    if (targetHint.textContent !== instruction) targetHint.textContent = instruction;
    markerLayer.hidden = !markerToggle.checked;
  };
  let walkMs = 0;
  let priorFacing = actor.facing;
  let lastFrame = null;
  let requestId = null;
  const keyboardHeld = new Set();
  const pointerHeld = new Map();
  const listeners = new AbortController();

  const input = () => {
    const held = new Set([...keyboardHeld].map(key => keyDirections.get(key))
      .concat([...pointerHeld.values()]));
    return {
      x: Number(held.has("east")) - Number(held.has("west")),
      y: Number(held.has("south")) - Number(held.has("north")),
    };
  };
  const clearHeld = () => {
    keyboardHeld.clear();
    pointerHeld.clear();
    for (const button of pad) button.classList.remove("held");
    lastFrame = null;
  };
  const syncMenuState = result => {
    legacy = result.state;
    scriptSession = { ...scriptSession,
      variables: { ...scriptSession.variables, ...legacy.variables } };
    interactionFeedback = result.status === "clue" ?
      "Source menu clue recorded. " +
      Math.max(0, legacy.variables.maxclues - legacy.variables.clues) +
      " remaining." : result.status === "repeat" ?
      "Already visited: no second clue." : "";
    clearHeld();
    updateStatus();
    draw();
  };
  function chooseMenuAction(index) {
    if (!activeMenuPlan || !legacy?.menu) return;
    syncMenuState(selectTk3SourceMenu(legacy, activeMenuPlan, index));
  }
  function chooseMenuProfile(index) {
    if (!activeMenuPlan || !legacy?.menu) return;
    syncMenuState(confirmTk3MenuProfile(legacy, activeMenuPlan, index));
  }
  function closeSourceMenu() {
    if (!legacy?.menu) return;
    syncMenuState(cancelTk3SourceMenu(legacy));
    if (!legacy.menu) activeMenuPlan = null;
  }
  const renderSourceMenu = () => {
    const open = Boolean(legacy?.menu && activeMenuPlan);
    menuPanel.hidden = !open;
    if (!open) { lastMenuUiSignature = null; return; }
    const mode = legacy.menu.phase;
    const uiSignature = JSON.stringify([mode, legacy.menu.selectedIndex,
      legacy.menu.message, legacy.variables.checked]);
    if (uiSignature === lastMenuUiSignature) return;
    lastMenuUiSignature = uiSignature;
    const current = activeMenuPlan.choices.find(c =>
      c.index === legacy.menu.selectedIndex);
    menuNote.textContent = legacy.menu.message ||
      (mode === "profile" ?
        "Choose a source-defined party member for " + current?.label +
        ". Cancel will not consume a clue." :
        "Choose a source menu option. First visits yield one clue.");
    menuClose.textContent = mode === "profile" ?
      "Back to menu" : "Close menu";
    menuActions.hidden = mode !== "choices";
    menuProfiles.hidden = mode !== "profile";
    menuActions.replaceChildren();
    menuProfiles.replaceChildren();
    if (mode === "choices") for (const item of activeMenuPlan.choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "play-source-choice";
      button.textContent = item.label +
        (legacy.variables.checked?.[item.eventIndex] ?
          " · already visited" : " · clue available") +
        (item.needsProfile ? " · choose player" : "");
      button.addEventListener("click", () => chooseMenuAction(item.index),
        { signal: listeners.signal });
      menuActions.append(button);
    }
    if (mode === "profile") for (const member of activeMenuPlan.profiles) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "play-source-choice";
      button.textContent = member.name;
      button.addEventListener("click", () => chooseMenuProfile(member.index),
        { signal: listeners.signal });
      menuProfiles.append(button);
    }
  };
  const draw = () => {
    const bg = scene.board.background;
    ctx.fillStyle = Number.isInteger(bg) && bg >= 0 ?
      "rgb(" + (bg & 255) + ", " + ((bg >>> 8) & 255) + ", " + ((bg >>> 16) & 255) + ")" : "#231f25";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let layer = 1; layer <= scene.board.layers; layer++) {
      ctx.drawImage(layerCanvases[layer - 1], 0, 0);
      // Native board renders a layer's tiles and then its sprites;
      // approximate same-layer collision-base Z ordering by stored Y/X.
      const actors = spriteDrawOrder(placed,
        { x: actor.x, y: actor.y, layer: scene.start.layer }, layer);
      for (const entry of actors) {
        if (entry.kind === "player") {
          const animation = animations[actor.facing];
          const frame = actor.moving ?
            Math.floor(walkMs / animation.pauseMs) % animation.frames.length : 0;
          const origin = spritePixelOrigin(actor, 32, 32);
          ctx.drawImage(animation.frames[frame], origin.x, origin.y);
          continue;
        }
        const image = placedImages.get(entry.slot);
        const placement = entry.placement;
        if (image) {
          const origin = spritePixelOrigin(placement.position, image.width, image.height);
          ctx.drawImage(image, origin.x, origin.y);
        } else {
          // Missing ITM or image should never silently remove a location.
          ctx.save();
          ctx.strokeStyle = "#edb86a";
          ctx.lineWidth = 2;
          ctx.strokeRect(entry.x - 6, entry.y - 6, 12, 12);
          ctx.restore();
        }
      }
    }
    // Readable HTML markers now display source-resolved object locations;
    // tiny boards no longer magnify a 10px canvas label into giant text.
    // Inn locator is diagnostic only; draw above all board layers so a
    // door under roofs stays discoverable even when its artwork is missing.
    if (scene.innDoor && !markerToggle.checked) {
      const p = scene.innDoor.position;
      const near = nearAuthoredInn(actorAtLayer(), scene);
      ctx.save();
      ctx.strokeStyle = near || inn.conversation ? "#fff4a5" : "#ffe17c";
      ctx.fillStyle = "#241a12";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "bold 12px monospace";
      const labelX = Math.min(Math.max(2, p.x + 13), canvas.width - 71);
      const labelY = Math.min(Math.max(15, p.y - 8), canvas.height - 5);
      ctx.fillRect(labelX - 2, labelY - 12, 70, 15);
      ctx.fillStyle = "#ffe17c";
      ctx.fillText("INN DOOR", labelX, labelY);
      ctx.restore();
    }
    // A diagnostic overlay makes the verified walls easy to check on
    // Android. It never changes game collision, character or dialogue.
    if (vectorOverlay.checked && collision?.solids?.length) {
      ctx.save();
      ctx.strokeStyle = "#ff664d";
      ctx.fillStyle = "rgba(255, 102, 77, 0.12)";
      ctx.lineWidth = 2;
      for (const solid of collision.solids) {
        ctx.beginPath();
        ctx.moveTo(solid.points[0].x, solid.points[0].y);
        for (const point of solid.points.slice(1)) ctx.lineTo(point.x, point.y);
        if (solid.closed) {
          ctx.closePath();
          ctx.fill();
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  };
  const updateStatus = () => {
    updatePlaytestMarkers();
    status.textContent = scene.characterName + " · (" + Math.round(actor.x) +
      ", " + Math.round(actor.y) + ", layer " + scene.start.layer + ") · " +
      actor.facing + (actor.moving ? " · walking" : " · standing") +
      (actor.blocked ? " · blocked" : "") + " · " + scene.collisionPolicy;

    const current = currentInnMessage(inn);
    const sourceLine = currentLegacyDialogue(legacy);
    const scriptWaiting = Boolean(scriptSession.execution?.waiting);
    const genericTarget = selectTk3ScriptTarget(scene, actorAtLayer());
    const sourceTarget = genericTarget && sourcePlans.has(genericTarget.programPath) ?
      genericTarget : null;
    const near = nearAuthoredInn(actorAtLayer(), scene) && !sourceTarget;
    const innIndex = scene.innDoor && sourcePlans.get(scene.innDoor.programPath)?.eventIndex;
    const innVisits = innIndex !== undefined && innIndex !== null ?
      (legacy?.variables.checked?.[innIndex] ?? 0) : inn.checkedInn;
    hud.textContent = "Clues: " + (legacy?.variables.clues ?? inn.clues) +
      " / " + (legacy?.variables.maxclues ?? inn.maxClues) +
      " · Inn visits: " + innVisits;
    scriptVariables.textContent = "Script variables (session): " +
      (Object.entries(scriptSession.variables).map(([name, value]) =>
        name + " = " + JSON.stringify(value)).join(" · ") || "(none yet)");
    scriptDiagnostic.textContent = legacy?.diagnostic?.text ||
      scriptSession.diagnostic?.text || "";
    scriptDiagnostic.hidden = !(legacy?.diagnostic || scriptSession.diagnostic);
    dialoguePanel.hidden = !(current || sourceLine || scriptWaiting ||
      inn.clueMessage || legacy?.clueMessage);
    if (current) {
      dialogueSpeaker.textContent = current.speaker;
      dialogueText.textContent = current.text;
      dialogueProgress.textContent = "Line " + (inn.conversation.index + 1) +
        " / " + conversationMessages(inn.conversation).length;
    } else if (sourceLine) {
      dialogueSpeaker.textContent = sourceLine.speaker + " · original RPGCode";
      dialogueText.textContent = sourceLine.text;
      dialogueProgress.textContent = sourceLine.path + ":" + sourceLine.line +
        " · " + (legacy.dialogue.index + 1) + " / " + legacy.dialogue.lines.length;
    } else if (scriptWaiting) {
      const running = scriptSession.execution;
      const waitLine = running.instructions[running.pc - 1]?.line ?? 1;
      dialogueSpeaker.textContent = scene.characterName + " · archive RPGCode";
      dialogueText.textContent = scriptSession.message || "(Waiting for input)";
      dialogueProgress.textContent = running.path + ":" + waitLine;
    } else if (legacy?.clueMessage || inn.clueMessage) {
      dialogueSpeaker.textContent = "Clue discovered";
      dialogueText.textContent = legacy?.clueMessage || inn.clueMessage;
      dialogueProgress.textContent = String(legacy?.variables.clues ?? inn.clues) +
        " / " + String(legacy?.variables.maxclues ?? inn.maxClues) + " clues found";
    }
    for (const control of runtimeControls) {
      control.button.disabled = Boolean(current || sourceLine || scriptWaiting);
    }
    talkButton.disabled = !current && !sourceLine && !scriptWaiting &&
      !near && !genericTarget;
    talkButton.textContent = current ? (
      inn.conversation.index + 1 === conversationMessages(inn.conversation).length ?
        "Finish conversation" : "Next line"
    ) : sourceLine ? (
      legacy.dialogue.index + 1 === legacy.dialogue.lines.length ?
        "Finish conversation" : "Next line"
    ) : scriptWaiting ? "Next / Finish" :
      near ? "Talk at inn" : "Talk to object";
    const hint = current || sourceLine || scriptWaiting ?
      "Conversation active · press Next, E or Space." :
      near ? "At the locked inn: press Talk, E or Space." :
      genericTarget ? "Near " + genericTarget.filename + ": Talk runs " +
        genericTarget.programPath + " from this ZIP." :
      "Approach a marked TALK object or INN DOOR.";
    const message = interactionFeedback || legacy?.diagnostic?.text ||
      scriptSession.diagnostic?.text || hint;
    if (feedback.textContent !== message) feedback.textContent = message;
  };

  function applyScriptStep(stepped) {
    const response = stepped.status === "transfer" ?
      resolveTk3BoardTransfer(stepped, scene, artifacts, graph) : stepped;
    scriptSession = response.state;
    if (response.transferred) {
      clearHeld();
      if (typeof options.onTransfer === "function") {
        options.onTransfer({ scene: response.scene, scriptSession,
          innState: inn, legacyState: legacy,
          fromBoardPath: response.fromBoardPath,
          arrivalFeedback: "Send() arrived at " + response.toBoardPath +
            " · (" + response.spawn.x + ", " + response.spawn.y +
            ", layer " + response.spawn.layer + ")." });
        return true;
      }
      scriptSession = { ...scriptSession, execution: null, diagnostic: {
        text: stepped.transfer.path + ":" + stepped.transfer.line +
          ": Send(): browser scene-transfer callback is unavailable." } };
    }
    interactionFeedback = response.status === "completed" ?
      "Source RPGCode program finished. Variables persist until Reset." : "";
    if (["waiting", "completed", "error"].includes(response.status)) clearHeld();
    return false;
  }

  function triggerRuntimeProgram(action) {
    if (inn.conversation || legacy?.dialogue ||
        scriptSession.execution?.waiting) return;
    if (applyScriptStep(startTk3RuntimeKey(scriptSession, action, artifacts))) return;
    updateStatus();
    draw();
  }

  function interact() {
    const tick = performance.now();
    const sourceTarget = selectTk3ScriptTarget(scene, actorAtLayer());
    const sourcePlan = sourceTarget && sourcePlans.get(sourceTarget.programPath);
    if (legacy?.dialogue || (legacy && sourcePlan &&
        !inn.conversation && !scriptSession.execution?.waiting)) {
      const response = legacy.dialogue ?
        advanceLegacyDialogue(legacy, tick) :
        openLegacyDialogue(legacy, sourcePlan, tick);
      legacy = response.state;
      if (response.status === "completed") {
        scriptSession = { ...scriptSession,
          variables: { ...scriptSession.variables, ...legacy.variables } };
        interactionFeedback = response.clueGained ?
          "Original source clue recorded; " +
          Math.max(0, legacy.variables.maxclues - legacy.variables.clues) +
          " remaining." : "Original source conversation finished.";
        clearHeld();
      } else if (response.status === "cooldown") {
        interactionFeedback = "Wait " + response.remainingMs + " ms to talk again.";
      } else if (response.status === "already-visited") {
        interactionFeedback = "This one-time source interaction is complete.";
      } else {
        interactionFeedback = "";
        if (response.status === "waiting") clearHeld();
      }
      updateStatus();
      draw();
      return;
    }
    if (scriptSession.execution?.waiting ||
        (!inn.conversation && !nearAuthoredInn(actorAtLayer(), scene) &&
          selectTk3ScriptTarget(scene, actorAtLayer()))) {
      const stepped = scriptSession.execution?.waiting ?
        advanceTk3Script(scriptSession) :
        startPlacedTk3Script(scriptSession, scene, actorAtLayer(), artifacts);
      if (applyScriptStep(stepped)) return;
    } else {
      const response = inn.conversation ?
        advanceInn(inn, tick) : activateAuthoredInn(inn, actorAtLayer(), tick, scene);
      inn = response.state;
      if (response.outcome === "out-of-range") {
        interactionFeedback = "Move within 46 pixels of the inn on its authored layer.";
      } else if (response.outcome === "unavailable") {
        interactionFeedback = "Inn interaction unavailable: the activation program is not uniquely resolved.";
      } else if (response.outcome === "cooldown") {
        interactionFeedback = "Give the door a moment (" +
          response.remainingMs + " ms cooldown remaining).";
      } else {
        interactionFeedback = "";
        if (response.outcome === "opened" || response.outcome === "completed") {
          clearHeld();
          if (response.outcome === "completed" && response.clueGained) {
            interactionFeedback = "Clue found! The inn is still locked.";
          }
        }
      }
    }
    updateStatus();
    draw();
  }
  const step = (direction, seconds) => {
    if (inn.conversation || legacy?.dialogue ||
        scriptSession.execution?.waiting) return;
    const previous = actor;
    actor = stepMovement(actor, axes[direction], seconds, scene.world);
    if (actor.distance !== previous.distance) interactionFeedback = "";
    if (actor.facing !== priorFacing) walkMs = 0;
    priorFacing = actor.facing;
    if (!actor.moving || !previous.moving) walkMs = 0;
    draw();
    updateStatus();
  };
  const animate = timestamp => {
    const seconds = lastFrame === null ? 0 : Math.max(0, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;
    const prior = actor;
    actor = stepMovement(actor, inn.conversation || legacy?.dialogue ||
      scriptSession.execution?.waiting ?
      { x: 0, y: 0 } : input(), seconds, scene.world);
    if (actor.distance !== prior.distance) interactionFeedback = "";
    if (actor.facing !== priorFacing || (!prior.moving && actor.moving)) walkMs = 0;
    if (actor.moving) walkMs += Math.min(seconds, 0.05) * 1000;
    else walkMs = 0;
    priorFacing = actor.facing;
    draw();
    updateStatus();
    requestId = requestAnimationFrame(animate);
  };

  document.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "") ||
        event.target?.isContentEditable) return;
    if (event.code === "KeyE" || event.code === "Space") {
      // Focused buttons handle their native Space/Enter clicks, not a
      // duplicate global dialogue action.
      if (event.target?.closest?.("button, a, [role=button]")) return;
      event.preventDefault();
      if (!event.repeat) interact();
      return;
    }
    // The native engine maps GAM runtime key characters through the
    // user's keyboard layout to scan codes. Browser key events are a
    // documented approximation, with one run per keydown (no auto-repeat).
    const keyName = event.key.length === 1 ? event.key.toUpperCase() : event.key;
    const runtime = runtimeActions.find(action => action.label === keyName);
    if (runtime && !inn.conversation && !legacy?.dialogue &&
        !scriptSession.execution?.waiting &&
        !event.target?.closest?.("button, a, [role=button]")) {
      event.preventDefault();
      if (!event.repeat) triggerRuntimeProgram(runtime);
      return;
    }
    if (!keyDirections.has(event.code)) return;
    if (!inn.conversation && !legacy?.dialogue &&
        !scriptSession.execution?.waiting)
      keyboardHeld.add(event.code);
    event.preventDefault();
  }, { signal: listeners.signal });
  document.addEventListener("keyup", event => {
    if (!keyDirections.has(event.code)) return;
    keyboardHeld.delete(event.code);
    event.preventDefault();
  }, { signal: listeners.signal });
  window.addEventListener("blur", clearHeld, { signal: listeners.signal });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearHeld();
  }, { signal: listeners.signal });
  for (const button of pad) {
    button.addEventListener("pointerdown", event => {
      if (inn.conversation || legacy?.dialogue ||
          scriptSession.execution?.waiting) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointerHeld.set(event.pointerId, button.dataset.move);
      button.classList.add("held");
      // Match the synthetic sandbox: even a touch shorter than one
      // animation tick moves the character once.
      step(button.dataset.move, 1 / 60);
    }, { signal: listeners.signal });
    const release = event => {
      pointerHeld.delete(event.pointerId);
      if (![...pointerHeld.values()].includes(button.dataset.move))
        button.classList.remove("held");
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, release, { signal: listeners.signal });
    }
    button.addEventListener("click", event => {
      if (event.detail === 0) step(button.dataset.move, 1 / 20);
    }, { signal: listeners.signal });
  }
  talkButton.addEventListener("click", interact, { signal: listeners.signal });
  for (const { action, button } of runtimeControls) {
    button.addEventListener("click", () => triggerRuntimeProgram(action),
      { signal: listeners.signal });
  }
  vectorOverlay.addEventListener("change", draw, { signal: listeners.signal });
  markerToggle.addEventListener("change", () => {
    updatePlaytestMarkers();
    draw();
  }, { signal: listeners.signal });
  const reset = section.querySelector("#play-reset");
  reset.addEventListener("click", () => {
    clearHeld();
    actor = initialMovementState(scene.world);
    inn = initialInnState();
    scriptSession = initialTk3ScriptState();
    legacy = sourcePlans.size ? initialLegacyDialogueState(dialogueDefinitions) : null;
    if (legacy) scriptSession = { ...scriptSession,
      variables: { ...legacy.variables } };
    interactionFeedback = "";
    priorFacing = actor.facing;
    walkMs = 0;
    draw();
    updateStatus();
  }, { signal: listeners.signal });

  draw();
  updateStatus();
  requestId = requestAnimationFrame(animate);
  return {
    destroy() {
      clearHeld();
      listeners.abort();
      if (requestId !== null) cancelAnimationFrame(requestId);
    },
  };
}
