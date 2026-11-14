import { SANDBOX_WORLD, TILE_SIZE, tileAt, solidAt } from "./world.mjs";
import { ACTOR_RADIUS, initialMovementState, stepMovement } from "./engine.mjs";
import { initialInnState, nearInn, activateInn, advanceInn, currentInnMessage,
  conversationMessages } from "./inn-dialogue.mjs";

const board = document.querySelector("#sandbox-canvas");
const ctx = board.getContext("2d", { alpha: false });
const status = document.querySelector("#sandbox-status");
const landmarkStatus = document.querySelector("#sandbox-landmark");
const resetButton = document.querySelector("#sandbox-reset");
const overlay = document.querySelector("#sandbox-collision");
const talkButton = document.querySelector("#sandbox-talk");
const clueHud = document.querySelector("#sandbox-hud");
const dialoguePanel = document.querySelector("#sandbox-dialogue");
const dialogueSpeaker = document.querySelector("#sandbox-dialogue-speaker");
const dialogueText = document.querySelector("#sandbox-dialogue-text");
const dialogueProgress = document.querySelector("#sandbox-dialogue-progress");
const pad = [...document.querySelectorAll("[data-move]")];
const keyDirections = new Map([
  ["ArrowUp", "north"], ["KeyW", "north"],
  ["ArrowDown", "south"], ["KeyS", "south"],
  ["ArrowLeft", "west"], ["KeyA", "west"],
  ["ArrowRight", "east"], ["KeyD", "east"],
]);
const keyboardHeld = new Set();
const pointerHeld = new Map();
const directional = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
};
let player = initialMovementState();
let inn = initialInnState();
let interactionFeedback = "";
let lastFrame = null;
let lastStatus = 0;
const background = document.createElement("canvas");
background.width = board.width;
background.height = board.height;
const bg = background.getContext("2d", { alpha: false });

function tileBox(context, x, y, fill) {
  context.fillStyle = fill;
  context.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
}

function drawBackdrop() {
  for (let row = 0; row < SANDBOX_WORLD.height; row++) {
    for (let col = 0; col < SANDBOX_WORLD.width; col++) {
      const type = tileAt(SANDBOX_WORLD, col, row);
      const px = col * TILE_SIZE, py = row * TILE_SIZE;
      if (type === "#") {
        tileBox(bg, col, row, (col + row) % 2 ? "#464952" : "#3e4249");
        bg.fillStyle = "#666b73";
        bg.fillRect(px + 1, py + 1, 30, 3);
        bg.fillStyle = "#2d3136";
        bg.fillRect(px + 2, py + 26, 28, 5);
        bg.fillRect(px + 15, py + 5, 2, 21);
      } else {
        tileBox(bg, col, row, (col + row) % 3 ? "#49694c" : "#52724d");
        bg.fillStyle = "#5b8054";
        bg.fillRect(px + 5, py + 9, 3, 3);
        bg.fillRect(px + 24, py + 23, 2, 3);
        if (row === 9 || col === 7) {
          bg.fillStyle = "#77725c";
          bg.fillRect(px + 1, py + 1, 30, 30);
          bg.fillStyle = "#89816c";
          bg.fillRect(px + 4, py + 4, 7, 3);
          bg.fillRect(px + 20, py + 23, 6, 3);
        }
        if (type === "I") {
          bg.fillStyle = "#2c2530";
          bg.fillRect(px + 2, py + 12, 28, 17);
          bg.fillStyle = "#c18c60";
          bg.fillRect(px + 5, py + 14, 22, 15);
          bg.fillStyle = "#8b454a";
          bg.fillRect(px + 1, py + 9, 30, 6);
          bg.fillRect(px + 6, py + 5, 20, 5);
          bg.fillStyle = "#f7db9c";
          bg.font = "bold 9px monospace";
          bg.fillText("INN", px + 7, py + 24);
        }
      }
    }
  }
}

