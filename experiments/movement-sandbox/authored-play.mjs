import { tilePixels } from "../../artifacts.mjs";
import { tileBitmapSprite } from "../../sprites.mjs";
import { spriteDrawOrder, spritePixelOrigin } from "../../placed-sprites.mjs";
import { keyFrameColor } from "../../sprites.mjs";
import { initialMovementState, stepMovement } from "./engine.mjs";
import { initialTk3ScriptState, selectTk3ScriptTarget, startPlacedTk3Script,
  advanceTk3Script, chooseTk3Cursor, rejectTk3Effect, resumeTk3Effect, resumeTk3Transfer, rejectTk3Transfer } from "../../tk3-script-slice.mjs";
import { resolveTk3FightRequest, simulateTk3FightVictory,
  simulateTk3FightDefeat, cancelTk3FightTest } from "../../tk3-fight-bridge.mjs";
import { resolveTk3BoardTransfer } from "../../tk3-board-transfer.mjs";
import { PRG_STOPS_MOVEMENT, insideTk3BoardProgram,
  selectTk3BoardStep, selectTk3BoardKey, startTk3BoardProgram }
  from "../../tk3-board-programs.mjs";
import { listTk3RuntimeKeys, startTk3RuntimeKey } from "../../tk3-runtime-keys.mjs";
import { describePlayableTargets } from "./playtest-guidance.mjs";

