# Toolkit 2 historical coverage · three-PR completion plan

Tracks the remaining **known matrix rows** in [issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63).
This is a *packaging/automated viewer verification* roadmap, **not** a claim
that historic files were accepted by the desktop Toolkit 2 editor or runtime.

We are deferring all desktop open/save/reopen and runtime checks until the
user's later acceptance pass. Preserve the existing playable
`TK2TestLab` and `TK2LegacyLab` projects and the source conformance
fixtures separately from generated diagnostic editions.

## PR 1 · Graphics and combat — completed in merged PR #76

Target **12 matrix rows**:

- Eight missing **GPH** combinations: modes 1, 2, 3, 5 × raw and RLE.
  For mode 1 raw and mode 2 RLE, generate deterministic full-color samples.
  Reuse pinned checked-in fixtures for the other six combinations.
  With the four previously included modes 4 and 6, the legacy ZIP should
  contain every documented GPH 2.0 combination (12 total).
- **BKG text 2.0** with a filled 19×11 grid, visibly patterned GPH tiles,
  meaningful signed shade offsets and resolved audio references.
- **TAN binary 2.0** with four ordered, distinct GPH frame references.
  Verify speed and order; actual playback timing is outside scope.
- **FNT text 2.0** with all 256 glyphs, visible registration landmarks,
  and deterministic byte-level validation.
- **STE text 2.0** preserving the source fixture bytes and signed amount/
  flags, distinct from the already packaged **STE binary 2.2**.

Retain **SPC text 2.0** and **ANM text 2.0** from earlier slices, and
verify their existing program, sound and animation references explicitly.
All specimens are standalone/editor-open or reference coverage, **not**
new startup room mechanics.

## PR 2 · Packaging and companion media — completed in merged PR #77

Target **five matrix rows**:

- **Temporary board scratch text (`.___`)**: package the documented
  source fixture, retain its partial/uncertain shape and avoid claiming
  the scratch record is an editor-ready BRD.
- **CMP1 Toolkit installer wrapper**: distribute a separately named **viewer-only**
  test ZIP (never nest an installer inside the runnable game's GAM folder).
  The .exe-named payload is an **inert synthetic MZ prefix** with embedded
  game ZIP bytes and a CMP1 trailer, **not a runnable installer**. CI must
  compare recovered game file bytes to the original ZIP and verify the outer
  GitHub Actions artifact wrapper also imports. Do not imply other installer
  formats or protected wrappers are supported.
- **JPEG SOF** and **Compound DOC**: include checked-in source fixtures,
  assert metadata while distinguishing partial metadata from complete media.
- **PNG/BMP browser image entries**: generate fully renderable 16×16 RGB PNG
  and BGR24 BMP samples with matching pixels and identifiable colored corners.
  Verify PNG chunk CRCs, scanlines, BMP row orientation, both media routes,
  and pixel equality. Record both file types under the grouped matrix row.

Keep existing GIF, WAV, and MIDI assets and validate any additional links.
The JPEG fixture is **SOF-only** and the DOC fixture a **minimal CFB
header**: both are deliberately *metadata-only*, not renderable full files.
The scratch-board sample is an observed, partial reader fixture, not
a valid BRD claim. CI success does not change those evidence limitations.

## PR 3 · Alternate GAM and explicit evidence gaps — implementation in PR #78

Targets **three matrix rows**, with only one guaranteed to become a
tested asset unless new primary evidence emerges:

- **GAM text 2.0** must use a **different runnable test ZIP**, because
  each game has one active GAM. Reuse the known room and character assets;
  validate startup, board, and player bindings without changing the
  original binary-GAM project.
- **Isometric BRD binary 2.3**: seek genuine editor/source evidence
  sufficient to distinguish geometry from merely preserving the
  `coordinateType` byte. Do not mark geometry verified on byte evidence.
- **DustBall scratch-board shape**: seek an attributable redistributable
  sample; if unavailable, record an explicit blocker and reproducible
  attempted validation, not a manufactured passing fixture.

The [versioned 57-row ledger](legacy-coverage-audit.json) distinguishes
**52 rows with file-backed viewer/static checks**, **3 included but
metadata-only/partial rows**, and **2 evidence-blocked rows**.
[CI checks](../../scripts/check-legacy-coverage-audit.mjs) verify exact
matrix-row identities, file paths and parser statuses against the output
archives; they do not claim desktop or runtime acceptance.
The [blocker writeup](unresolved-historical-evidence.md) records upstream
pinned source evidence, missing isometric geometry, and the unavailable
DustBall scratch specimen. Do not invent samples for these gaps.

## Definition of done for this three-PR series

- Each PR generates downloadable CI artifacts and validates exact archive
  contents through the production parser/graph, with explicit coverage
  paths and expected visuals in the matrix.
- Original source conformance fixtures are never silently overwritten by
  diagnostic assets.
- Unresolved source evidence remains flagged, not made green by synthetic
  substitutes.
- **Desktop Toolkit 2 opening/saving and game runtime acceptance remain
  pending** as a distinct later workstream, along with the separate
  latest-version Toolkit 2 test game.
