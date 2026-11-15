# BSTW: first playability vertical slice

Evidence report revision **1.2** · [format index](README.md) · [playability issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92).

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

## Next slice: authored-board browser movement (#92, post-#97)

This is a **separate, bounded playable slice**, not a change to the four-gate
static evidence report above. After opening a ZIP in Game Explorer, use
**Play opening board** to enter the decoded GAM opening board directly.
It intentionally skips title-script execution and party initialization.
The app requires a unique decoded GAM 2.9 in the archive, an opening
native BRD 2.4 with orthogonal pixel coordinate code 4, a decoded initial
TEM 2.8, valid board tile lookups and four complete 32×32 ANM → indexed
TST walking chains. Missing, ambiguous or unsupported links disable Play
with a visible explanation; no fallback synthetic board.

**Original BSTW source mapping:** BSTW.gam → BSTW/Boards/start.brd
(20×15×2) and BSTW/Chrs/bruce.tem (spawn **107,78, layer 1**).
BRD tile runs/shades and ambient colors are rendered in source layer order.
The original cardinal walking frames are selected by the native TEM/ANM/TST
chain, with the source ANM pause (0.15 s for BSTW), transparency key and
32×32 pixels. The actor is composited after its stored layer and before higher
layers. The preview uses a **foot/center anchor** at source pixel coordinates
(x−16, y−32 for a 32px sprite); exact Toolkit anchor equivalence is
unverified. Placed ITM sprites, board images, lights and scripts are **not**
rendered or executed in this PR.

**Declared collision policy:** reuse the synthetic movement stepper with
a **9-source-pixel circular actor, 112 pixels/s, normalized diagonals,
4px maximum swept substeps, axis-separated movement, 50ms frame-delta
cap**, but with **only outside-map bounds solid**. The nine BSTW native
vector records and their attributes/closed flags remain *static evidence*;
their blocking semantics are not verified. Walking may cross obstacles
drawn on the original tiles. Spawn/layer are checked within map bounds;
all four cardinal directions are step-tested. This is neither an assertion
of native collision parity nor an RPGCode interpreter.

The sandbox at [sandbox.html](../../sandbox.html) remains a testable,
self-contained synthetic board including its established solid-tile collision
and first/repeat inn dialogue. The imported board has **no inn activation**.
Movement uses the same keyboard **WASD/arrows** and held/tap mobile D-pad
input semantics; **Reset** returns to the stored spawn.
All archive files remain browser-local and are never uploaded, staged, or
included in CI.

**Testing:** [synthetic scene acceptance](../../scripts/check-playable-scene.mjs)
covers GAM mapping, source board runs/layers, four ANM/TST chains,
all cardinal movements, bounds, missing assets, unsupported coordinates,
invalid spawn, missing/invalid frames and UI entry points. It is included
in Pages CI alongside the existing sandbox, Toolkit 2/3 and staged
ES-module closure checks. An optional read-only, SHA-gated check can run
on a local copy of the owner's original game:

    node scripts/check-playable-scene.mjs "/path/to/BSTW_EXPO_DEMO (1).zip"

**Android acceptance:** open the deployed Game Explorer → select the
local BSTW ZIP → tap **Play opening board** → inspect Bruce at (107,78)
on start.brd → use each D-pad direction → use Reset and Back to viewer.
Browser visual/touch acceptance remains manual until the owner tests it.

## Authored placed-item visibility and inn locator (post-#98)

This slice retains the imported opening board and bounds-only walking from
PR #98. It uses **each native BRD 2.4 sprite record** with its original
zero-based slot, ITM filename, pixel position, layer and activation-program
reference. `mapBoardPlacements` follows the existing resolved reference
graph from BRD → ITM 2.7 → first suitable ANM 2.3 → indexed TST 20
or TBM 3.0 → TST 20. No item scripts or sprite movement run.