import { createTk3PlayerServices } from "../../tk3-player-services.mjs";

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
  const feedback = section.querySelector("#play-feedback");
  const dialoguePanel = section.querySelector("#play-dialogue");
  const dialogueSpeaker = section.querySelector("#play-dialogue-speaker");
  const dialogueText = section.querySelector("#play-dialogue-text");
  const dialogueProgress = section.querySelector("#play-dialogue-progress");
  const talkButton = section.querySelector("#play-talk");
  const runtimeButtons = section.querySelector("#play-runtime-actions");
  const fightPanel = section.querySelector("#play-fight-test");
  const fightDetails = section.querySelector("#play-fight-details");
  const fightSimulate = section.querySelector("#play-fight-simulate");
  const fightDefeat = section.querySelector("#play-fight-defeat");
  const fightAbort = section.querySelector("#play-fight-abort");
  const gameOverPanel = section.querySelector("#play-gameover-test");
  const gameOverNote = section.querySelector("#play-gameover-note");
  const gameOverRestart = section.querySelector("#play-gameover-restart");
  const scriptVariables = section.querySelector("#play-script-variables");
  const scriptDiagnostic = section.querySelector("#play-script-diagnostic");
  const pad = [...section.querySelectorAll("[data-move]")];
  const ctx = canvas?.getContext("2d", { alpha: false });
  if (!ctx) throw Error("The browser cannot create a 2D canvas.");
  canvas.width = scene.board.width * 32;
  canvas.height = scene.board.height * 32;
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
      (placement.artwork ? " · image " + placement.artwork.path : "");
    diagnostic.append(row);
  }
  for (const program of scene.boardPrograms ?? []) {
    const row = document.createElement("li");
    const p = program.bounds;
    row.textContent = "Board program " + program.slot + " · " +
      program.kind.toUpperCase() + " · " +
      (p ? "(" + p.minX + "–" + p.maxX + ", " +
        p.minY + "–" + p.maxY + ", layer " + program.layer + ")" :
        "no supported activation polygon") +
      " · " + program.raw + " · " + program.status +
      (program.reason ? " (" + program.reason + ")" : "");
    diagnostic.append(row);
  }
  const services = options.services ?? createTk3PlayerServices(artifacts, scene.projectRoot, { readBytes: options.readBytes });
  const scriptScreen = document.createElement("div");
  scriptScreen.id = "play-script-screen";
  scriptScreen.className = "play-script-screen";
  scriptScreen.hidden = true;
  const screenCanvas = document.createElement("canvas");
  const display = artifacts.get(scene.mainPath)?.configuration?.display;
  screenCanvas.width = display?.width > 0 ? display.width : 640;
  screenCanvas.height = display?.height > 0 ? display.height : 480;
  if (screenCanvas.width > 4096 || screenCanvas.height > 4096)
    throw Error("The configured RPGCode display exceeds the 4096-pixel browser surface limit.");
  screenCanvas.style.aspectRatio = screenCanvas.width + " / " + screenCanvas.height;
  screenCanvas.setAttribute("aria-label", "Archive RPGCode screen");
  const screenText = document.createElement("div");
  screenText.id = "play-screen-text";
  screenText.className = "visually-hidden";
  const choices = document.createElement("div");
  choices.id = "play-script-choices";
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Archive cursor map");
  const serviceStatus = document.createElement("p");
  serviceStatus.id = "play-audio-status";
  serviceStatus.className = "technical";
  const escapeButton = document.createElement("button");
  escapeButton.id = "play-script-escape";
  escapeButton.type = "button";
  escapeButton.textContent = "Send Escape";
  escapeButton.title = "Supply ESC to a script polling KeyDown; Reset interrupts any program.";
  scriptScreen.append(screenCanvas, screenText, choices, escapeButton);
  mapFrame.after(scriptScreen, serviceStatus);
  let choice = null, choiceIndex = 0, screenVersion = null, exited = false;
  let actor = initialMovementState(scene.world);
  let scriptSession = options.scriptSession ?? initialTk3ScriptState();
  let startupActive = options.startupActive ?? false;
  let activeFight = null;
  let gameOver = false;
  let defeatProgramActive = options.defeatProgramActive ?? false;
  let gameOverMessage = "";
  const removedItemSlots = new Set(
    scriptSession.erasedItems?.[scene.boardPath] ?? []);
  const availablePlacements = () =>
    placed.filter(placement => !removedItemSlots.has(placement.slot));
  const visibleScene = () => ({ ...scene, placements: availablePlacements() });
  const rememberRemoved = slot => {
    removedItemSlots.add(slot);
    scriptSession = { ...scriptSession, erasedItems: {
      ...scriptSession.erasedItems,
      [scene.boardPath]: [...removedItemSlots],
    } };
  };
  const runtimeActions = listTk3RuntimeKeys(scene, artifacts);
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
  const listeners = new AbortController();
  escapeButton.addEventListener("click", () => services.graphics.pressKey("ESC"), {signal:listeners.signal});
  const busy = () => Boolean(exited || startupActive || activeFight || gameOver || scriptSession.execution);
  const initialGuidance = describePlayableTargets(scene, actorAtLayer());
  markerLayer.replaceChildren();
  const playerMarker = makeMarker("player", initialGuidance.player.label);
  const targetMarkers = new Map(initialGuidance.targets.map(target =>
    [target.slot, makeMarker("target", target.label + " · TALK")]));
  const boardMarkers = (scene.boardPrograms ?? [])
    .filter(program => program.status === "resolved" && program.bounds)
    .map(program => {
      const marker = makeMarker("target", "BOARD · " +
        (program.kind === "step" ? "STEP" : "TALK"));
      const midX = (program.bounds.minX + program.bounds.maxX) / 2;
      const midY = (program.bounds.minY + program.bounds.maxY) / 2;
      locateMarker(marker, {
        xPct: 100 * midX / canvas.width, yPct: 100 * midY / canvas.height,
        labelLeft: midX > canvas.width * 0.68,
        labelAbove: midY > canvas.height * 0.72,
      });
      return { program, marker };
    });
  const updatePlaytestMarkers = () => {
    const guide = describePlayableTargets(visibleScene(), actorAtLayer());
    for (const [slot, marker] of targetMarkers)
      marker.hidden = removedItemSlots.has(slot);
    locateMarker(playerMarker, guide.player);
    for (const target of guide.targets) {
      const marker = targetMarkers.get(target.slot);
      if (!marker) continue;
      locateMarker(marker, target);
      marker.classList.toggle("is-near", target.inRange);
    }
    for (const { program, marker } of boardMarkers)
      marker.classList.toggle("is-near",
        insideTk3BoardProgram(program, actorAtLayer()));
    const talking = busy();
    const instruction = talking ? (gameOver ?
      "Game over: restart the opening board to begin a new session." :
      activeFight ? "Test encounter open: choose a test outcome or cancel below." :
      "Conversation active: use Next / Finish.") :
      boardMarkers.some(m => m.program.kind === "step") ?
        guide.hint + " · Walk INTO a BOARD · STEP region to run its source PRG." :
        guide.hint;
    if (targetHint.textContent !== instruction) targetHint.textContent = instruction;
    markerLayer.hidden = !markerToggle.checked;
  };
  let walkMs = 0;
  let priorFacing = actor.facing;
  let lastFrame = null;
  let requestId = null;
  const keyboardHeld = new Set();
  const pointerHeld = new Map();

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
  const updateScreen = () => {
    const screen = scriptSession.screen;
    scriptScreen.hidden = !screen?.active;
    escapeButton.hidden = !screen?.active || !scriptSession.execution || Boolean(choice);
    mapFrame.hidden = Boolean(screen?.active);
    serviceStatus.textContent = services.audioStatus;
    serviceStatus.hidden = !services.audioStatus;
    dialoguePanel.style.backgroundImage = services.graphicUrl ? 'url("' + services.graphicUrl + '")' : "";
    if (!screen?.active || screenVersion === screen) return;
    screenVersion = screen;
    const context = screenCanvas.getContext("2d");
    services.graphics.sync(screen);
    services.graphics.paint(context);
    screenText.textContent = services.graphics.texts.map(t => t.text).join("\n");
    if (choice) {
      const point = choice.points[choiceIndex];
      context.fillStyle = "#f5c96c";
      context.beginPath(); context.moveTo(point.x - 15, point.y - 6);
      context.lineTo(point.x - 5, point.y); context.lineTo(point.x - 15, point.y + 6);
      context.closePath(); context.fill();
    }
  };
  const showChoice = request => {
    choice = request; choiceIndex = 0; choices.replaceChildren();
    for (const [index, point] of request.points.entries()) {
      const label = [...(scriptSession.screen?.texts ?? [])]
        .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y))[0]?.text;
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label || "Choice " + (index + 1);
      button.dataset.choice = String(index);
      button.addEventListener("click", () => selectChoice(index), { signal: listeners.signal });
      choices.append(button);
    }
    highlightChoice();
  };
  const highlightChoice = () => {
    screenVersion = null;
    for (const [index, button] of [...choices.children].entries())
      button.setAttribute("aria-pressed", String(index === choiceIndex));
  };
  function selectChoice(index) {
    if (!choice || !scriptSession.execution?.waiting) return;
    choice = null; choices.replaceChildren();
    if (applyScriptStep(chooseTk3Cursor(scriptSession, index))) return;
    draw(); updateStatus();
  }
  const draw = () => {
    updateScreen();
    const bg = scene.board.background;
    ctx.fillStyle = Number.isInteger(bg) && bg >= 0 ?
      "rgb(" + (bg & 255) + ", " + ((bg >>> 8) & 255) + ", " + ((bg >>> 16) & 255) + ")" : "#231f25";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let layer = 1; layer <= scene.board.layers; layer++) {
      ctx.drawImage(layerCanvases[layer - 1], 0, 0);
      // Native board renders a layer's tiles and then its sprites;
      // approximate same-layer collision-base Z ordering by stored Y/X.
      const actors = spriteDrawOrder(availablePlacements(),
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
    // Show source program polygons separately from collision: these
    // cyan areas contain RPGCode, not door ITMs or solid wall vectors.
    if (markerToggle.checked) {
      ctx.save();
      ctx.strokeStyle = "#50efff";
      ctx.fillStyle = "rgba(80,239,255,0.12)";
      ctx.lineWidth = 2;
      for (const program of scene.boardPrograms ?? []) {
        if (program.status !== "resolved" || program.layer !== scene.start.layer ||
            !program.closed || program.points.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(program.points[0].x, program.points[0].y);
        for (const point of program.points.slice(1))
          ctx.lineTo(point.x, point.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
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
    fightPanel.hidden = !activeFight;
    gameOverPanel.hidden = !gameOver;
    if (gameOver) gameOverNote.textContent = gameOverMessage;
    if (activeFight)
      fightDetails.textContent = activeFight.name +
        " · HP " + activeFight.hp + " · enemy " + activeFight.enemyPath +
        " · background " + activeFight.backgroundPath +
        " · authored victory " +
        (activeFight.victoryProgram?.path ?? "(none)");
    updatePlaytestMarkers();
    status.textContent = scene.characterName + " · (" + Math.round(actor.x) +
      ", " + Math.round(actor.y) + ", layer " + scene.start.layer + ") · " +
      actor.facing + (actor.moving ? " · walking" : " · standing") +
      (actor.blocked ? " · blocked" : "") + " · " + scene.collisionPolicy;

    const scriptWaiting = Boolean(scriptSession.execution?.waiting && scriptSession.execution.inputKind === "wait");
    const target = selectTk3ScriptTarget(visibleScene(), actorAtLayer());
    const boardKey = !target && selectTk3BoardKey(scene, actorAtLayer());
    scriptVariables.textContent = "Script variables (session): " +
      (Object.entries(scriptSession.variables).map(([name, value]) =>
        name + " = " + JSON.stringify(value)).join(" · ") || "(none yet)");
    scriptDiagnostic.textContent = scriptSession.diagnostic?.text || "";
    scriptDiagnostic.hidden = !scriptSession.diagnostic;
    dialoguePanel.hidden = !scriptWaiting || Boolean(activeFight || gameOver);
    if (!dialoguePanel.hidden) {
      const running = scriptSession.execution;
      const wait = running.instructions[running.pc - 1];
      dialogueSpeaker.textContent = scene.characterName + " · archive RPGCode";
      dialogueText.textContent = scriptSession.message || "(Waiting for input)";
      dialogueProgress.textContent = (wait?.path ?? running.path) + ":" + (wait?.line ?? 1);
    }
    for (const { button } of runtimeControls) button.disabled = busy();
    talkButton.disabled = Boolean(exited || choice || activeFight || gameOver || (scriptSession.execution && !scriptWaiting)) ||
      !(scriptWaiting || target || boardKey);
    talkButton.textContent = scriptWaiting ? "Next / Finish" : "Talk";
    const hint = gameOver ?
      "Game over (test): restart the opening board to start fresh." :
      activeFight ? "Test encounter: choose a simulated outcome or cancel below." :
      scriptWaiting ?
      "Conversation active · use Next or the Talk shortcut." :
      target ? "Near " + target.filename + ": Talk runs " + target.programPath + " from this ZIP." :
      boardKey ? "Press Talk to run " + boardKey.raw + "." :
      (scene.boardPrograms ?? []).some(p => p.status === "resolved" && p.kind === "step") ?
      "Walk into a BOARD · STEP area to activate the authored program." :
      "Approach an authored Talk object or board program.";
    const message = interactionFeedback ||
      scriptSession.diagnostic?.text || hint;
    if (feedback.textContent !== message) feedback.textContent = message;
  };

  function applyScriptStep(stepped) {
    if (stepped.status === "effect" && stepped.effect?.kind === "runtime-service") {
      scriptSession = stepped.state;
      clearHeld();
      void Promise.resolve().then(() => {
        services.graphics.sync(scriptSession.screen);
        return services.apply(stepped.effect);
      }).then(result => {
        if (listeners.signal.aborted) return;
        if (!applyScriptStep(resumeTk3Effect(scriptSession, result))) { draw(); updateStatus(); }
      }, error => {
        if (listeners.signal.aborted) return;
        applyScriptStep(rejectTk3Effect(scriptSession, stepped.effect, error.message));
        draw(); updateStatus();
      });
      return false;
    }
    if (stepped.status === "choice") {
      scriptSession = stepped.state; showChoice(stepped.choice); clearHeld(); return false;
    }
    if (stepped.status === "exited") {
      scriptSession = stepped.state; exited = true; startupActive = false;
      services.destroy(); choice = null; choices.replaceChildren(); clearHeld();
      interactionFeedback = "Source windows() exited the game. Reset starts a fresh session.";
      return false;
    }
    if (["completed", "error"].includes(stepped.status)) { choice = null; choices.replaceChildren(); }
    if (stepped.status === "fight") {
      const resolved = resolveTk3FightRequest(stepped, artifacts, scene.projectRoot);
      scriptSession = resolved.state;
      activeFight = resolved.status === "ready" ? resolved.encounter : null;
      if (!activeFight) startupActive = false;
      interactionFeedback = activeFight ?
        "Source fightEnemy() reached. This test requires a manual simulated outcome; no battle plugin is running." :
        resolved.state?.diagnostic?.text || "Fight source could not be resolved.";
      clearHeld();
      return false;
    }
    if (stepped.status === "effect") {
      const e = stepped.effect;
      scriptSession = stepped.state;
      const valid = e?.kind === "erase-item" && e.alias === "source" &&
        e.sourceBoardPath === scene.boardPath &&
        Number.isInteger(e.sourceItemSlot) &&
        placed.some(p => p.slot === e.sourceItemSlot);
      if (!valid) {
        const diagnostic = { path: e?.path ?? "(script)", line: e?.line ?? 1,
          text: (e?.path ?? "(script)") + ":" + (e?.line ?? 1) +
            ": eraseItem() source item is not present on this board." };
        scriptSession = { ...scriptSession, execution: null, scriptStack: [],
          diagnostic };
        startupActive = false;
        interactionFeedback = diagnostic.text;
        clearHeld();
        return false;
      }
      rememberRemoved(e.sourceItemSlot);
      interactionFeedback = "Source RPGCode erased item slot " + e.sourceItemSlot +
        " from the current board.";
      const next = resumeTk3Effect(scriptSession);
      if (next.status === "inactive") return false;
      return applyScriptStep(next);
    }
    let response = stepped.status === "transfer" ?
      resolveTk3BoardTransfer(stepped, scene, artifacts, graph, { deferResume: true }) : stepped;
    if (response.transferred) {
      clearHeld();
      const failure = options.onTransfer?.({ scene: response.scene,
        scriptSession: response.state, defeatProgramActive, startupActive, services,
        arrivalFeedback: "Send() arrived at " + response.toBoardPath +
          " · (" + response.spawn.x + ", " + response.spawn.y +
          ", layer " + response.spawn.layer + ")." });
      if (failure === null) return true;
      response = rejectTk3Transfer(response.state, stepped.transfer,
        "Send(): " + (failure ?? "browser scene-transfer callback is unavailable."));
    }
    scriptSession = response.state;
    if (startupActive && ["completed", "error"].includes(response.status)) {
      startupActive = false;
      if (response.status === "completed") {
        const failure = options.onStartupComplete?.(scriptSession, services);
        if (failure === null) return true;
        const diagnostic = { path: scene.mainPath, line: 1,
          text: scene.mainPath + ":1: " + (failure ?? "Opening-board callback is unavailable.") };
        scriptSession = { ...scriptSession, diagnostic };
      }
    }
    // Native FIGHT_LOST calls the GAM's game-over PRG and returns when
    // that PRG finishes. Only the *absent-PRG* branch invokes reset().
    const finishedDefeatPrg = defeatProgramActive &&
      response.status === "completed";
    if (defeatProgramActive &&
        ["completed", "error"].includes(response.status))
      defeatProgramActive = false;
    interactionFeedback = finishedDefeatPrg ?
      "GAM game-over RPGCode completed; Toolkit does not implicitly reset after a configured program." :
      response.status === "completed" ?
        "Source RPGCode program finished. Variables persist until Reset." : "";
    if (["waiting", "completed", "error"].includes(response.status)) clearHeld();
    return false;
  }

  function triggerRuntimeProgram(action) {
    if (busy()) return;
    if (applyScriptStep(startTk3RuntimeKey(scriptSession, action, artifacts))) return;
    updateStatus();
    draw();
  }

  function interact(waitKey = "") {
    if (exited || choice || activeFight || gameOver) return;
    if (scriptSession.execution?.waiting) {
      if (applyScriptStep(advanceTk3Script(scriptSession, waitKey))) return;
    } else {
      const actor = actorAtLayer();
      const target = selectTk3ScriptTarget(visibleScene(), actor);
      const boardKey = !target && selectTk3BoardKey(scene, actor);
      if (target || boardKey) {
        const stepped = boardKey ?
          startTk3BoardProgram(scriptSession, boardKey, artifacts, scene.projectRoot) :
          startPlacedTk3Script(scriptSession, visibleScene(), actor, artifacts);
        if (boardKey && (boardKey.flags & PRG_STOPS_MOVEMENT)) clearHeld();
        if (applyScriptStep(stepped)) return;
      }
    }
    updateStatus();
    draw();
  }
  // This is a step-ON program region, not an ITM Talk activation. The
  // browser approximates Toolkit's collision base by the actor foot point.
  const runEnteredBoardProgram = before => {
    const program = selectTk3BoardStep(scene,
      { ...before, layer: scene.start.layer }, actorAtLayer());
    if (!program) return false;
    const response = startTk3BoardProgram(scriptSession, program, artifacts, scene.projectRoot);
    const transferred = applyScriptStep(response);
    if (!transferred &&
        ((program.flags & PRG_STOPS_MOVEMENT) || response.status !== "completed"))
      clearHeld();
    return transferred;
  };
  const step = (direction, seconds) => {
    if (busy()) return;
    const previous = actor;
    actor = stepMovement(actor, axes[direction], seconds, scene.world);
    if (actor.distance !== previous.distance) interactionFeedback = "";
    if (runEnteredBoardProgram(previous)) return;
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
    actor = stepMovement(actor, busy() ?
      { x: 0, y: 0 } : input(), seconds, scene.world);
    if (actor.distance !== prior.distance) interactionFeedback = "";
    if (!scriptSession.execution && runEnteredBoardProgram(prior)) return;
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
    if (exited || activeFight || gameOver) return;
    if (choice) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Space"].includes(event.code)) {
        event.preventDefault();
        if (event.repeat) return;
        if (["Enter", "Space"].includes(event.code)) selectChoice(choiceIndex);
        else {
          choiceIndex = (choiceIndex + (["ArrowUp", "ArrowLeft"].includes(event.code) ? -1 : 1) + choice.points.length) % choice.points.length;
          highlightChoice();
        }
      }
      return;
    }
    const buttonFocused = event.target?.closest?.("button, a, [role=button]");
    if (scriptSession.execution?.waiting && scriptSession.execution.inputKind === "wait" &&
        !["Shift", "Control", "Alt", "Meta"].includes(event.key) &&
        !(buttonFocused && ["Enter", "Space"].includes(event.code))) {
      event.preventDefault();
      if (!event.repeat) interact(event.key === " " ? "SPACE" : event.key.toUpperCase());
      return;
    }
    const talkShortcut = event.code === "KeyE" || event.code === "Space";
    const modal = busy();
    const keyName = event.key === " " ? "SPACE" : event.key.toUpperCase();
    const runtime = runtimeActions.find(action => action.label?.toUpperCase() === keyName);
    if (runtime && !modal && !(buttonFocused && ["Enter", "Space"].includes(runtime.label))) {
      event.preventDefault();
      if (!event.repeat) triggerRuntimeProgram(runtime);
      return;
    }
    if (talkShortcut && (event.code === "KeyE" || !buttonFocused)) {
      event.preventDefault();
      if (!event.repeat) interact();
      return;
    }
    if (!keyDirections.has(event.code)) return;
    if (!busy())
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
      if (busy()) return;
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
  const simulateVictory = () => {
    if (!activeFight) return;
    const current = activeFight;
    activeFight = null;
    interactionFeedback = "Simulated battle victory; executing " +
      (current.victoryProgram?.path || "no source victory program") +
      " (native fight plugin and rewards were NOT simulated).";
    if (applyScriptStep(simulateTk3FightVictory(scriptSession, current))) return;
    updateStatus();
    draw();
  };
  const simulateDefeat = () => {
    if (!activeFight) return;
    const current = activeFight;
    const response = simulateTk3FightDefeat(scriptSession, current,
      artifacts, scene.mainPath, scene.projectRoot);
    if (response.status === "inactive") return;
    activeFight = null;
    clearHeld();
    if (response.status === "gameover") {
      scriptSession = response.state;
      gameOver = true;
      gameOverMessage = "Game over. Toolkit would now reset because the GAM has no game-over PRG. Restart opening board to create a fresh browser session.";
      interactionFeedback = "Simulated defeat (test only): no combat or rewards were executed.";
    } else if (response.status === "error") {
      scriptSession = response.state;
      startupActive = false;
      interactionFeedback = response.state.diagnostic?.text ||
        "The GAM-configured game-over PRG cannot be executed.";
    } else {
      defeatProgramActive = true;
      interactionFeedback = "Simulated defeat (test only): executing the GAM-defined game-over program. No native battle occurred.";
      if (applyScriptStep(response)) return;
    }
    updateStatus();
    draw();
  };
  const abortFightTest = () => {
    if (!activeFight) return;
    const response = cancelTk3FightTest(scriptSession);
    scriptSession = response.state;
    activeFight = null;
    startupActive = false;
    interactionFeedback = "Battle test cancelled; no victory, rewards, or source win script.";
    clearHeld();
    updateStatus();
    draw();
  };
  fightSimulate.addEventListener("click", simulateVictory,
    { signal: listeners.signal });
  fightDefeat.addEventListener("click", simulateDefeat,
    { signal: listeners.signal });
  fightAbort.addEventListener("click", abortFightTest,
    { signal: listeners.signal });
  gameOverRestart.addEventListener("click", () => options.onRestart(), { signal: listeners.signal });
  talkButton.addEventListener("click", () => interact(), { signal: listeners.signal });
  for (const { action, button } of runtimeControls) {
    button.addEventListener("click", () => triggerRuntimeProgram(action),
      { signal: listeners.signal });
  }
  vectorOverlay.addEventListener("change", draw, { signal: listeners.signal });
  markerToggle.addEventListener("change", () => {
    updatePlaytestMarkers();
    draw();
  }, { signal: listeners.signal });
  section.querySelector("#play-reset").addEventListener("click", () => {
    options.onRestart();
  }, { signal: listeners.signal });

  try {
    draw();
    updateStatus();
    requestId = requestAnimationFrame(animate);
  } catch (error) {
    listeners.abort();
    throw error;
  }
  return {
    services,
    activate() {
      services.graphics.setSurface(screenCanvas, canvas);
      screenVersion = null; draw(); updateStatus();
    },
    continueScript(step = resumeTk3Transfer(scriptSession)) {
      if (!applyScriptStep(step)) {
        draw();
        updateStatus();
      }
    },
    destroy({ preserveServices = false } = {}) {
      if (!preserveServices) services.destroy();
      clearHeld();
      listeners.abort();
      if (requestId !== null) cancelAnimationFrame(requestId);
    },
  };
}