function drawActor(context, actor) {
  const x = Math.round(actor.x), y = Math.round(actor.y);
  context.save();
  context.fillStyle = "#1c3028aa";
  context.beginPath();
  context.ellipse(x, y + 8, 11, 5, 0, 0, Math.PI * 2);
  context.fill();
  context.translate(x, y - 4);
  context.scale(2, 2);
  // Original tiny pixel character, not a Toolkit or BSTW sprite.
  const foot = actor.moving ? (actor.frame === 0 ? -2 : 2) : 0;
  context.fillStyle = "#24242e";
  context.fillRect(-5, 7 + foot, 4, 5);
  context.fillRect(2, 7 - foot, 4, 5);
  context.fillStyle = actor.facing === "north" ? "#42669a" : "#354d7c";
  context.fillRect(-6, -1, 13, 9);
  context.fillStyle = "#c5a470";
  context.fillRect(-8, 0 + foot / 2, 3, 7);
  context.fillRect(6, 0 - foot / 2, 3, 7);
  if (actor.facing === "north") {
    context.fillStyle = "#2b3541";
    context.fillRect(-5, -10, 11, 10);
    context.fillStyle = "#77533a";
    context.fillRect(-6, -10, 12, 3);
    context.fillStyle = "#92afd1";
    context.fillRect(-3, 2, 7, 4);
  } else {
    context.fillStyle = "#d9b98a";
    context.fillRect(-5, -9, 11, 10);
    context.fillStyle = "#45322c";
    context.fillRect(-6, -11, 12, 4);
    context.fillRect(-6, -8, 3, 4);
    context.fillStyle = "#262632";
    if (actor.facing === "south") {
      context.fillRect(-3, -4, 2, 2);
      context.fillRect(3, -4, 2, 2);
    } else {
      const facingRight = actor.facing === "east";
      context.fillRect(facingRight ? 4 : -4, -4, 2, 2);
      context.fillStyle = "#a87f62";
      context.fillRect(facingRight ? 6 : -6, -2, 2, 3);
    }
  }
  context.restore();
}

