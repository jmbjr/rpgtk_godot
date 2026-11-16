# Toolkit 3.1 source fight/victory compatibility bridge

Tracks [#92](https://github.com/jmbjr/rpgtk_godot/issues/92) and the independent TK3.10 demo on its second board.

## Native source contracts, pinned revision

[Toolkit source revision 9191b919](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead):
- [fight.cpp: runFight](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/fight/fight.cpp#L729-L860) parses the ENE enemy, loads the BKG, and **delegates fight resolution to the configured fight plugin**. Toolkit itself applies the enemy-authored victory RPGCode after a `FIGHT_WON_AUTO` outcome; it also awards XP/gold via its separate reward path.
- [fight.h](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/fight/fight.h#L55-L61) distinguishes automatic/manual run/win and lost outcomes.
- [common/enemy.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/enemy.cpp#L45-L109) decodes the referenced victory and escape program names from the actual ENE source format.
- The owner's local demo, inspected read-only, contains `demo/Prg/man.prg` with `mwin` / `wait` / `mwincls` / `fightEnemy("pirate.ene", "bkg.bkg");`, `demo/Enemy/pirate.ene` with enemy name Pirate Bob and `win.prg` referenced, and `demo/Prg/win.prg` with `mwin("Arr, ye beat me!"); wait(); mwincls(); eraseItem("source");`. These originals never enter the repo.

## What this PR does

The pure generic RPGCode interpreter now recognizes the **actual** `fightEnemy("name.ene", "name.bkg")` syntax as a suspension point, and `eraseItem("source")` as a validated side-effect request. A pure battle bridge resolves the ENE and BKG from the **same archive root**, checks ENE source attributes and the uniquely resolved victory PRG, then compiles the victory PRG before offering a test outcome. Unsupported or ambiguous references report the calling script's path and line. Variables remain in one script session.

**No native fight simulation is claimed.** The browser displays an explicit **Simulate victory (test only)** control, plus **Cancel test (no victory)**. Only clicking Simulate resumes the source program with its exact ENE-provided victory PRG, and it resumes the parent RPGCode program afterward. A resolved `eraseItem("source")` clears the item that initiated the fight from the current board's visible scene, Talk selection and visual markers. Fresh launch/Reset restores it; erased item state persists across supported `Send()` remounts of the same session. The browser deliberately **does not** compute attacks, run `tk3fight.dll`, grant GP/XP, simulate game-over, or select outcomes automatically. Threads, `itemPath`, pathfinding and pirate NPC pursuit are separate. User must approach the pirate manually.

Other RPGCode, BSTW title/inn/clues/menu/Q, Harbor/Grove/Lantern, and Pages closure remain unchanged. Missing or unsupported win script paths do not cause a fake victory.

## Synthetic and original acceptance

[Source-owned test](../../scripts/check-tk3-fight-bridge.mjs) generates two independent native Harbor/Grove ZIPs with distinct actors, placed items, enemy filenames, battle backgrounds, win PRGs, variables, and message texts. Uses the production archive/BRD/ITM/PRG/ENE/BKG decoder. Verifies pre-fight `wait`, source fight suspension, explicit win/abort, exact victory script, `eraseItem("source")` source slot/board, nested interpreter continuation, reset, missing/ambiguous ENE or background, and unsupported win syntax. No original assets in CI.

Optional read-only original demo production-JS test:

    node scripts/check-tk3-fight-bridge.mjs "/path/to/demo_tk310_start_board_playable.zip"

Checks the original **Pirate Bob** ENE/BKG and `win.prg` sourced from the owner archive, without committing it. No manual native editor/browser acceptance is claimed by CI.

**Desktop/Android after merging:** upload the same test demo ZIP → Play opening board (direct) → enter door trigger to `out.brd` → walk toward the stationary pirate until Talk activates → Talk shows pirate's original pre-fight text → press Next → inspect the labelled source enemy → tap **Simulate victory (test only)** → press Next → see authored `Arr, ye beat me!` message → Finish → confirm pirate disappears and cannot be talked to again. Reset restores original state. This confirms source script compatibility, **not actual combat playability**.
