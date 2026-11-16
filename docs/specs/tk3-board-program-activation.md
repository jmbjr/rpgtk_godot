# Native BRD 2.4 program activation and game-owned HUD

Tracks [issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92).
The independent TK3.1 demo supplied by the owner is read-only, not a
repository fixture. The source-owned Harbor and Grove archives exercise
all new capabilities in CI.

## Verified native semantics

Exact pinned Toolkit 3.1 revision:
[9191b9191c9bda0998c6faae16929b3331ed2ead](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).

- [board.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L358-L395)
  reads stored BRD program filenames, activation flags, layers and
  authored vector polygons separately from placed item sprites.
- [board.h](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.h#L55-L86)
  defines `PRG_KEYPRESS=1`, `PRG_REPEAT=2` and
  `PRG_STOPS_MOVEMENT=4`.
- [CSprite::programTest](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L1547-L1669)
  checks the player's authored collision base against program
  vectors on the same layer. A one-time step program triggers on
  entry, while a keypress program waits for the configured
  activation key. Toolkit checks if the file exists as a PRG;
  otherwise it runs the *contents of the board field as RPGCode*
  using `CProgram::loadFromString`.

The browser now resolves both ordinary PRG references and inline
BRD source strings with its existing archive resolver/interpreter,
and uses its **existing transactional Send() scene transition**.
The following are deliberate, explicit limits:
- A **point-in-polygon actor foot point** approximates Toolkit's
  full sprite collision-base intersection. Same-layer checks and
  exact source polygon bounds are preserved.
- Only unconditional, closed polygons with step/keypress flags
  are executable. Native repeat-distance/conditional activation,
  other flags, and open/invalid polygons remain diagnostics.
- Step-on is automatically detected on movement *entering* a
  polygon, not by pressing Talk. Keypress regions use Talk/E/Space;
  the native activation-key mapping is only approximated by
  existing browser controls.
- Inline source is parsed by the same small RPGCode subset;
  an unsupported command reports the BRD path, program slot and
  original script line rather than inventing its effects.
  Source .prg references must be uniquely resolved. Missing
  references are not guessed.
- The source code parser now accepts optional trailing semicolons
  in the supported one-statement-per-line grammar. Multiple
  statements on one line are still not supported.

## Independent original demo checkpoint

The uploaded diagnostic copy `demo_tk310_start_board_playable.zip`
(SHA-256
`367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f`)
uses native GAM 2.9, BRD 2.4, TEM 2.8 and ANM 2.3.
The owner's screenshot confirms the opening `start.brd`
renders and Bob moves at (221,293,layer 1).

**Read-only source bytes identify one BRD program** at
`demo/Boards/start.brd`:
- Source: `send("out.brd", 112, 192, 1);`
- Vector: (283,305), (327,305), (327,322), (283,322), closed
- Layer: 1; activate: unconditional; activationType: **0** (step-on)
- Destination: `demo/Boards/out.brd`, player (112,192,layer 1)

The visible door is therefore **not an ITM Talk target**.
Walk into the marked cyan BOARD · STEP rectangle to trigger
the source transfer. The existing actor/object interaction
`demo/Prg/oldman.prg` contains four `mwin(...);` lines and
`wait();`; these should now display using the generic
message/Next controls. The outside board's pirate behavior
still needs thread/pathfinding/combat support; this change
does not make the entire independent demo completable.

## HUD and UI separation

The old imported board renderer unconditionally displayed
BSTW's `Clues: 0 / 13 · Inn visits: 0` and a missing-inn
warning for **every** imported game. These are not TK3
engine concepts. The HUD is now hidden unless the archive
actually defines a supported source clue state, or the
known BSTW inn adapter is selected by its resolved source
link. A source clue system uses its actual `maxclues`
and `clues` session variables; only a real inn source link
shows an inn visit count. Independent demos show neither
the fabricated 13 nor a missing-inn warning. Script
variables remain visible.

Cyan program polygons and BOARD · STEP/BOARD · TALK
markers are inspection overlays, not new game art or
native collision changes.

## Verification

[Source-owned test](../../scripts/check-tk3-board-programs.mjs):
two different synthetic native ZIPs → native BRD byte decoder
→ board-program vector → supported step or keypress activation
→ semicolon RPGCode → `Send()` to archive-resolved board and
archive-authored coordinates. Also tests wrong layer, boundary
inclusion, repeat prevention, missing/conditional/unsupported
programs, and original source path/line diagnostics.
Existing BSTW/Harbor/Grove/Lantern/main-menu/Toolkit and
Pages-closure checks run in the same CI.

An optional **SHA-gated read-only** test takes the owner's local
demo ZIP and validates the original activation rectangle, transfer
and `oldman.prg` without sending it to GitHub:

    node scripts/check-tk3-board-programs.mjs "/path/to/demo_tk310_start_board_playable.zip"

Desktop/Android acceptance: upload the demo ZIP → Play opening
board (direct) → speak to old man and read four source messages →
walk inside the **cyan BOARD · STEP area** near the house entrance
→ verify arrival on `out.brd` with Bob at (112,192,layer 1).
Repeat BSTW title/inn and synthetic Harbor/Grove interactions.
No original browser run, native editor run, or complete
demo ending is claimed by CI.
