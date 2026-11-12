# Toolkit 2 test matrix

This inventory tracks the format variants identified so far for
[issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63). The target is
one row for every known Toolkit 2 file layout and meaningful submode.
The [compatibility audit](compatibility-matrix.md) records the source evidence
and gaps. Add rows as further variants are identified.

**Viewer** records the expected result of the linked checks. A partial result
covers the documented fields. A generator link identifies a fixture by its
path inside the generated archive. The synthetic conformance fixtures include
files that exercise only part of a layout.

**Desktop** records editor open, save/reopen, and runtime results in that order.
`Pending` means the available Toolkit 2 editor has yet to be tested for this
matrix. For each result, record the editor release, ZIP or fixture revision,
action, and observed result. Record upgrades with the resulting file revision.

**Test route** describes where to exercise a variant. The legacy coverage game
and latest verified Toolkit 2 game are planned. The minimal baseline is
available in merged [PR #64](https://github.com/jmbjr/rpgtk_godot/pull/64),
with its [asset manifest](https://github.com/jmbjr/rpgtk_godot/blob/0562ea3aeb70aa2ea76630cb9144ec0d53aebee2/experiments/tk2-test-game/manifest.json)
and [generator and checks](https://github.com/jmbjr/rpgtk_godot/blob/0562ea3aeb70aa2ea76630cb9144ec0d53aebee2/scripts/build-tk2-test-game.mjs).
The first legacy coverage increment is a separate [TK2LegacyLab manifest](../../experiments/tk2-legacy-game/manifest.json)
and [editor-open checklist](../../experiments/tk2-legacy-game/README.md). CI builds
`tk2-legacy-game.zip` alongside the unchanged baseline `tk2-test-game.zip`.
The initial increment includes four **standalone**, synthetic GPH mode 4/6
variants (from checked-in fixtures, normalized to CRLF for the ZIP).
The next increment adds five binary TST format 20 modes (2–6), copied byte-for-byte
from checked-in fixtures, plus five binary BRD 2.2 *gallery* boards that place
both tiles in each set. The generator checks each board's two exact tile
references. None of these gallery boards is linked from the active GAM or
startup script. Viewer decoding and static reference resolution are verified,
but **desktop editor opening, save/reopen, and runtime usage remain pending**.
Do not infer runtime acceptance from the main test room loading.
The next increment packages synthetic BRD text 2.0/2.1 and binary 2.3
fixtures (with zero and three thread slots), plus the source-controlled
tileset, item, background and MIDI reference targets. Each board is
available for independent editor-open/save/reopen tests. The ZIP generator
checks the exact board bytes, dimensions, resolved tile/asset references and
thread slots; desktop/editor and runtime acceptance remain pending. The
binary 2.3 raw coordinate flag does not establish isometric geometry.
The fourth increment packages **all seven documented historical TEM layouts**
(text 2.0 embedded; 2.1/2.2 embedded and referenced; binary 2.3/2.4)
as distinct editor-open fixtures. Each TEM is byte-identical to its
checked-in conformance generator and retains 16 walking frames plus all 27
artwork slots. Character portraits, available walking tiles, sounds and
special move references are validated; unavailable battle-art and missing
sound filenames remain documented gaps. Desktop/editor and runtime acceptance
are **pending**. The active GAM player remains the existing binary 2.3 test hero.
For the next visual-acceptance revision, the seven TEM entries in the legacy ZIP
are **generated diagnostic editions**, not exact copies of the sparse original
`format-fixtures.mjs` assets. They use the [diagnostic-v1 visual standard](visual-fixture-standard.md):
35 shared GPH art tiles with high-contrast colored markers, no blank walking
or action frames, and resolvable graphic parts. The original conformance
fixtures remain unchanged in the repo. CI verifies rendered sprites and
image/pixel signatures; desktop acceptance is still **pending**.
The next slice adds five synthetic **ITM diagnostic editions** across
text 2.0/2.1 (embedded/referenced) and binary 2.2/2.3 (referenced).
All 16 walking frames and the resting pose are visible, with 34 generated
relic GPH sources backing referenced variants. Frame markers and a diamond
shift make the four animation frames visibly different. The original sparse
ITM fixtures and the previously included board reference item are not
overwritten. [Visual contract](visual-fixture-standard.md) ·
[Legacy item checklist](../../experiments/tk2-legacy-game/README.md).
Desktop/editor and runtime acceptance are **pending**.

The following ENE coverage slice contains **two synthetic text 2.0
diagnostic editions**: short sound-only tail and the extended four-animation
tail. Both display a distinct 2×2 enemy from eight checked diagnostic
GPH quadrants; the extended specimen resolves all four animation slots
to an existing ANM. The source conformance fixtures remain unmodified.
[Visual standard](visual-fixture-standard.md) ·
[Legacy enemy checklist](../../experiments/tk2-legacy-game/README.md).
Viewer decoding and reference integrity are checked in CI; desktop
editor and runtime results remain **pending**.

The [three-PR completion plan](legacy-coverage-three-pr-plan.md) groups
the remaining matrix rows into graphics/combat, companion packaging/media,
and alternate GAM plus evidence gaps. The first batch adds all eight remaining
GPH 2.0 mode/raw-RLE combinations (modes 1/2/3/5), a populated BKG text
2.0, four-frame TAN binary 2.0, 256-glyph FNT text 2.0, and STE text 2.0.
The earlier included SPC text 2.0, ANM text 2.0, and STE binary 2.2
receive additional explicit static-reference checks. **Desktop editor and
runtime acceptance are intentionally deferred**, and old source fixtures
are preserved independently of synthetic diagnostic editions.

The packaging/media batch adds five matrix routes. The legacy game ZIP
contains a **partial** temporary `.___` scratch shape, synthetic **header-only**
JPEG SOF and CFB DOC metadata samples, plus two **fully renderable** RGB
16×16 diagnostic images in PNG and BMP. A **separate** viewer-only synthetic
CMP1 test ZIP contains an inert MZ-prefixed payload (not an executable
installer); CI checks that opening the CMP1 wrapper restores every original
game file byte-for-byte. This evidence does **not** establish historical
editor/runtime validity or complete JPEG/DOC rendering.
[Companion-media fixture generator](fixtures/companion-media-fixtures.mjs) ·
[CMP1 round-trip test](../../scripts/build-tk2-installer-fixture.mjs) ·
[legacy checklist](../../experiments/tk2-legacy-game/README.md).
Desktop/editor acceptance remains **pending**.

Each archive has one active GAM. Use separate ZIPs with the same project assets
for alternate GAM layouts. Establish the latest Toolkit 2 release and its
actual writer output before selecting formats for the latest game.


## Project, boards, and scripts

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [GAM text 2.0](gam.md) | [`legacy.gam`](fixtures/format-fixtures.mjs#L27) | Partial startup bindings. [Check](../../scripts/check-format-specs.mjs) | Pending | Alternate GAM ZIP |
| [GAM binary 2.2](gam.md) | [`main.gam`](fixtures/format-fixtures.mjs#L23) | Partial title, project path, and startup bindings. [Check](../../scripts/check-format-specs.mjs) | Pending | Baseline and legacy main file |
| [BRD text 2.0](brd.md) | [`Boards/fixed-room.brd`](fixtures/format-fixtures.mjs#L170) | Partial fixed grid, conditions, and links. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy board inventory](../../experiments/tk2-legacy-game/manifest.json) · `Boards/legacy-text-20.brd` · individual editor-open, not active GAM board |
| [BRD text 2.1](brd.md) | [`Boards/text-room.brd`](fixtures/format-fixtures.mjs#L146) | Partial dimensioned grid, conditions, and links. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy board inventory](../../experiments/tk2-legacy-game/manifest.json) · `Boards/legacy-text-21.brd` · individual editor-open, not active GAM board |
| [BRD binary 2.2](brd.md) | [`Boards/types-2.brd`](fixtures/detail-fixtures.mjs#L64) | Partial binary grid, placement conditions, and tile types. [Check](../../scripts/check-character-board-details.mjs) | Pending | Baseline and [five mode-specific TST gallery boards](../../experiments/tk2-legacy-game/manifest.json); desktop editor checks pending |
| [BRD binary 2.3, thread slots](brd.md) | [`Boards/threaded-room.brd`](fixtures/format-fixtures.mjs#L121) and [`Boards/no-threads.brd`](fixtures/format-fixtures.mjs#L122) | Partial thread names and raw coordinate byte. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy board inventory](../../experiments/tk2-legacy-game/manifest.json) · `Boards/legacy-binary-23-empty.brd` and `Boards/legacy-binary-23-threads.brd` · independent editor-open and thread-slot inspection |
| [BRD binary 2.3, isometric coordinates](brd.md) | [Legacy reader evidence](compatibility-matrix.md#project-boards-and-scripts). Need a real isometric specimen. | Raw coordinate byte retained. Geometry verification pending. | Pending | Acquire sample |
| [PRG unversioned RPGCode](prg.md) | [`Prg/start.prg`](fixtures/format-fixtures.mjs#L30) | Partial source and static references. [Check](../../scripts/check-format-specs.mjs) | Pending | Baseline startup and legacy scripts |

## Characters, items, and combat

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [TEM text 2.0 embedded](tem.md) | [`Chrs/text-0-0.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-text-20-embedded.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM text 2.1 embedded](tem.md) | [`Chrs/text-1-0.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-text-21-embedded.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM text 2.1 referenced](tem.md) | [`Chrs/text-1-1.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-text-21-referenced.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM text 2.2 embedded](tem.md) | [`Chrs/text-hero-0.tem`](fixtures/format-fixtures.mjs#L68) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-text-22-embedded.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM text 2.2 referenced](tem.md) | [`Chrs/text-hero-1.tem`](fixtures/format-fixtures.mjs#L68) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-text-22-referenced.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM binary 2.3](tem.md) | [`Chrs/hero.tem`](fixtures/format-fixtures.mjs#L41) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-binary-23.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [TEM binary 2.4](tem.md) | [`Chrs/walker.tem`](fixtures/format-fixtures.mjs#L52) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy TEM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Chrs/tem-binary-24.tem` · [diagnostic-v1 expected visuals](visual-fixture-standard.md) · independent editor-open; not active GAM player |
| [ITM text 2.0 embedded](itm.md) | [`Item/text-20-item.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ITM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Item/itm-text-20-embedded.itm` · [diagnostic-v1 expected visuals](visual-fixture-standard.md); standalone editor-open, not runtime-tested |
| [ITM text 2.1 embedded](itm.md) | [`Item/text-item-0.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ITM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Item/itm-text-21-embedded.itm` · [diagnostic-v1 expected visuals](visual-fixture-standard.md); standalone editor-open, not runtime-tested |
| [ITM text 2.1 referenced](itm.md) | [`Item/text-item-1.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ITM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Item/itm-text-21-referenced.itm` · [diagnostic-v1 expected visuals](visual-fixture-standard.md); standalone editor-open, not runtime-tested |
| [ITM binary 2.2](itm.md) | [`Item/token-2.itm`](fixtures/format-fixtures.mjs#L184) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ITM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Item/itm-binary-22.itm` · [diagnostic-v1 expected visuals](visual-fixture-standard.md); standalone editor-open, not runtime-tested |
| [ITM binary 2.3](itm.md) | [`Item/token-3.itm`](fixtures/format-fixtures.mjs#L184) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ITM manifest](../../experiments/tk2-legacy-game/manifest.json) · `Item/itm-binary-23.itm` · [diagnostic-v1 expected visuals](visual-fixture-standard.md); standalone editor-open, not runtime-tested |
| [ENE text 2.0 short tail](ene.md) | [`Enemy/foe.ene`](fixtures/format-fixtures.mjs#L230) | Decode enemy without animation slots. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ENE manifest](../../experiments/tk2-legacy-game/manifest.json) · `Enemy/ene-text-20-short.ene` · [diagnostic-v1 expectations](visual-fixture-standard.md); standalone editor-open and 2×2 visual check, not runtime-tested |
| [ENE text 2.0 animation tail](ene.md) | [`Enemy/animated.ene`](fixtures/format-fixtures.mjs#L231) | Decode enemy and animation slots. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ENE manifest](../../experiments/tk2-legacy-game/manifest.json) · `Enemy/ene-text-20-animated.ene` · [diagnostic-v1 expectations](visual-fixture-standard.md); standalone editor-open and 2×2 visual check, not runtime-tested |
| [BKG text 2.0](bkg.md) | [`Bkrounds/room.bkg`](fixtures/format-fixtures.mjs#L234) | Decode battle background tile grid. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Bkrounds/bkg-text-20-diagnostic.bkg` · filled 19×11 battle tile grid and signed shading; standalone viewer check, desktop pending |
| [SPC text 2.0](spc.md) | [`SpcMove/pulse.spc`](fixtures/format-fixtures.mjs#L240) | Decode move and preserve use flags. [Check](../../scripts/check-format-specs.mjs) | Pending | Existing legacy ZIP dependency, with new explicit resolved-reference CI assertions; desktop pending |
| [STE text 2.0](ste.md) | [`StatusE/text-ste.ste`](fixtures/format-fixtures.mjs#L248) | Decode flags, amounts, and program. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `StatusE/ste-text-20.ste` · source-identical historical status effect; standalone viewer check, desktop pending |
| [STE binary 2.2](ste.md) | [`StatusE/slow.ste`](fixtures/format-fixtures.mjs#L244) | Decode flags, amounts, and program. [Check](../../scripts/check-format-specs.mjs) | Pending | Existing legacy ZIP dependency, with new explicit resolved-reference CI assertions; desktop pending |

## Tiles, fonts, and animation

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [TST binary 20 mode 1](tst.md) | [`two-tiles.tst`](fixtures/two-tiles.tst) | Decode 32 × 32 RGB tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Baseline tiles and legacy tileset |
| [TST binary 20 mode 2](tst.md) | [`two-tiles-16.tst`](fixtures/two-tiles-16.tst) | Decode 16 × 16 RGB tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/two-tiles-16.tst` · `Boards/test-tst-mode-2.brd` (both numbered tile references; not the startup board) |
| [TST binary 20 mode 3](tst.md) | [`palette-3.tst`](fixtures/palette-3.tst) | Decode 32 × 32 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-3.tst` · `Boards/test-tst-mode-3.brd` (both numbered tile references; not the startup board) |
| [TST binary 20 mode 4](tst.md) | [`palette-4.tst`](fixtures/palette-4.tst) | Decode 16 × 16 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-4.tst` · `Boards/test-tst-mode-4.brd` (both numbered tile references; not the startup board) |
| [TST binary 20 mode 5](tst.md) | [`palette-5.tst`](fixtures/palette-5.tst) | Decode 32 × 32 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-5.tst` · `Boards/test-tst-mode-5.brd` (both numbered tile references; not the startup board) |
| [TST binary 20 mode 6](tst.md) | [`palette-6.tst`](fixtures/palette-6.tst) | Decode 16 × 16 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-6.tst` · `Boards/test-tst-mode-6.brd` (both numbered tile references; not the startup board) |
| [GPH text 2.0 mode 1, raw](gph.md) | [`raw-32.gph`](../../scripts/check-tile-specs.mjs#L96) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/mode-1-raw.gph` · 32×32 true-color raw; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 1, RLE](gph.md) | [`standalone-32-rle.gph`](fixtures/standalone-32-rle.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/standalone-32-rle.gph` · 32×32 true-color RLE; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 2, raw](gph.md) | [`standalone-16.gph`](fixtures/standalone-16.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/standalone-16.gph` · 16×16 true-color raw; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 2, RLE](gph.md) | [`rle-16.gph`](../../scripts/check-tile-specs.mjs#L97) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/mode-2-rle.gph` · 16×16 true-color RLE; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 3, raw](gph.md) | [`palette-3-0.gph`](fixtures/palette-3-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-3-0.gph` · 32×32 indexed raw; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 3, RLE](gph.md) | [`palette-3-1.gph`](fixtures/palette-3-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-3-1.gph` · 32×32 indexed RLE; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 4, raw](gph.md) | [`palette-4-0.gph`](fixtures/palette-4-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Game/TK2LegacyLab/Tiles/palette-4-0.gph` · standalone editor-open only |
| [GPH text 2.0 mode 4, RLE](gph.md) | [`palette-4-1.gph`](fixtures/palette-4-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Game/TK2LegacyLab/Tiles/palette-4-1.gph` · standalone editor-open only |
| [GPH text 2.0 mode 5, raw](gph.md) | [`palette-5-0.gph`](fixtures/palette-5-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-5-0.gph` · 32×32 indexed raw; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 5, RLE](gph.md) | [`palette-5-1.gph`](fixtures/palette-5-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/palette-5-1.gph` · 32×32 indexed RLE; standalone viewer check, desktop pending |
| [GPH text 2.0 mode 6, raw](gph.md) | [`palette-6-0.gph`](fixtures/palette-6-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Game/TK2LegacyLab/Tiles/palette-6-0.gph` · standalone editor-open only |
| [GPH text 2.0 mode 6, RLE](gph.md) | [`palette-6-1.gph`](fixtures/palette-6-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Game/TK2LegacyLab/Tiles/palette-6-1.gph` · standalone editor-open only |
| [TAN binary 2.0](tan.md) | [`Tiles/water.tan`](fixtures/format-fixtures.mjs#L35) | Decode timing and ordered frame references. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Tiles/tan-binary-20-diagnostic.tan` · four ordered GPH frames; standalone viewer check, desktop pending |
| [ANM text 2.0](anm.md) | [`Misc/effect.anm`](fixtures/format-fixtures.mjs#L252) | Decode frames, timing, and audio slots. [Check](../../scripts/check-format-specs.mjs) | Pending | Existing legacy ZIP dependency, with new explicit resolved-reference CI assertions; desktop pending |
| [FNT text 2.0](fnt.md) | [`Font/one.fnt`](fixtures/format-fixtures.mjs#L258) | Decode 256 glyphs. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Font/fnt-text-20-diagnostic.fnt` · 256 glyph slots with diagnostic landmarks; standalone viewer check, desktop pending |

## Packaging and companion files

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [Temporary board scratch text (.___)](temporary-board.md) | [`Boards/temp.___`](fixtures/format-fixtures.mjs#L261) | Partial observed Demo shape. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Boards/temp.___` · observed partial text record; not a BRD/editor test |
| [Temporary board scratch, DustBall shape](temporary-board.md) | [DustBall observation](compatibility-matrix.md#packaging-media-and-project-extras). Need a redistributable specimen. | Existing sample fails observed-shape validation. | Pending | Acquire sample |
| [Plain ZIP](other.md) | [Synthetic archive cases](../../scripts/check-game-archive.mjs) | Open project entries. [Check](../../scripts/check-game-archive.mjs) | Pending | Baseline + legacy game ZIPs; [CMP1 byte-level round-trip test](../../scripts/build-tk2-installer-fixture.mjs); desktop pending |
| [Toolkit installer ZIP with CMP1 payload](other.md) | [Synthetic wrapper cases](../../scripts/check-game-archive.mjs) | Extract nested game archive. [Check](../../scripts/check-game-archive.mjs) | Pending | [Separate CMP1 CI artifact](../../scripts/build-tk2-installer-fixture.mjs) · `tk2-legacy-cmp1-test-wrapper.zip` · viewer-only synthetic MZ wrapper; every restored game file compared byte-for-byte; not a runnable installer |
| [GIF89a](gif.md) | [`Bitmap/face.gif`](fixtures/format-fixtures.mjs#L266) | Decode GIF metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [JPEG SOF](jpg.md) | [`Bitmap/header.jpg`](fixtures/format-fixtures.mjs#L273) | Decode frame dimensions. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Bitmap/header.jpg` · SOF **metadata only**; not an image preview |
| [RIFF/WAVE PCM](wav.md) | [`Media/tone.wav`](fixtures/format-fixtures.mjs#L278) | Decode audio metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [SMF format 0](mid.md) | [`Media/note.mid`](fixtures/format-fixtures.mjs#L283) | Decode MIDI tracks. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [Compound DOC](doc.md) | [`Media/empty.doc`](fixtures/format-fixtures.mjs#L293) | Read compound directory metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Media/empty.doc` · synthetic CFB **header only**, no complete document |
| [PNG/BMP browser image entries](other.md) | [PNG routing fixture](../../scripts/check-format-specs.mjs#L33). Need renderable PNG and BMP samples. | Browser image routing. [Check](../../scripts/check-format-specs.mjs) | Pending | [Legacy ZIP manifest](../../experiments/tk2-legacy-game/manifest.json) · `Bitmap/diagnostic-16.png` and `.bmp` · [full pixel/CRC test](../../scripts/check-companion-media.mjs); 16×16 identical renderable patterns |

## Open inventory gaps

| Type or layout | Evidence and next check |
| --- | --- |
| GAM older fallback | Trace the legacy reader and obtain an attributable sample before assigning a revision. [Project audit](compatibility-matrix.md#project-boards-and-scripts) |
| BRD headerless fallback | Establish Toolkit 2 provenance and obtain or reconstruct a specimen. [Project audit](compatibility-matrix.md#project-boards-and-scripts) |
| GPH version-1 fallback | Establish its headerless layout with source and sample evidence. [Tile audit](compatibility-matrix.md#tiles-art-and-animation) |
| TBM, ISO, TST 30 and later layouts | Establish Toolkit 2 provenance for each candidate before assigning it to either test game. [Tile audit](compatibility-matrix.md#tiles-art-and-animation) |
| Additional media variants and project extras | Expand sample coverage for the documented media profiles and inventory saves, auxiliary files, and alternate wrappers as evidence appears. [Spec index](README.md) |
