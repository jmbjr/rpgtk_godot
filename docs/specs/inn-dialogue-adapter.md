# Inn dialogue prototype — behavioral mapping

[Issue #96](https://github.com/jmbjr/rpgtk_godot/issues/96) ·
[Game playability roadmap](bstw-playability.md) ·
[portable prototype event/state contract](../../experiments/movement-sandbox/inn-contract.json).

This is a **playable adapter for one locked inn conversation** in the
synthetic `sandbox.html` movement experiment. It is **not a
general RPGCode interpreter**, a faithful Toolkit 3 runtime, a DODGE
conformance implementation, or the original BSTW board.

## Primary source — owner ZIP read-only

The file `BSTW/Prg/mwininn.prg` was reopened and inspected in the
owner-provided BSTW archive, SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`.
`BSTW/Prg/init.prg` supplies the constants and variable setup.

| Original source | Observed requirement | Synthetic adapter |
| --- | --- | --- |
| `init.prg:48`, `init.prg:60`, `init.prg:77–83` | `ItemTalkThreshold=500`; `einn=10`; initialize `clues=0`, `maxclues=13` and `checked` array | State fields `checkedInn`, `clues`, `maxClues` and `lastInnTalkMs` |
| `mwininn.prg:4,8` | Only run when `getTickCount()-LastinnTalk > ItemTalkThreshold` | Strict `elapsed > 500` milliseconds; 500 exactly is rejected. Uses browser monotonic `performance.now()` passed into a pure function |
| `mwininn.prg:11` | First interaction when `checked[einn] == 0` | Branch to a four-line first conversation, otherwise a three-line repeat conversation |
| `mwininn.prg:16,23,30,32` and `50,57,64` | Bruce and Loyalis alternate four first / three repeat text messages; the inn is locked | Newly authored **paraphrases**, not original text or imported images |
| `mwininn.prg:42–43` | Increment `clues`, call `updateClues` following the first conversation | Award **one clue only when the first dialogue closes**; display an original clue notice |
| `mwininn.prg:76–77` | Update last interaction tick and increment `checked[einn]` | Update `lastInnTalkMs` and `checkedInn` on conversation completion |

The original script does not initialize `LastinnTalk` in the
files inspected. The sandbox explicitly treats a **never-visited**
inn as immediately eligible; this choice is a **test policy**, not
proof of original Toolkit variable-default or tick-clock behavior.
The original timer units, interaction vector geometry and
window/portrait rendering still require runtime evidence.

## Interaction state and events

The independently testable
[`inn-dialogue.mjs`](../../experiments/movement-sandbox/inn-dialogue.mjs)
has no DOM, event loop, side effects or game dependencies other than
the synthetic map's inn center. Its behavior is represented by
[`inn-contract.json`](../../experiments/movement-sandbox/inn-contract.json)
as a small portable **event/guard/state/effect contract** intended
for eventual DODGE/Godot mapping. **It is not a normative DODGE schema.**

- `activateInn(state, actor, nowMs)`: requires the actor to be
  within the synthetic 46-pixel radius, no active conversation, and
  either no previous talk or a strict elapsed time greater than 500 ms.
  Rejections return `out-of-range`, `busy`, or `cooldown`
  without modifying state.
- `advanceInn(state, nowMs)`: advances one speaker line. Finishing
  the final line closes the conversation, increments visit count and
  records last-talk time. The **first** completion awards one clue
  up to the 13-clue maximum. Later visits do not award clues.
- `initialInnState()`: reset state, including clue counter, last
  conversation time, visit count and text. No persistent saves.

The browser scene offers a **Talk / Next / Finish** touch button
and keyboard **E / Space**, alongside its existing D-pad and
WASD/arrow movement. While dialogue is open, the actor does not
move; repeated keydown events do not advance multiple lines.
The clue HUD, speaker and line progress are accessible as text.
The synthetic inn stays locked; there is no board transition.

## Verification / limitations

[CI regression](../../scripts/check-inn-dialogue.mjs) tests
proximity boundaries, missing/invalid ticks, strict cooldown
(including the exactly-500-ms boundary), first vs repeat dialogue
lengths and speakers, single clue-on-completion, visit count,
immutable state transitions, reset, a partially pre-visited state,
portable contract agreement, and browser control wiring.

An **optional** SHA-verified local invocation of the same checker
accepts `BSTW_EXPO_DEMO (1).zip` and checks the exact original
program lines read-only. CI uses only original source-owned
fixtures, not game code or binaries. The original archive is not
committed or deployed.

**Still unverified:** Toolkit activation vector rules, the
native runtime's `getTickCount()` zero/default behavior, dialogue
portraits, support helpers, original text layout, engine collision,
plugin invocation, exact audio/timing and save persistence.
