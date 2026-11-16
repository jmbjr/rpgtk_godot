# Source-verified Toolkit 3.1 defeat handling (test outcomes only)

Relates to [#92](https://github.com/jmbjr/rpgtk_godot/issues/92). The
generic TK3 migration audit is [#113](https://github.com/jmbjr/rpgtk_godot/issues/113).

## Pinned engine behavior

[Toolkit 3.1 pinned fight.cpp, lines 827–855](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/fight/fight.cpp#L827-L855):
the configured battle plugin returns an outcome. Toolkit defines
`FIGHT_LOST=4` in
[fight.h](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/fight/fight.h#L55-L61).
When the outcome is `FIGHT_LOST`, **no victory rewards or
enemy win program are applied**. If the active GAM's
`gameOverPrg` is empty, native Toolkit displays
`Game over.` and invokes `reset()`. Otherwise it runs
that GAM-configured RPGCode program.

## Implemented browser policy

A new, clearly labeled **Simulate defeat (test only)** button
joins the existing simulated victory and cancel choices. It is
an explicit testing command, **not** damage calculation, random
AI, plugin emulation, native combat, or an assertion that a
character lost.

The pure `simulateTk3FightDefeat` routine reads the **actual
decoded GAM configuration** selected for this scene, using the
same source-rooted archive resolver as other PRGs. It never
uses a demo, character, enemy, or game-specific name.

- No GAM game-over program: close the active encounter without
  running win/escape scripts or deleting items. Show a Game Over
  panel and **Restart opening board** control. Restart creates a
  fresh playable session on the archive's GAM-selected opening
  board and resets variables, flags and erased items. This is an
  explicit browser approximation of native `messageBox` +
  `reset()`; the original title or startup is *not*
  implicitly executed by direct board play.
- Configured, uniquely resolved, supported game-over PRG:
  discard the interrupted encounter program and execute that
  PRG with the existing bounded interpreter (including
  `mwin`, `wait` and variable writes). A completed program
  exposes a restart option; no subsequent automatic native
  reset is guessed. Unsupported script statements produce
  their real program path and line.
- Missing, ambiguous, invalid or undecodable GAM-bound PRG:
  show a path/line diagnostic rather than silently presenting
  native defeat, executing an unrelated program or faking
  the desired ending.

Movement and Talk are paused during the explicit game-over
panel. Reset/restart creates a fresh session. Victory, cancel,
defeat and game-over script paths have distinct outcomes.

## Original demo and regression

The owner's existing **read-only** patched TK3.10 demo ZIP has
an empty GAM game-over program field, so the no-script default
applies. The original ZIP, Windows DLLs and assets remain out
of GitHub and CI.

[check-tk3-fight-bridge.mjs](../../scripts/check-tk3-fight-bridge.mjs)
uses two independent native synthetic game archives. Each
exercises a no-config Game Over, a **different GAM-configured
game-over PRG** with its own source dialogue and variable,
unresolved game-over PRG, unsupported game-over command,
and confirms no accidental victory flag/reward/item removal.
It also preserves original simulated-victory, cancel, binary
and text ENE/BKG, full Toolkit and Pages checks.

**Manual desktop/Android acceptance after merge:** upload
the existing demo ZIP → Play opening board (direct) → enter
the authored doorway → approach the stationary pirate →
Talk → Next → **Simulate defeat (test only)** → Game Over
panel → **Restart opening board** → verify Bob returns to
`start.brd` with the original objects and no previous
session variables. On a source-owned Script Lab game with a
GAM game-over PRG, confirm its authored text/variables run
rather than the default panel until the script completes.

The comprehensive generic TK3 audit in #113 is a **separate
architecture task**. This PR does not move, rename or enable
any BSTW-specific adapter.
