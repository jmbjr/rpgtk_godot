# Historical first interaction slice report

Preserved from main `527e0cd` before the shared language/title expansion.
This is historical evidence, including descriptions of adapters already removed
from production. It is not the current support list. See
[Shared Toolkit 3 RPGCode runtime](tk3-script-interaction.md) for current behavior.

---

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
user methods/objects, `#include`, generic function calls,
plugins, sound/graphics/portraits, arbitrary board transitions, saves,
native RPGCode error recovery and any external file execution.

## Source-driven activation versus native Toolkit activation

[Pure interpreter and selector](../../tk3-script-slice.mjs).
The actual production `readArtifacts → buildReferences →
buildPlayableScene` pipeline supplies the decoded BRD placements,
ITM and PRG resolutions and script rows. The selector uses the
**nearest placed item with a resolved ITM and a uniquely resolved PRG** within an
inclusive 46 source-pixel Euclidean radius, **same layer**,
breaking distance ties by stored zero-based slot. Unresolved
and ambiguous program links are ineligible. It does not
choose a program by an item's name or any fixture/game ID.

The 46px range, key binding, line-of-sight omission,
program activation eligibility (besides reference resolution),
ignoring native activation polygons, and touch UI are **browser
policies**, not editor fidelity. Both fixtures deliberately save
unconditional keypress-style activation records. The generic selector itself does **not** inspect game names, script names,
or the BSTW inn flag. The browser interaction dispatcher retains the
existing BSTW inn adapter's priority whenever the uniquely resolved
inn is in range; the generic selector can otherwise handle source-backed
placements without game-specific checks. A missing ITM is not treated
as a live script-bearing object even when its BRD program edge resolves.
The established
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
| Position | (78,45,L1) | (67,43,L1) |
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

## Follow-up: source-verified Send() and two-board Harbor ending (#92)

Pinned Toolkit 3.1 source:
[revision 9191b919](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).

- [functions.cpp lines 481–519](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L481-L519):
  `Send("filename.brd", x, y, [layer=1])` first opens a board from
  the game's Boards folder, casts x/y to integers, calls
  `coords::tileToPixel` with the **destination** board coordinate
  type, and sets the player's position and layer.
