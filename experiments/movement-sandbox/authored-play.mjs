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

export function mountAuthoredBoard(section, scene, artifacts, graph) {
  if (!scene.ok) throw Error("Cannot mount an unresolved playable scene.");
  const canvas = section.querySelector("#play-canvas");
  const status = section.querySelector("#play-status");
  const collisionLabel = section.querySelector("#play-collision");
  const vectorOverlay = section.querySelector("#play-vector-overlay");
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
  const scriptVariables = section.querySelector("#play-script-variables");
  const scriptDiagnostic = section.querySelector("#play-script-diagnostic");
  const pad = [...section.querySelectorAll("[data-move]")];
  const ctx = canvas?.getContext("2d", { alpha: false });
  if (!ctx) throw Error("The browser cannot create a 2D canvas.");
  canvas.width = scene.board.width * 32;
  canvas.height = scene.board.height * 32;
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
  let inn = initialInnState();
  let scriptSession = initialTk3ScriptState();
  let interactionFeedback = "";
  const actorAtLayer = () => ({ ...actor, layer: scene.start.layer });
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
    // Source-backed generic PRG placements are marked independently of
    // the BSTW inn adapter. Markers do not claim native vector hitboxes.
    for (const placement of placed) {
      if (placement.isInnDoor || placement.programStatus !== "resolved" ||
          placement.positionStatus !== "valid") continue;
      const { x, y, layer } = placement.position;
      const near = selectTk3ScriptTarget(scene, actorAtLayer())?.slot === placement.slot;
      ctx.save();
      ctx.strokeStyle = near ? "#8bffdf" : "#6fd6ce";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ddfff8";
      ctx.font = "bold 10px monospace";
      ctx.fillText("TALK", x + 10, y - 6);
      ctx.restore();
    }
    // Inn locator is diagnostic only; draw above all board layers so a
    // door under roofs stays discoverable even when its artwork is missing.
    if (scene.innDoor) {
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
    status.textContent = scene.characterName + " · (" + Math.round(actor.x) +
      ", " + Math.round(actor.y) + ", layer " + scene.start.layer + ") · " +
      actor.facing + (actor.moving ? " · walking" : " · standing") +
      (actor.blocked ? " · blocked" : "") + " · " + scene.collisionPolicy;

    const current = currentInnMessage(inn);
    const scriptWaiting = Boolean(scriptSession.execution?.waiting);
    const near = nearAuthoredInn(actorAtLayer(), scene);
    const genericTarget = selectTk3ScriptTarget(scene, actorAtLayer());
    hud.textContent = "Clues: " + inn.clues + " / " + inn.maxClues +
      " · Inn visits: " + inn.checkedInn;
    scriptVariables.textContent = "Script variables (session): " +
      (Object.entries(scriptSession.variables).map(([name, value]) =>
        name + " = " + JSON.stringify(value)).join(" · ") || "(none yet)");
    scriptDiagnostic.textContent = scriptSession.diagnostic?.text || "";
    scriptDiagnostic.hidden = !scriptSession.diagnostic;
    dialoguePanel.hidden = !(current || scriptWaiting || inn.clueMessage);
    if (current) {
      dialogueSpeaker.textContent = current.speaker;
      dialogueText.textContent = current.text;
      dialogueProgress.textContent = "Line " + (inn.conversation.index + 1) +
        " / " + conversationMessages(inn.conversation).length;
    } else if (scriptWaiting) {
      const running = scriptSession.execution;
      const waitLine = running.instructions[running.pc - 1]?.line ?? 1;
      dialogueSpeaker.textContent = scene.characterName + " · archive RPGCode";
      dialogueText.textContent = scriptSession.message || "(Waiting for input)";
      dialogueProgress.textContent = running.path + ":" + waitLine;
    } else if (inn.clueMessage) {
      dialogueSpeaker.textContent = "Clue discovered";
      dialogueText.textContent = inn.clueMessage;
      dialogueProgress.textContent = "1 / " + inn.maxClues + " clues found";
    }
    talkButton.disabled = !current && !scriptWaiting && !near && !genericTarget;
    talkButton.textContent = current ? (
      inn.conversation.index + 1 === conversationMessages(inn.conversation).length ?
        "Finish conversation" : "Next line"
    ) : scriptWaiting ? "Next / Finish" :
      near ? "Talk at inn" : "Talk to object";
    const hint = current || scriptWaiting ? "Conversation active · press Next, E or Space." :
      near ? "At the locked inn: press Talk, E or Space." :
      genericTarget ? "Near " + genericTarget.filename + ": Talk runs " +
        genericTarget.programPath + " from this ZIP." :
      "Approach a marked TALK object or INN DOOR.";
    const message = interactionFeedback || scriptSession.diagnostic?.text || hint;
    if (feedback.textContent !== message) feedback.textContent = message;
  };

  function interact() {
    // Timestamp is injected into the same deterministic adapter as the
    // synthetic lab; exact 500ms remains blocked after completion.
    const tick = performance.now();
    if (scriptSession.execution?.waiting ||
        (!inn.conversation && !nearAuthoredInn(actorAtLayer(), scene) &&
          selectTk3ScriptTarget(scene, actorAtLayer()))) {
      const response = scriptSession.execution?.waiting ?
        advanceTk3Script(scriptSession) :
        startPlacedTk3Script(scriptSession, scene, actorAtLayer(), artifacts);
      scriptSession = response.state;
      interactionFeedback = response.status === "completed" ?
        "Source RPGCode program finished. Variables persist until Reset." : "";
      if (response.status === "waiting" || response.status === "completed" ||
          response.status === "error") clearHeld();
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
    if (inn.conversation || scriptSession.execution?.waiting) return;
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
    actor = stepMovement(actor, inn.conversation || scriptSession.execution?.waiting ?
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
    if (!keyDirections.has(event.code)) return;
    if (!inn.conversation && !scriptSession.execution?.waiting)
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
      if (inn.conversation || scriptSession.execution?.waiting) return;
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
  vectorOverlay.addEventListener("change", draw, { signal: listeners.signal });
  const reset = section.querySelector("#play-reset");
  reset.addEventListener("click", () => {
    clearHeld();
    actor = initialMovementState(scene.world);
    inn = initialInnState();
    scriptSession = initialTk3ScriptState();
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
