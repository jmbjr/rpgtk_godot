# BSTW: first playability vertical slice

Evidence report revision **1.0** · [format index](README.md) · [playability issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92).

This is a **source-only** assessment of the owner-supplied \`BSTW_EXPO_DEMO (1).zip\`
(SHA-256 \`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300\`).
It is **not a working interpreter or a claim of an engine-compatible game**.
The original game bytes, Windows executables and DLLs remain outside this repository.

## Proposed minimal experience

**Title → New → starting board → four-way movement → approach inn door → first/repeat dialogue.**

Four source-linked gates can be checked independently in the viewer; all
runtime acceptances remain **not tested**. The first vertical slice should
demonstrate movement and one meaningful interaction, **not full BSTW**.

| Step | Direct original-file evidence | Runtime behaviors still needed |
| --- | --- | --- |
| Title | \`BSTW.gam\` configures \`BSTW/Prg/menuTitle.prg\`. Source lines 13–17 include CArray, CCmap, CommonFunctions, menus, init. Lines 33–35 set introductory art/music and run CutsceneIntro. Line 100 begins the menu loop. The \`case 0\` (New) block at lines **105–122** assigns Bruce/Loyalis and \`setPlayer\` data, calls \`initCmaps()\` then \`end()\`. | Display title UI, handle the New selection, create party state, enter the opening board. The effect and ordering of Toolkit's \`end()\` and interpreter lifecycle remain unverified. |
| Board | \`BSTW/Boards/start.brd\` is native BRD 2.4, **20×15×2**, coordinate code **4**. It stores **9 collision-vector records / 86 total points**, a source start at **(107,78,layer 1)** and seven item sprites. Tile/shade layers and item markers already render statically. | Select collision behavior for segments and vector flags, camera/pixel coordinate transform, input, movement/solids and player-vs-item proximity. Source markers are not gameplay hitboxes. |
| Character | \`BSTW/Chrs/bruce.tem\` (TEM 2.8) links to \`bruce_south.anm\`, \`bruce_north.anm\`, \`bruce_east.anm\`, and \`bruce_west.anm\` (ANM 2.3). All four resolve to TST 20 tiles; **south has FLcharacters.tst tiles 14 and 15**, at 32×32 with saved 0.15-second animation pause. | Bind animation to heading and movement; validate timing, idle, position, collision base, direction keys and engine-vs-browser pixel geometry. |
| First door | BRD source **sprite slot 3 (zero-based)** is \`door.itm\` at **(207,349,layer 1)** with \`activationProgram = mwininn.prg\`. \`BSTW/Prg/mwininn.prg\` includes \`CMwin.prg\` and \`CommonFunctions.prg\`. | Determine activation geometry/range and click or key rules, then execute only a defined dialogue/state adapter rather than a general RPGCode engine. |

The selected door is the **inn door**, not a transition. There is no
source evidence in \`mwininn.prg\` that opening the door changes boards.
Its first conversation is about the inn being locked; using a board
transition as acceptance for this interaction would be incorrect.

## Source-defined interaction contract

The following references are from the **original owner PRG**, not
inferred from an imagined runtime. Source-line anchors are **one-based**:

| \`mwininn.prg\` line | Observed meaning | Minimal adapter acceptance |
| --- | --- | --- |
| 1–2 | Two \`#include\` dependencies, CMwin and CommonFunctions | Know the required dialogue and common-function inputs |
| 4, 8 | \`getTickCount() - LastinnTalk\`, then test \`innDelta > ItemTalkThreshold\` | Ignore too-soon repeats under an explicitly configured test clock |
| 11 | \`checked[einn] == 0\` selects first-time conversation | Branch on first vs. repeat interaction |
| 14–43 | Named Bruce/Loyalis window and profile art, multiple \`theMwin->SetTxt\` calls, \`clues++\`, \`updateClues(...)\` | Display an equivalent first conversation and update one clue; source dialogue assets and script line evidence remain linked |
| 46–74 | A shorter repeat conversation | Show repeat dialogue without incrementing \`clues\` |
| 76–77 | Set \`LastinnTalk\` to tick count and increment \`checked[einn]\` | Persist the last interaction tick and revisit counter |

The original init script, \`init.prg\`, defines \`einn = 10\` (line 60)
and \`ItemTalkThreshold = 500\` (line 48). It also initializes clue
counters and \`checked\`. The actual meaning of tick units, how a
movement/activation vector selects the door, and timing-dependent UI
side effects still require runtime tests. **Do not claim the script has
run because its text and dependencies resolve.**

## External-plugin boundary

The static [plugin audit](plugin-abi.md) found five GAM-declared
DLL names and seven bundled x86 COM-style DLLs. The **PE export
table does not expose COM RPGCode methods** and cannot prove
whether the inn interaction calls any particular DLL indirectly
through CArray/CMwin/CommonFunctions. Until individual required
functions are mapped, plugin involvement is **unknown**, not absent
or required.

The first sandbox should implement only code and states needed
for this scenario, entirely in source-owned JavaScript/Godot/DODGE
components. It must not register, load or execute original DLLs.

## Acceptance sequence for follow-up PRs

1. **This PR — static evidence:** show four separate source links and
   runtime gaps in the Main File inspector, expose the same immutable
   evidence in connected JSON, preserve source-line references, and
   verify synthetic and original-archive chains separately.
2. **Issue #94 — controlled movement sandbox:** a source-owned
   16×11 tile board, four-direction original sprite, keyboard/mobile
   controls and explicitly chosen solid-tile collision policy. CI tests
   the pure movement model. This is playable but **not yet an imported
   BSTW board**; Android acceptance remains manual.
3. **Issue #96 — inn dialogue adapter:** the synthetic sandbox now has
   Talk / Next keyboard+touch actions, a strict source-backed cooldown,
   first/repeat dialogue, and one clue awarded upon completing the
   first conversation. The [behavioral mapping](inn-dialogue-adapter.md)
   and [portable prototype event/state contract](../../experiments/movement-sandbox/inn-contract.json)
   are **not normative DODGE implementations** and do not execute
   original RPGCode or native plugins. Android interaction acceptance
   remains manual. Follow-up work should import source-driven board
   geometry/animation and validate real runtime behavior.

### What CI establishes today

The [synthetic checker](../../scripts/check-playability-audit.mjs)
uses independently generated GAM, BRD, TEM, ANM, ITM, PRG and TST
fixtures; it verifies all four stages, source path/line evidence,
a missing movement file, an unknown door, strict connected JSON
and runtime-status honesty. An optional SHA-gated local run
against the original ZIP verifies the real title, board,
Bruce movement and inn script; **CI never embeds the game**.

**Do not confuse** a successful source-link chain or a passing
format fixture with playable game behavior or desktop editor
acceptance.