- [coords.cpp lines 42–73](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/board/coords.cpp#L42-L73):
  absolute pixel coordinate type 4 leaves x/y unchanged. Ordinary
  orthogonal tile type 0 converts one-based tiles and adds a base
  point, which this browser slice does **not** implement.
- [CProgram.cpp lines 1855–1875](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp#L1855-L1875):
  the program continues its instruction loop after a valid `Send()`;
  `Send()` does not terminate the current script. Scalar variables
  retain their values during the board change.

Fixture syntax, authored in the first-board PRG:

    bell_seen = 1
    Send("beacon.brd", 19, 27, 1)
    harbor_arrived = 1

The fourth layer argument is optional and defaults to 1. The browser
accepts one literal `.brd` basename within the current game's
`Boards/` directory; numeric scalar arguments and supported expressions
are truncated toward zero like native Send. Only type 4 destination
BRDs (orthogonal absolute-pixel coordinates) are playable.

**Deliberate browser policy:** unlike Toolkit, which displays a warning
and substitutes 32 for an out-of-range coordinate, the browser rejects
out-of-bounds positions, invalid layers, unsupported boards, missing
or ambiguous target paths, and positions incompatible with the browser
9px collision circle. It keeps the *old scene* playable, preserves
variable writes already executed in the script, and displays a
`path/to/script.prg:<line>: Send(): reason` diagnostic. The pure
[Send bridge](../../tk3-board-transfer.mjs) reuses
`resolveAsset` and `buildPlayableScene`. On success, the current
script's instruction pointer and variables continue in the new scene.
It does not run destination board-enter scripts, plugins, custom
objects, saves, or any unsupported RPGCode.

**Harbor Lab now has two source-owned native boards:**

| Stage | Source-authored data |
| --- | --- |
| Board A | `HarborLab/Boards/wharf.brd` (Mira at 19,27,L1) |
| Bell | `dockbell.itm` at (78,45,L1), `bell_greeting.prg` |
| State | The first conversation sets `bell_seen = 1` |
| Transfer | `Send("beacon.brd",19,27,1)` in the same PRG |
| Continued script | `harbor_arrived = 1` runs *after* Send |
| Board B | `HarborLab/Boards/beacon.brd`, distinct tile choice |
| Beacon object | `beaconstone.itm` at (78,45,L1), `beacon_ending.prg` |
| Ending | `if (bell_seen == 1)` shows victory; otherwise a different message |

The **Grove Lab ZIP is unchanged**, remaining a one-board
first/repeat story. All game assets and scripts are synthetic and
source-owned.

**Desktop/Android manual path:** download `tk3-script-harbor.zip`
from Game Explorer → upload → Play opening board (direct) → approach
the bell's teal TALK marker → Talk, read the first message, Next/Finish
→ arrive on the distinct beacon board at (19,27,L1) → check both
`bell_seen = 1` and `harbor_arrived = 1` in the variable panel →
walk to the beacon's TALK marker → Talk → see the successful ending →
Next/Finish. Back to file viewer and Play again should start fresh on
the wharf with no variables. The Grove ZIP should still support its
original first/repeat behavior.

**Verification boundary:** synthetic CI exercises full ZIP parsing,
reference resolution, both scenes, Send continuation, endings and
missing/invalid destinations. This does not establish browser/Android
or original Toolkit editor manual acceptance.

## Playtest visibility overlay (Script Lab and imported boards)

The source-owned synthetic GAM/BRD/TEM/TST fixtures contain diagnostic
pixels rather than polished game art. On a desktop, scaling a 3×2
(96×64 pixel) board previously made the character almost invisible
while enlarging and clipping the canvas TALK label.

The play view now provides **Show readable playtest markers**, checked
by default. These HTML/CSS markers are independent of original
artwork, scene mapping, hitboxes and script execution. The gold
**YOU** label follows the source character and cyan **TALK**
labels identify *only resolved same-layer ITM→PRG placements*, named
from the archive. Text stays at a readable screen size instead of
scaling with the source pixel canvas. Right/bottom map positions
anchor their labels left/above to avoid clipping. Compact boards
are capped at 640 CSS pixels wide on desktop, but remain responsive
on Android.

A live hint before the canvas names the nearest eligible object,
its Euclidean source-pixel distance, a simple left/right/up/down
direction and whether the player is inside the existing inclusive
46px Talk range. Direction hints are **not pathfinding** and do
not imply the target is reachable past a wall. Original animation,
tile shading, sprite placements, native collision, input movement,
dialogue, variables and Send() are unchanged. Turn the overlay
off to inspect source artwork by itself. Verbose collision
diagnostics are accessible in an expandable section so Talk
remains close to the board.

**Desktop/Android manual acceptance:** upload the Harbor or Grove
ZIP → Play opening board → confirm **Mira/Orio · YOU** is
unmistakable, **Dock Bell/Old Oak Idol · TALK** stays legible at
the board edge, follow the directional hint into Talk range,
finish the first and repeat dialogue. For Harbor, confirm the
second-board **Beacon Stone · TALK** and successful ending.
Toggle playtest markers off and back on: source art and game
behavior must remain unchanged.

[Playtest-guidance test](../../scripts/check-playtest-guidance.mjs)
opens both source-owned native ZIP fixtures through the actual
archive/graph/scene pipeline and checks display data, marker
anchoring, layer/item eligibility and range hints. CI also
verifies Pages ESM staging, but does **not** replace manual
visual acceptance on desktop/Android.

## Shared GAM startup session

[Startup lifecycle](tk3-startup-lifecycle.md) records the pinned setup order,
global variable lifetime, and browser behavior. Play game invokes the same
project-rooted runtime as Talk, board programs and GAM keys. Included
helpers can show messages, wait, and resume the caller. Board transfers
and labeled encounter tests use the common effect handler. After startup
returns, the GAM opening board receives that session. Reset invokes a
fresh startup, and direct diagnostics skip that invocation.