The native [CItem::open at the pinned Toolkit 3.1 revision](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CItem/CItem.cpp#L76-L103)
sets **South (MV_S)** as the initial animation. The preview therefore uses
the first nonempty stored frame of the South animation; if that frame is
unavailable, it tries authored Rest and Idle South, in that order. Each
image uses its frame's transparent-color key. Supported TST frames and
TBM-composited multtile frames render in original pixel dimensions
(e.g. house 96×96). This is a **frozen initial-frame preview**, not a
simulation of item idle timing, facing changes or moving item scripts.

A placement is recorded even if its **ITM** file is absent or
unreadable, its **artwork** is missing, partial or unsupported, or its
activation **PRG** is missing. ITM resolution and artwork resolution have
separate statuses in the expandable play-view placement diagnostics.
Missing artwork uses a small square position marker rather than
preventing movement or replacing the board. Invalid layer data also
remains diagnosable; no unsupported layer is silently assigned.

### Source coordinate and draw policy

Pinned Toolkit runtime source:
- [Board loader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L397-L440) reads sprite x/y/layer and calls `setPosition` with absolute pixel coordinates.
- [CSprite::render](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L2053-L2124) anchors 2D artwork at x−floor(width/2), y+1−height; the +1 offset is explicit in native source.
- [renderNow](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/render/render.cpp#L487-L551) draws sprites per layer with higher board layers over lower sprites.
- [spriteCollisions / z-order](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L1080-L1175) uses collision-base geometry. That full dynamic sorting **is not reproduced**: this browser slice uses a deterministic same-layer Y, X, then source-slot ordering for items and Bruce. It does not evaluate conditional loading variables, native sprite bases or under-vectors.

**Read-only original ZIP inventory (not an embedded fixture):**
`start.brd` stores seven layer-1 placements: slot 0 Lami at
(82,200), slot 1 Rusty (432,228), slot 2 Jim (590,55),
slot 3 inn door (207,349), slot 4 another door (512,414),
slot 5 another door (495,223), and slot 6 Loyalis (115,115).
All seven initial South ANMs resolve to supported 32×32 indexed TST
artwork. The 96×96 TBM compositor is tested synthetically for
other native objects; `house_3x3.itm` is **not** placed on this
opening board.

**Inn:** The diagnostic yellow `INN DOOR` marker is selected
**only** when a placed sprite's board activation-program edge actually
resolves to the decoded `mwininn.prg`. A generic `door.itm` name
or another door's activation program cannot qualify. In the owner's
BSTW ZIP, source-backed expectation is slot **3 (zero-based)** at
**(207,349), layer 1**. If multiple matching resolved programs exist,
the locator reports ambiguity instead of picking one. This is a
**locator only**; no Talk/activation, dialogue or clue updates are
connected to the imported scene.

The bounds-only collision policy remains unchanged. Only the imported
local ZIP supplies original artwork; no artwork or game binaries ship
with Pages, Git or CI. The synthetic movement/inn sandbox is unchanged.
The [new test suite](../../scripts/check-placed-sprites.mjs)
covers first-frame TST/TBM mapping, missing/unreadable ITM,
missing artwork with successful play, two distinguishable doors,
resolved-program identification, ambiguous scripts, source anchor and
layer/Y ordering. An optional SHA-checked original-ZIP assertion uses
the existing production decoder, but cannot run in CI without
violating the archive separation rule:

    node scripts/check-placed-sprites.mjs "/path/to/BSTW_EXPO_DEMO.zip"

**Android test:** upload BSTW → **Play opening board** → walk Bruce
past the placed characters → find the marked inn door and verify the
diagnostics show slot 3 at (207,349), layer 1. The mark does not activate
the door. Visual and touch acceptance must be checked on the deployed
page by the owner.

## Imported BSTW inn conversation (#92, after item placement slice)

This slice uses **only** the uniquely resolved native BRD sprite activation
reference to `mwininn.prg`, following the existing
[placed-sprite mapping](../../placed-sprites.mjs). It does not dispatch to
RPGCode. A door filename alone does not identify the inn. If no target
resolves, the reference is missing, or multiple targets resolve, **Talk is
unavailable**. The real owner sample has exactly one valid target:
**start.brd sprite slot 3 (zero-based), door.itm, at (207,349), layer 1**;
the other two door.itm placements do not activate this adapter.

**Activation geometry is a documented approximation**: the same inclusive
**46-source-pixel Euclidean distance** as the synthetic sandbox, measured
between Bruce's current authored pixel origin and the door's stored pixel
origin, with a mandatory **same-layer** check. No native item activation
base polygon, line of sight or blocking vectors are interpreted. The
source's native `mwininn.prg` link determines *which* door is eligible;
its source code is not executed. Bounds-only movement and the source
artwork/layer/depth policy from the previous slices remain unchanged.

**Controls and state:** approach the marked inn door on its layer, then
press **Talk** on touch (or **E / Space** outside a focused button).
The button becomes **Next line** and finally **Finish conversation**.
Bruce cannot move while the conversation is open. The imported runtime
uses the same deterministic
[dialogue adapter](../../experiments/movement-sandbox/inn-dialogue.mjs)
and newly authored paraphrases from [#96](inn-dialogue-adapter.md);
first visit has four lines and awards one clue **only upon completion**.
Repeat visits have three lines and never award another clue.
The cooldown is **strictly elapsed milliseconds > 500**, measured from
the completion of the previous conversation (equality is rejected).
Browser `performance.now()` is the source-owned monotonic test clock,
not a claim of Toolkit 3 tick-clock parity. HUD shows clues (maximum 13)
and inn visit count. **Reset** restores Bruce's stored spawn and clears
dialogue, clue notification, clues, visits and cooldown. Every new
Play mount creates a fresh in-memory state.

Tests in [check-imported-inn.mjs](../../scripts/check-imported-inn.mjs)
cover the synthetic BRD→ITM/PRG inn reference, other door separation,
wrong-layer and 46px boundary gating, unavailable/ambiguous activation
references, complete first/repeat dialogue, the strict 500ms cooldown,
one-time clue, Reset/new state, and UI keyboard/touch controls. Pages CI
also checks the staged imported-inn module closure, existing sandbox,
Toolkit file-format regressions and the historical coverage checks.
The optional local SHA-gated production-JavaScript check on the owner's
original ZIP verifies the configured real scene and unique door, not
manual canvas/touch behavior:

    node scripts/check-imported-inn.mjs "/path/to/BSTW_EXPO_DEMO.zip"

**Android acceptance:** upload BSTW → Play opening board → approach the
marked inn → finish the first conversation → confirm **1/13 clues**
and **one visit** → allow strictly more than 500 ms after completion →
repeat three lines → confirm clue count remains **1** and visits become
**2** → Reset → confirm **0/13** clues and zero visits.

**Not implemented:** automatic activation, other door scripts, the actual
locked door opening, title execution, original RPGCode, COM plugins,
saves, board transitions, vector hitboxes or exact Toolkit collision.
The separate source-owned `sandbox.html` inn remains testable and unchanged.
No original game ZIP, music, art, binaries or DLLs are placed in Git or CI.

## Native BRD 2.4 vector collision subset (#92)

**Pinned source, read, not inferred from vector counts:**
- [Toolkit 3.1 board loader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L329-L356) decodes point lists, raw attributes, a nonzero closed flag, layer and numeric tile type.
- [Tile-type constants](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/board/conversion.h) define `TT_SOLID=1`, `TT_UNDER=2`, `TT_UNIDIRECTIONAL=4`, `TT_STAIRS=8` and `TT_WAYPOINT=16`.
- [Native boardCollisions](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L934-L1078) ignores `TT_UNDER`, filters by sprite layer, intersects board `CVector` with the *player's authored collision-base polygon*, and tests the `TT_SOLID` bit for movement blocking. Its unidirectional check is commented out; stair vectors can change layers. Actual Toolkit sliding uses vector and movement angles (not our axis-separated slide).
- [Native CVector::contains](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CVector/CVector.cpp#L195-L284) tests subvector intersections even when the shape is open, and additionally tests point-in-polygon for **closed** shapes. Closed means any raw nonzero flag, including VB `-1`.

**Owner's original BSTW ZIP** (`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`),
independently decoded from the binary prefix of `BSTW/Boards/start.brd`:

| Slots | Native flags | Policy |
| --- | --- | --- |
| 0–2 | `type=2` (`TT_UNDER`), `layer=2`, `closed=-1`, `attributes=0` | No player blocking. Under/overdraw effects are not implemented. |
| 3–8 | `type=1` (`TT_SOLID`), `layer=1`, `closed=-1`, `attributes=0` | Six valid closed polygons, eligible to block Bruce on layer 1. |

No *open* solid occurs on this real board, but synthetic fixtures test a
two-point open `TT_SOLID` polyline. All six BSTW solid polygons have
valid geometry. The stored spawn **(107,78,L1)** lies outside the six
solid walls under the browser's **9px-radius circle** approximation.
The inn is at **(207,349,L1)** on the lower boundary of the large
solid rectangle (slot 3; corners 97,193 and 318,350). The walkable
south approach includes **(207,370,L1)**, within the existing **46px**
Talk range. Blocking should stop Bruce from entering the inn building,
but should *not* prevent him reaching its conversation from that side.

**Supported browser geometry:** only coordinate code **4**, exact numeric
`TT_SOLID=1`, matching source layer, finite points, simple closed
polygons (at least 3 vertices and nonzero area), and open polylines (at
least 2 points), with at most 256 vertices per shape. Supported solid
attributes are **not interpreted** because the native solid branch
does not inspect them. The browser uses circle-to-segment minimum
distance and odd-even point-in-polygon containment; source open
polylines have no interior. Unsupported or malformed types/shapes are
diagnosed and **nonblocking**; other supported vectors still block.
Non-solid and other-layer vectors are diagnosed as skipped. If no
supported blockers exist, or the browser's circle overlaps a stored
spawn, the movement policy visibly falls back to **bounds-only**.
The currently supported Play scene still requires a valid orthogonal
pixel board; isometric/other coordinate modes remain outside the
imported runtime, not silently projected.

**Engine comparison / intentional differences:** Toolkit intersects
its player-authored vector-base polygon with board line segments and
closed polygons. Our movement stepper retains the synthetic **circle
radius 9px**, constant **112 pixels/s**, **50ms maximum frame delta**,
**4px maximum sweep substeps**, and independently tested **axis sliding**.
Thus tight passages, edge contacts, angular wall slides and collisions
against placed ITM sprite bases may differ from native Toolkit. Exact
Toolkit player-base collision fidelity, union/mixed tile-type flags,
unidirectional/stair/waypoint semantics, under rendering, board images
and movement-layer transitions remain **unverified or out of scope**.
Only the already supported imported inn dialogue remains activatable;
its 46px point-distance condition is not a native item activation polygon.

The imported Play view shows the selected collision policy, source
solid/ignored/unsupported counts and fallback reason. **Show verified
wall outlines** paints optional red boundaries over the art without
changing collision or dialogue.

**Checks:** [synthetic vector movement tests](../../scripts/check-vector-collision.mjs)
cover exact type eligibility, open/closed shapes, same-layer selection,
geometry rejection, walls versus clear paths, high-delta cap, axis
sliding, bounds-only fallback, and UI diagnostics. The SHA-gated local
read-only test accepts the original ZIP and checks **all six eligible
polygons, valid spawn, wall blocking and a collision-valid route to
the authored inn followed by the existing first conversation**:

    node scripts/check-vector-collision.mjs "/path/to/BSTW_EXPO_DEMO.zip"

Automated code checks, independent original-byte parsing and manual
Android acceptance must be reported separately. The game archive,
graphics, music, original scripts, DLLs and executables must never
enter Git or CI.

**Android test after merge:** upload BSTW → **Play opening board** →
enable **Show verified wall outlines** → try to walk through the large
highlighted building wall → go around its southern edge → reach the
marked inn door from the walkable side → **Talk / Next / Finish** →
verify **Clues 1/13** and **Inn visits 1**.