function draw() {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(background, 0, 0);
  if (overlay.checked) {
    ctx.fillStyle = "rgba(255, 141, 68, 0.14)";
    ctx.strokeStyle = "rgba(255, 218, 157, 0.55)";
    ctx.lineWidth = 1;
    for (let row = 0; row < SANDBOX_WORLD.height; row++) for (let col = 0; col < SANDBOX_WORLD.width; col++) {
      if (!solidAt(SANDBOX_WORLD, col, row)) continue;
      ctx.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.strokeRect(col * TILE_SIZE + 0.5, row * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
    ctx.strokeStyle = "#ffdcab";
    ctx.beginPath();
    ctx.arc(player.x, player.y, ACTOR_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (nearInn(player) || inn.conversation) {
    const tileX = SANDBOX_WORLD.landmark.x - TILE_SIZE / 2;
    const tileY = SANDBOX_WORLD.landmark.y - TILE_SIZE / 2;
    ctx.strokeStyle = "#ffe19b";
    ctx.lineWidth = 3;
    ctx.strokeRect(tileX + 1.5, tileY + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  }
  drawActor(ctx, player);
}

function pressedInput() {
  const directions = new Set([...keyboardHeld].map(code => keyDirections.get(code))
    .concat([...pointerHeld.values()]));
  return {
    x: Number(directions.has("east")) - Number(directions.has("west")),
    y: Number(directions.has("south")) - Number(directions.has("north")),
  };
}

function updateStatus() {
  status.textContent = "Position (" + Math.round(player.x) + ", " +
    Math.round(player.y) + ") · facing " + player.facing +
    (player.moving ? " · walking" : " · standing") +
    (player.blocked ? " · wall collision" : "");
  const near = nearInn(player);
  const current = currentInnMessage(inn);
  const hint = current ? "Conversation active · press Next, E or Space to continue." :
    near ? "At the locked inn: press Talk, E or Space." :
    "Walk to the INN at the upper right to talk.";
  const message = interactionFeedback || hint;
  // Avoid repeated ARIA announcements while the animation loop runs.
  if (landmarkStatus.textContent.trim() !== message) landmarkStatus.textContent = message;
  clueHud.textContent = "Clues: " + inn.clues + " / " + inn.maxClues +
    " · Inn visits: " + inn.checkedInn;
  dialoguePanel.hidden = !(current || inn.clueMessage);
  if (current) {
    dialogueSpeaker.textContent = current.speaker;
    dialogueText.textContent = current.text;
    dialogueProgress.textContent = "Line " + (inn.conversation.index + 1) +
      " / " + conversationMessages(inn.conversation).length;
  } else if (inn.clueMessage) {
    dialogueSpeaker.textContent = "Clue discovered";
    dialogueText.textContent = inn.clueMessage;
    dialogueProgress.textContent = "1 / " + inn.maxClues + " clues found";
  }
  talkButton.disabled = !current && !near;
  talkButton.textContent = current ? (
    inn.conversation.index + 1 === conversationMessages(inn.conversation).length ?
      "Finish conversation" : "Next line"
  ) : "Talk at inn";
}

function interact() {
  // performance.now is a browser monotonic-millisecond clock; the pure
  // behavior adapter receives the timestamp explicitly for easy tests.
  const tick = performance.now();
  const response = inn.conversation ?
    advanceInn(inn, tick) : activateInn(inn, player, tick);
  inn = response.state;
  if (response.outcome === "out-of-range") {
    interactionFeedback = "Move closer to the inn before talking.";
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
  updateStatus();
  draw();
}

function frame(timestamp) {
  const seconds = lastFrame === null ? 0 : Math.max(0, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;
  // Pause walking while dialogue is shown, preserving interaction range.
  const before = player;
  player = stepMovement(player, inn.conversation ? { x: 0, y: 0 } :
    pressedInput(), seconds);
  if (player.distance !== before.distance) interactionFeedback = "";
  draw();
  if (timestamp - lastStatus > 150) {
    updateStatus();
    lastStatus = timestamp;
  }
  requestAnimationFrame(frame);
}

function clearHeld() {
  keyboardHeld.clear();
  pointerHeld.clear();
  for (const button of pad) button.classList.remove("held");
  lastFrame = null;
}

document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? "") ||
      event.target?.isContentEditable) return;
  if (event.code === "KeyE" || event.code === "Space") {
    // A focused button already generates its own click on Space/Enter;
    // don't handle the same physical action twice.
    if (event.target?.closest?.("button, a, [role=button]")) return;
    event.preventDefault();
    if (!event.repeat) interact();
    return;
  }
  if (!keyDirections.has(event.code)) return;
  if (!inn.conversation) keyboardHeld.add(event.code);
  event.preventDefault();
});
document.addEventListener("keyup", event => {
  if (!keyDirections.has(event.code)) return;
  keyboardHeld.delete(event.code);
  event.preventDefault();
});
window.addEventListener("blur", clearHeld);
document.addEventListener("visibilitychange", () => { if (document.hidden) clearHeld(); });

for (const button of pad) {
  button.addEventListener("pointerdown", event => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointerHeld.set(event.pointerId, button.dataset.move);
    button.classList.add("held");
    // Short taps should move too, even when a pointer press begins and
    // ends between animation frames on a fast touchscreen.
    player = stepMovement(player, directional[button.dataset.move], 1 / 60);
    draw();
    updateStatus();
  });
  const release = event => {
    pointerHeld.delete(event.pointerId);
    if (![...pointerHeld.values()].includes(button.dataset.move)) {
      button.classList.remove("held");
    }
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("click", event => {
    if (event.detail !== 0) return; // Keyboard-triggered button activation.
    player = stepMovement(player, directional[button.dataset.move], 1 / 20);
    draw();
    updateStatus();
  });
}
talkButton.addEventListener("click", interact);
resetButton.addEventListener("click", () => {
  clearHeld();
  player = initialMovementState();
  inn = initialInnState();
  interactionFeedback = "";
  updateStatus();
  draw();
});
overlay.addEventListener("change", draw);

if (!ctx || !bg) {
  status.textContent = "This browser cannot create a 2D canvas.";
  for (const button of pad) button.disabled = true;
} else {
  drawBackdrop();
  updateStatus();
  requestAnimationFrame(frame);
}
