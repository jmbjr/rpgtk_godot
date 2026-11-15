# Toolkit 3 — first reusable archive-driven RPGCode interaction

[Issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92) ·
[BSTW roadmap](bstw-playability.md).

This deliberately bounded interpreter runs only the small RPGCode subset
listed below, from **resolved BRD item activation programs**. It is not
a general Toolkit 3 engine and does not replace the preexisting BSTW
title and locked-inn adapters.

## Evidence from pinned Toolkit 3.1 source

Exact upstream commit:
[9191b9191c9bda0998c6faae16929b3331ed2ead](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).

- [CSprite::programTest, L1410–1530](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L1410-L1530):
  the native runtime checks item activation on the player's layer,
  requires conditions and vector geometry, and runs the board item's
  named activation program from its PRG folder. It does not derive
  a program from the ITM filename.
- [lex.txt](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/lex.txt#L45-L200),
  [yacc.txt](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/yacc.txt#L135-L545):
  identifiers are case-insensitive; # prefixes are ignored, and
  `=`, `==`, `+`, braces, function-style `if(...)` and `else` are
  recognized. Newlines terminate statements.
- [functions.cpp L402–477](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L402-L477):
  `mwin(str)` appends to the message window; `wait()` blocks
  for input; `mwinCls()` clears and hides the window.
- [CProgram.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp)
  implements `operators::assign`, `operators::eq`,
  `operators::add` and the built-in `if/else` branch;
  [CProgram.h](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.h)
  sets a missing variable to a numeric zero stack frame.

**What is verified:** upstream source semantics and the archive format
chain. Native editor/runtime execution has **not** been performed.

## Intentionally small supported language

One statement per line, curly braces on **separate lines**.
Whole-line `//`, `*` and `/*` comments, and an optional `#`
prefix on commands. Case-insensitive variable and function names,
scalar numeric/string literals, variable reads, `+` with whitespace
around the operator, exact equality `==`, and basic `if/else`
branches. Statements supported:

    if (visited == 0)
    {
      mwin("First visit")
      wait()
      mwinCls()
      visited = 1
    }
    else
    {
      mwin("Welcome back")
      wait()
      mwinCls()
    }

Only literal quoted strings are supported as `mwin` arguments in
this first slice. Multiple consecutive `mwin` calls append lines.
`wait()` yields script execution to the UI, where E/Space or
a Talk/Next/Finish button resumes it. `mwinCls()` clears
the current message. Scalar variables persist during one board
session; Reset or a new Play/New mount clears them.

The compiler parses and validates **every statement, including
unreached branches, before executing anything**. Unsupported
syntax/commands display the real program path, 1-based source
line and the unrecognized statement. It never silently skips
unfamiliar behavior. Limits: 300 source lines, 8 brace levels,
1,000 execution steps per resume. This is a documented subset,
not an assertion of full Toolkit coercion/string/window behavior.

**Unsupported:** arrays, `++`, `>`, nested calls in expressions,
user methods/objects, `#include`, `send`, generic function calls,
plugins, sound/graphics/portraits, board transitions, saves,
native RPGCode error recovery and any external file execution.

## Source-driven activation versus native Toolkit activation

[Pure interpreter and selector](../../tk3-script-slice.mjs).
The actual production `readArtifacts → buildReferences →
buildPlayableScene` pipeline supplies the decoded BRD placements,
ITM and PRG resolutions and script rows. The selector uses the
**nearest uniquely resolved program placement** within an
inclusive 46 source-pixel Euclidean radius, **same layer**,
breaking distance ties by stored zero-based slot. Unresolved
and ambiguous program links are ineligible. It does not
choose a program by an item's name or any fixture/game ID.

The 46px range, key binding, line-of-sight omission,
program activation eligibility (besides reference resolution),
ignoring native activation polygons, and touch UI are **browser
policies**, not editor fidelity. Both fixtures deliberately save
unconditional keypress-style activation records. The established
BSTW `mwininn.prg` selection is reserved for its **existing**
first/repeat clue-and-cooldown adapter, as that script needs
additional language and helper support. The BSTW title adapter,
movement, artwork and synthetic sandbox remain unchanged.

During a script's `wait()`, all movement input pauses. The
existing dialogue panel shows the archive's own words;
a separate status shows live script variable values and any
source-linked errors. Each fresh session starts empty.

## Independent source-owned test ZIPs

[Fixture source](fixtures/tk3-script-interaction-fixtures.mjs).
Both ZIPs are built from synthetic native GAM 2.9, BRD 2.4,
TEM 2.8, ITM 2.7, ANM 2.3 and indexed TST fixtures, with
**different named files, character names, placements, scripts,
variable names and dialogue**.

| | Lab A (Harbor) | Lab B (Grove) |
| --- | --- | --- |
| ZIP | `tk3-script-harbor.zip` | `tk3-script-grove.zip` |
| Character | Mira / `mira.tem` | Orio / `orio.tem` |
| Board | `HarborLab/Boards/wharf.brd` | `GroveLab/Boards/meadow.brd` |
| Item | `dockbell.itm` | `oakidol.itm` |
| Position | (40,42,L1) | (67,43,L1) |
| PRG | `HarborLab/Prg/bell_greeting.prg` | `GroveLab/Prg/oak_whisper.prg` |
| Session variable | `bell_seen` | `oak_visited` |
| Text | Harbor bell first/repeat | Old oak first/repeat |

**Browser acceptance for each ZIP:** download its ZIP using
the new links on the Game Explorer home page → upload ZIP →
**Play opening board (direct)** → walk to the teal **TALK**
marker → Talk to object → read its archive-supplied first
message → Next / Finish → confirm the named script variable
now equals 1 → Talk again → read a **different** repeat
message → Next / Finish → Reset → verify variable panel is
empty and first message returns. Do this independently for
both Harbor and Grove.

[Check script](../../scripts/check-tk3-script-slice.mjs)
builds both ZIPs in memory, opens each via the **production**
archive loader, decodes artifacts/graph/scene, selects a real
placed-item PRG, compiles/steps first and repeat branches,
tests resets/wrong layers/out-of-range and verifies unknown
syntax reports the PRG path and source line. Existing
Toolkit conformance, synthetic sandbox, BSTW title and inn,
Pages import-closure and 57-row format audit still run in CI.
The GitHub Pages site ships only **synthetic ZIPs**.

## What the new subset covers in BSTW mwininn.prg

The original, unmodified source `BSTW/Prg/mwininn.prg`
was inspected read-only from the owner ZIP (SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`):

| Native source line(s) | Coverage |
| --- | --- |
| 1–2 `#include("CMwin.prg")` etc. | Not supported: includes |
| 4 `innDelta = getTickCount() - LastinnTalk` | Assignment yes, function call and subtraction no |
| 8 `if(innDelta > ItemTalkThreshold)` | `if` yes, relational `>` no |
| 11 `if(checked[einn] == 0)` | Equality yes, indexed arrays no |
| 14–41 and 48–73 `theMwin->...` | No custom objects/SetTxt/portraits |
| 42 `clues++` | No postfix increment |
| 43 `updateClues(...)` | No custom calls |
| 76 `LastinnTalk = getTickCount()` | No runtime tick function |
| 77 `checked[einn]++` | No indexed variables or increment |

The previously merged BSTW inn adapter continues to cover
its source-derived first/repeat dialogue and 500ms cooldown,
**without** claiming to execute this original script.
