# Toolkit 3.1 GAM startup lifecycle and bounded browser launch

[Issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92).
**Pinned upstream revision:** [9191b9191c9bda0998c6faae16929b3331ed2ead](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).

This document separates engine-source evidence from the narrower
static browser implementation. No native Toolkit editor or runner was
executed for this change.

## Exact native lifecycle, from pinned source

1. In [app/winmain.cpp, setUpGame lines 179–303](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L179-L303),
   Toolkit loads the GAM-declared plugins and menu/fight plugin,
   sets movement/runtime settings, clears/recreates players,
   creates the configured GAM initial TEM character if supplied,
   then initializes virtual variables. If no initial character is
   configured, the startup script must supply one.
2. At [winmain.cpp lines 304–315](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L304-L315),
   Toolkit constructs a PRG from
   `g_projectPath + PRG_PATH + g_mainFile.startupPrg`, and
   **runs it synchronously before the GAM initial board is opened**.
   If the startup filename is empty, this stage is skipped.
   The original Main File loader stores the source startup,
   initial-board, and initial-character names in that order in
   [common/mainfile.cpp lines 115–128](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/mainfile.cpp#L115-L128).
3. At [winmain.cpp lines 317–341](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L317-L341),
   if the startup did not load a save game, Toolkit opens the
   configured first BRD, positions the player at the board's
   authored spawn, aligns the view, starts applicable board music,
   and runs the BRD entry program if one is configured.
4. **Variables survive normal script return.**
   [rpgcode/CProgram.cpp lines 53–68](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp#L53-L68)
   owns a static global variable heap; [lines 332–382](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp#L332-L382)
   resolve ordinary variables against that heap;
   [run() lines 1856–1887](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp#L1856-L1887)
   finishes the running program without freeing global variables.
   Subsequent board/item RPGCode can read startup globals unless
   another program deliberately changes them.
5. **Send during startup is not a saved-game load.**
   [rpgcode/functions.cpp lines 481–519](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L481-L519)
   opens the named board and sends the player; it does not set
   `g_loadFromStartPrg`. Thus once the startup script returns
   normally, the subsequent GAM-initial-board branch remains
   eligible. A script may use more advanced control flow that
   changes the outcome; that is outside this bounded slice.
6. **Load during startup is different.**
   [rpgcode/functions.cpp lines 3125–3138](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L3125-L3138)
   calls `loadSaveState(...)` and sets
   `g_loadFromStartPrg = true`. The flag is declared in
   [winmain.cpp line 83](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L83),
   and suppresses the normal initial-board branch.
   [common/state.cpp lines 72–166 and 285–315](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/state.cpp#L72-L315)
   clears/restores global variables, party, main file and saved
   board location. This is **save restoration**, not normal startup
   variable persistence.
7. **Native Reset is a new setup lifecycle.**
   [winmain.cpp lines 407–432](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L407-L432)
   frees global variables and returns to setUpGame.

## Implemented browser subset

The optional **Run GAM startup + play** action:

- Uses the existing `mainFileBindings` resolver and the GAM embedded
  **in the uploaded archive**, not a filename selected in JavaScript.
- Decodes the uniquely resolved startup PRG through `readArtifacts`,
  validates **the entire script** with the existing
  `compileTk3Interaction`, and executes it against a **new**
  in-memory session. Only synchronous scalar assignment and
  `if/else` (with existing supported expressions) are allowed.
- After successful normal completion, opens the same source
  `buildPlayableScene` as the direct path, injecting the returned
  session into the existing generic placed-item dialogue runtime.
  No game-specific variable or script checks are in runtime code.
- A **missing, ambiguous, invalid, or unsupported startup**
  receives a visible `path/to/startup.prg:line: explanation`
  without launching an incompletely initialized game. The parser
  and lifecycle scan run **before any assignments**, so an
  unsupported statement after an assignment cannot partially
  initialize a new session. The direct board action remains
  accessible for source diagnostics.
- If the GAM startup field is empty, the action opens the board
  with a clean empty session, matching the native no-script stage.

**Not yet supported:** startup message windows, `wait()`, `Send()`,
`Run()`, `Load()` / saves, plugin functions, includes, player
creation, class/object initialization, virtual-variable parity,
board-entry PRG execution, other RPGCode commands or the full
engine startup system. The browser statically decodes board assets
before running this subset, but mounts the playable board only
after it returns. On this branch, **the existing Reset button**
still resets the currently shown board and clears script variables;
to rerun GAM startup, return to the file viewer and select
**Run GAM startup + play** again. This is a documented difference
from native Reset. The established BSTW title/New and direct-board
paths remain intentionally unchanged and do not execute
BSTW's unsupported startup code.

## Synthetic Lantern Script Lab acceptance

The newly generated `tk3-script-startup.zip` uses:
- `LanternLab.gam` → `LanternLab/Prg/lantern_boot.prg`
- `lantern_boot.prg`: `lantern_ready = 1`
- `LanternLab/Boards/twilight.brd` with Nia and a placed
  Lantern whose activation resolves to
  `LanternLab/Prg/lantern_answer.prg`
- `lantern_answer.prg`: `if (lantern_ready == 1)`
  shows the startup-lit message; otherwise it shows a
  distinct direct-launch message. Both branches use source-owned
  `mwin()`, `wait()`, and `mwinCls()` commands.

**Browser test A (normal startup):** download the Lantern ZIP on
Game Explorer → upload it → **Run GAM startup + play** →
verify `lantern_ready = 1` appears in the variable display →
approach **Lantern · TALK**, complete the message →
verify the text says startup lit the lantern.

**Browser test B (diagnostic direct launch):** Back to viewer →
**Play opening board (direct)** → the variable panel is empty →
Talk to the same lantern → the message instead says startup
was skipped. Reopen with startup to confirm a fresh session.

**Error-path regression:** a variant containing a supported
assignment followed by unsupported `Run()` or `Load()` must
report its exact startup PRG and offending line, and must
not expose partially initialized variables. Negative variants
also cover missing/ambiguous startup files. No original TK3
game archive or original BSTW bytes are in Git or CI.

[Production synthetic ZIP regression](../../scripts/check-tk3-startup.mjs)
executes archive → GAM → startup resolver → PRG → interpreter →
placed object with original paths and values from the ZIP.
Existing Harbor ending, Grove first/repeat, BSTW title/inn,
Toolkit regressions and Pages import-closure are independent
tests. Native-editor execution and real-game compatibility
are **not** established by this synthetic regression.
