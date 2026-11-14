import { tilePixels } from "../../artifacts.mjs";
import { tileBitmapSprite } from "../../sprites.mjs";
import { spriteDrawOrder, spritePixelOrigin } from "../../placed-sprites.mjs";
import { keyFrameColor } from "../../sprites.mjs";
import { initialMovementState, stepMovement } from "./engine.mjs";

// Deliberately use the synthetic sandbox's movement engine and WASD / arrow
// / pointer-held D-pad policy. No board script, item or plugin is executed.
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
      (placement.isInnDoor ? " · INN DOOR (mwininn.prg)" : "");
    if (placement.isInnDoor) row.classList.add("play-inn-entry");
    diagnostic.append(row);
  }
  const innLabel = section.querySelector("#play-inn");
  if (scene.innDoor) {
    const p = scene.innDoor;
    innLabel.textContent = "Inn door: slot " + p.slot + " at (" +
      p.position.x + ", " + p.position.y + ", layer " +
      p.position.layer + ") · " + p.programPath + " · locator only; activation disabled.";
  } else {
    innLabel.textContent = "Inn door: " +
      (scene.innStatus === "ambiguous" ? "multiple resolved candidates" :
        "no resolved mwininn.prg placement") + "; no activation.";
  }

  let actor = initialMovementState(scene.world);
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
    // Inn locator is diagnostic only; draw above all board layers so a
    // door under roofs stays discoverable even when its artwork is missing.
    if (scene.innDoor) {
      const p = scene.innDoor.position;
      ctx.save();
      ctx.strokeStyle = "#ffe17c";
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
  };
  const updateStatus = () => {
    status.textContent = scene.characterName + " · (" + Math.round(actor.x) +
      ", " + Math.round(actor.y) + ", layer " + scene.start.layer + ") · " +
      actor.facing + (actor.moving ? " · walking" : " · standing") +
      (actor.blocked ? " · map edge" : "") + " · bounds-only collision";
  };
  const step = (direction, seconds) => {
    const previous = actor;
    actor = stepMovement(actor, axes[direction], seconds, scene.world);
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
    actor = stepMovement(actor, input(), seconds, scene.world);
    if (actor.facing !== priorFacing || (!prior.moving && actor.moving)) walkMs = 0;
    if (actor.moving) walkMs += Math.min(seconds, 0.05) * 1000;
    else walkMs = 0;
    priorFacing = actor.facing;
    draw();
    updateStatus();
    requestId = requestAnimationFrame(animate);
  };

  document.addEventListener("keydown", event => {
    if (!keyDirections.has(event.code) || event.altKey || event.ctrlKey || event.metaKey ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "") ||
        event.target?.isContentEditable) return;
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
  const reset = section.querySelector("#play-reset");
  reset.addEventListener("click", () => {
    clearHeld();
    actor = initialMovementState(scene.world);
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
