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

## Shared browser execution

**Play game** resolves the startup PRG from the ZIP's embedded GAM with
the same typed project resolver used by Talk, BRD programs and GAM keys.
It invokes `startTk3Script` with the archive context. Supported includes
and parameterized helpers therefore compile and execute in startup as
they do in those later entrypoints. Parser diagnostics retain their helper
filename and line. A failed compilation leaves the current player usable
and publishes no new startup session.

Startup can yield dialogue, input waits, board transfers, and the existing
labeled encounter effects. The player resumes each using its common effect
handler. Helper continuation and global variables survive the yields.
Movement and new script triggers wait for the running startup. An empty
startup field creates a fresh ordinary board session.

The browser renders a source-drawn RPGCode screen when `clear`/`text` requests
one; otherwise the configured board is the backdrop for startup dialogue. A startup `Send()` mounts its destination while that script is
running. After normal startup return, the browser mounts the GAM opening
board with the same variables, following the pinned post-startup setup
order above. Reset and fallback Game Over restart create a fresh session
and invoke startup again. Direct diagnostics skip startup.

Failed transfers preserve the current board and show a source diagnostic.
A cancelled encounter ends the active startup script and releases input.
Unsupported commands, player creation, class initialization and save/load
produce source diagnostics. [Authored board-entry execution](tk3-board-lifecycle.md) now follows startup and Send through the same VM.
The [shared language and title services](tk3-script-interaction.md) document
the current grammar, native evidence, browser policies and limits.

## Verification

The generated `tk3-startup-harbor.zip` uses a nested project with a GAM
in `Main/`, two include levels, and nested helper calls. Its startup calls
the same weather helper as the E runtime key. The flat
`tk3-startup-grove.zip` uses a conditional call to a separate helper.
In both archives, Play displays the included helper's message, waits for
input, then returns to the caller. Talk reads the variable set by startup.
Direct diagnostics shows the alternate source-authored response.

Staged Chromium covers keyboard and touch continuation, reset during a
wait, transfer and return to the opening board, missing and unrenderable
destinations, helper diagnostics, startup fight outcomes and fresh restart.
The existing Explorer/media and generic gameplay regressions also run.

The implementer checked the unmodified local
`demo_tk310_start_board_playable(1).zip`, SHA-256
`367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f`.
Its GAM selects `demo/Prg/start.prg`. In staged Chromium, Play now reaches the
original source-drawn title with MIDI. New Game runs the authored intro,
waits for input, and opens the configured board. Old-man Talk, authored Send,
explicit simulated pirate victory/removal, defeat and fresh startup restart
passed. Load remains an explicit unsupported-save diagnostic. No private
archive content was added to Git, CI or Pages. Native Toolkit runtime
acceptance and deployed browser acceptance remain separate from these checks.
