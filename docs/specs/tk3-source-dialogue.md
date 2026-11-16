# Toolkit 3 source-derived dialogue and clue progression

Issue [#92](https://github.com/jmbjr/rpgtk_godot/issues/92). Pinned engine:
[Toolkit 3.1 revision 9191b919](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).

This is a bounded compatibility projection of the source-defined
multi-window dialogue and first-time clue behavior. It is **not**
a generic RPGCode class interpreter, a plugin emulator or a complete
BSTW engine port. No original owner assets are committed.

## Native source and original game evidence

- Toolkit `CItem::open` / `CSprite::programTest` select and run
  the activated item's resolved PRG.
- `CProgram` has shared global variables; `getTickCount()` is
  the native millisecond clock.
- Original BSTW `init.prg` defines the 13 clue limit,
  `ItemTalkThreshold=500`, the checked event indices and
  the `InitVar` initialization call.
- Original `mwinLami`, `mwinRusty`, `mwinJim`,
  `mwininn`, `mwinuglyhouse` and `mwinsmallhouse`
  use one first-visit/repeat pattern:
  `getTickCount() - Last...Talk`, strict threshold `>`,
  `checked[event]==0`, source `SetTxt` lines,
  first-only `clues++` and `updateClues("...")`,
  then `Last...Talk=getTickCount()` and
  `checked[event]++`.
- Original `mwinStartBoardLoad` uses a single companion
  conversation, sets `bruceloyalis=1`, calls
  `playerLocation`, sends to the already-active board,
  and awards one first-time clue.
- `CommonFunctions.prg::updateClues` marks `ENDDEMO=1`
  when source `remainingclues==0`. The GAM's separate
  runtime Q binding already resolves to `ENDDEMO.prg`.

## Implemented subset

The pure [source-owned dialogue module](../../tk3-source-dialogue.mjs)
follows the resolved GAM startup include graph to collect simple
numeric event/threshold/clue definitions without executing arbitrary
helpers. For an individual placed PRG, it checks included helper
method declarations, validates **every** live statement against
its supported grammar and extracts original `SetTxt` lines,
speaker slot and line numbers. Unsupported statements produce
source diagnostics; they are not ignored.

Supported conversation behavior includes `setMwin`,
`setProfile`, `SetTxt`, `setDelay`, `setTextMode`,
`freezeMwin`, `Close`, first/repeat conditions,
source cooldown, checked counters and first-time clue updates.
Frozen multi-fragment text, including `eSkipEOT` and `eNewLine`,
is presented as one coherent screen message. The source
`updateClues` helper's final-state assignment is recognized
and applied when the source clue limit is reached.

Conversations use the existing Talk / Next / Finish controls.
Movement pauses during text. On finishing, one clue is awarded
only for the first conversation, and the source shared variable
state is available to later RPGCode/runtime-key actions.
Reset/new launch returns to zero state.

**Approximations:** source Mwin/profile images, font/typewriter
delays and audio are not emulated; speaker names come from slot
and image names. 46px Talk range is a browser approximation
rather than the native activation polygon. The normal
`InitVar` class constructors and other startup effects
are not fully executed; this adapter statically gathers
only its required numeric definitions. Original Loyalis
same-board `Send` does not perform a board unload/reload.
The implementation does not execute arbitrary `#include`
classes or plugin functions. Full parity is not claimed.

## Regressions and manual test

[Source-owned synthetic production-ZIP test](../../scripts/check-tk3-source-dialogue.mjs)
uses Harbor and Grove variants with independent source names,
items, dialogue, state variables and PRG paths. It tests
GAM→BRD→ITM→PRG resolution, two conversation branches,
strict greater-than-500ms cooldown, source clue text and
completion effects, first-time-only clues, resetting and
unsupported-command line/path diagnostics. Existing
BSTW title/inn, Harbor ending, Grove and Lantern sessions,
Toolkit checks and Pages closure must remain green.

Optional read-only original archive validation from a local
checkout:

    node scripts/check-tk3-source-dialogue.mjs "/path/to/BSTW_EXPO_DEMO.zip"

This SHA-gated check compiles all seven original source
conversations, separately from browser testing. Owner DLLs
and game content are never uploaded to CI.

**Desktop/Android acceptance after merge:** upload original
BSTW ZIP → Open BSTW title → New → visit Loyalis and finish
the opening original dialogue → talk to Lami, Rusty, Jim,
the inn and two other houses → verify distinct first/repeat
source text, one-time clue rewards and cooldown. Q remains
a source-linked ending trigger; its complete original script
is not executable in this slice. Six menu-clue interactions,
full source startup/init, and the Q ending are the next
grouped capabilities. Source from owner-written GetSaveData
and FileBrowser plugins can be audited separately; neither
is evidenced as necessary on the shortest demo win path.
