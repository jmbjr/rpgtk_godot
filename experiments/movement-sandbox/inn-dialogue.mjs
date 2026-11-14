import { SANDBOX_WORLD } from "./world.mjs";
import { distanceToLandmark } from "./engine.mjs";

// Explicit scenario adapter, not an RPGCode interpreter. User-supplied
// BSTW mwininn.prg gives *behavioral evidence* (lines 4, 8, 11, 42,
// 43, 76-77); all dialogue below is newly written for this sandbox.
export const INN_TALK_RANGE_PIXELS = 46; // Experiment policy, not a Toolkit hitbox.
export const INN_TALK_THRESHOLD_MS = 500; // Source: init.prg:48.
export const INN_CHECKED_INDEX = 10; // Source: init.prg:60 (einn).
export const INN_MAX_CLUES = 13; // Source: init.prg:78.

const firstConversation = Object.freeze([
  Object.freeze({ speaker: "Bruce", text: "We could ask at the inn. Someone might know what happened." }),
  Object.freeze({ speaker: "Loyalis", text: "It's locked. Looks like we're not getting inside today." }),
  Object.freeze({ speaker: "Bruce", text: "That would have been a little too convenient, wouldn't it?" }),
  Object.freeze({ speaker: "Bruce", text: "We'll have to look for answers outside." }),
]);
const repeatConversation = Object.freeze([
  Object.freeze({ speaker: "Bruce", text: "Think the inn has opened yet?" }),
  Object.freeze({ speaker: "Loyalis", text: "Still locked, I'm afraid." }),
  Object.freeze({ speaker: "Bruce", text: "Then we'll keep searching elsewhere." }),
]);

export const INN_CLUE = "The inn is closed; ask around outside for rumors.";
export const INN_SCRIPT_SOURCE = Object.freeze({
  target: "BSTW/Prg/mwininn.prg",
  definition: "BSTW/Prg/init.prg",
  sourceLines: Object.freeze({
    cooldown: Object.freeze([4, 8]),
    firstVisitBranch: Object.freeze([11]),
    firstDialogue: Object.freeze([16, 23, 30, 32]),
    repeatDialogue: Object.freeze([50, 57, 64]),
    clueUpdate: Object.freeze([42, 43]),
    onComplete: Object.freeze([76, 77]),
    threshold: Object.freeze([48]),
    enumIndex: Object.freeze([60]),
    maxClues: Object.freeze([78]),
  }),
  limitations: Object.freeze([
    "Dialogue is newly authored paraphrase, not original imported game text.",
    "The collision, proximity radius and input are sandbox policies; Toolkit item vectors are not emulated.",
    "This adapter models the observed script branch, cooldown and counters; it never executes RPGCode or DLLs.",
  ]),
});

export function initialInnState() {
  return {
    checkedInn: 0,
    clues: 0,
    maxClues: INN_MAX_CLUES,
    lastInnTalkMs: null,
    conversation: null,
    clueMessage: null,
  };
}

export function nearInn(actor, world = SANDBOX_WORLD) {
  return Number.isFinite(actor?.x) && Number.isFinite(actor?.y) &&
    distanceToLandmark(actor, world) <= INN_TALK_RANGE_PIXELS;
}

export function conversationMessages(conversation) {
  if (!conversation) return [];
  if (conversation.kind === "first") return firstConversation;
  if (conversation.kind === "repeat") return repeatConversation;
  throw Error("Unknown inn conversation kind.");
}

export function currentInnMessage(state) {
  const chat = state.conversation;
  return chat ? conversationMessages(chat)[chat.index] ?? null : null;
}

function requireTick(tickMs) {
  if (!Number.isFinite(tickMs) || tickMs < 0) {
    throw new RangeError("Inn interaction needs a nonnegative monotonic millisecond tick.");
  }
}

// No hidden clocks, I/O, RNG, game assets, or side effects.
export function activateInn(state, actor, tickMs, world = SANDBOX_WORLD) {
  requireTick(tickMs);
  if (state.conversation) return { state, outcome: "busy" };
  if (!nearInn(actor, world)) return { state, outcome: "out-of-range" };
  const elapsed = state.lastInnTalkMs === null ? Infinity :
    tickMs - state.lastInnTalkMs;
  // Exact source guard: innDelta > ItemTalkThreshold. Equality rejects.
  if (elapsed <= INN_TALK_THRESHOLD_MS) {
    return {
      state, outcome: "cooldown",
      remainingMs: Math.max(1, Math.floor(INN_TALK_THRESHOLD_MS - elapsed) + 1),
    };
  }
  const kind = state.checkedInn === 0 ? "first" : "repeat";
  return {
    state: { ...state, conversation: { kind, index: 0 }, clueMessage: null },
    outcome: "opened", kind,
  };
}

export function advanceInn(state, tickMs) {
  requireTick(tickMs);
  const talk = state.conversation;
  if (!talk) return { state, outcome: "inactive" };
  const messages = conversationMessages(talk);
  if (!Number.isInteger(talk.index) || talk.index < 0 || talk.index >= messages.length)
    throw Error("Invalid inn dialogue cursor.");
  if (talk.index + 1 < messages.length) {
    return {
      state: { ...state, conversation: { ...talk, index: talk.index + 1 } },
      outcome: "advanced",
    };
  }
  const foundFirstClue = talk.kind === "first" && state.checkedInn === 0;
  // Source performs clue/updateClues at the end of first conversation,
  // followed by LastinnTalk and checked[einn] updates (script 42-43, 76-77).
  return {
    state: {
      ...state,
      checkedInn: state.checkedInn + 1,
      clues: foundFirstClue ? Math.min(state.maxClues, state.clues + 1) : state.clues,
      lastInnTalkMs: tickMs,
      conversation: null,
      clueMessage: foundFirstClue ? INN_CLUE : null,
    },
    outcome: "completed",
    kind: talk.kind,
    clueGained: foundFirstClue,
  };
}
