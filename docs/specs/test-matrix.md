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
available for review in [PR #64](https://github.com/jmbjr/rpgtk_godot/pull/64),
with its [asset manifest](https://github.com/jmbjr/rpgtk_godot/blob/0562ea3aeb70aa2ea76630cb9144ec0d53aebee2/experiments/tk2-test-game/manifest.json)
and [generator and checks](https://github.com/jmbjr/rpgtk_godot/blob/0562ea3aeb70aa2ea76630cb9144ec0d53aebee2/scripts/build-tk2-test-game.mjs).
Each archive has one active GAM. Use separate ZIPs with the same project assets
for alternate GAM layouts. Establish the latest Toolkit 2 release and its
actual writer output before selecting formats for the latest game.


## Project, boards, and scripts

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [GAM text 2.0](gam.md) | [`legacy.gam`](fixtures/format-fixtures.mjs#L27) | Partial startup bindings. [Check](../../scripts/check-format-specs.mjs) | Pending | Alternate GAM ZIP |
| [GAM binary 2.2](gam.md) | [`main.gam`](fixtures/format-fixtures.mjs#L23) | Partial title, project path, and startup bindings. [Check](../../scripts/check-format-specs.mjs) | Pending | Baseline and legacy main file |
| [BRD text 2.0](brd.md) | [`Boards/fixed-room.brd`](fixtures/format-fixtures.mjs#L170) | Partial fixed grid, conditions, and links. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy board |
| [BRD text 2.1](brd.md) | [`Boards/text-room.brd`](fixtures/format-fixtures.mjs#L146) | Partial dimensioned grid, conditions, and links. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy board |
| [BRD binary 2.2](brd.md) | [`Boards/types-2.brd`](fixtures/detail-fixtures.mjs#L64) | Partial binary grid, placement conditions, and tile types. [Check](../../scripts/check-character-board-details.mjs) | Pending | Baseline and legacy board |
| [BRD binary 2.3, thread slots](brd.md) | [`Boards/threaded-room.brd`](fixtures/format-fixtures.mjs#L121) and [`Boards/no-threads.brd`](fixtures/format-fixtures.mjs#L122) | Partial thread names and raw coordinate byte. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy board |
| [BRD binary 2.3, isometric coordinates](brd.md) | [Legacy reader evidence](compatibility-matrix.md#project-boards-and-scripts). Need a real isometric specimen. | Raw coordinate byte retained. Geometry verification pending. | Pending | Acquire sample |
| [PRG unversioned RPGCode](prg.md) | [`Prg/start.prg`](fixtures/format-fixtures.mjs#L30) | Partial source and static references. [Check](../../scripts/check-format-specs.mjs) | Pending | Baseline startup and legacy scripts |

## Characters, items, and combat

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [TEM text 2.0 embedded](tem.md) | [`Chrs/text-0-0.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [TEM text 2.1 embedded](tem.md) | [`Chrs/text-1-0.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [TEM text 2.1 referenced](tem.md) | [`Chrs/text-1-1.tem`](fixtures/format-fixtures.mjs#L92) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [TEM text 2.2 embedded](tem.md) | [`Chrs/text-hero-0.tem`](fixtures/format-fixtures.mjs#L68) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [TEM text 2.2 referenced](tem.md) | [`Chrs/text-hero-1.tem`](fixtures/format-fixtures.mjs#L68) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [TEM binary 2.3](tem.md) | [`Chrs/hero.tem`](fixtures/format-fixtures.mjs#L41) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Baseline player and legacy character |
| [TEM binary 2.4](tem.md) | [`Chrs/walker.tem`](fixtures/format-fixtures.mjs#L52) · [Artwork specimens](fixtures/detail-fixtures.mjs#L22) | Partial stats, graphics, and references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy character |
| [ITM text 2.0 embedded](itm.md) | [`Item/text-20-item.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy item |
| [ITM text 2.1 embedded](itm.md) | [`Item/text-item-0.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy item |
| [ITM text 2.1 referenced](itm.md) | [`Item/text-item-1.itm`](fixtures/format-fixtures.mjs#L200) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy item |
| [ITM binary 2.2](itm.md) | [`Item/token-2.itm`](fixtures/format-fixtures.mjs#L184) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy item |
| [ITM binary 2.3](itm.md) | [`Item/token-3.itm`](fixtures/format-fixtures.mjs#L184) | Decode item fields and graphics. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy item |
| [ENE text 2.0 short tail](ene.md) | [`Enemy/foe.ene`](fixtures/format-fixtures.mjs#L230) | Decode enemy without animation slots. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy enemy |
| [ENE text 2.0 animation tail](ene.md) | [`Enemy/animated.ene`](fixtures/format-fixtures.mjs#L231) | Decode enemy and animation slots. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy enemy |
| [BKG text 2.0](bkg.md) | [`Bkrounds/room.bkg`](fixtures/format-fixtures.mjs#L234) | Decode battle background tile grid. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy battle background |
| [SPC text 2.0](spc.md) | [`SpcMove/pulse.spc`](fixtures/format-fixtures.mjs#L240) | Decode move and preserve use flags. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy special move |
| [STE text 2.0](ste.md) | [`StatusE/text-ste.ste`](fixtures/format-fixtures.mjs#L248) | Decode flags, amounts, and program. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy status effect |
| [STE binary 2.2](ste.md) | [`StatusE/slow.ste`](fixtures/format-fixtures.mjs#L244) | Decode flags, amounts, and program. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy status effect |

## Tiles, fonts, and animation

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [TST binary 20 mode 1](tst.md) | [`two-tiles.tst`](fixtures/two-tiles.tst) | Decode 32 × 32 RGB tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Baseline tiles and legacy tileset |
| [TST binary 20 mode 2](tst.md) | [`two-tiles-16.tst`](fixtures/two-tiles-16.tst) | Decode 16 × 16 RGB tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tileset |
| [TST binary 20 mode 3](tst.md) | [`palette-3.tst`](fixtures/palette-3.tst) | Decode 32 × 32 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tileset |
| [TST binary 20 mode 4](tst.md) | [`palette-4.tst`](fixtures/palette-4.tst) | Decode 16 × 16 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tileset |
| [TST binary 20 mode 5](tst.md) | [`palette-5.tst`](fixtures/palette-5.tst) | Decode 32 × 32 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tileset |
| [TST binary 20 mode 6](tst.md) | [`palette-6.tst`](fixtures/palette-6.tst) | Decode 16 × 16 indexed tiles and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tileset |
| [GPH text 2.0 mode 1, raw](gph.md) | [`raw-32.gph`](../../scripts/check-tile-specs.mjs#L96) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 1, RLE](gph.md) | [`standalone-32-rle.gph`](fixtures/standalone-32-rle.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 2, raw](gph.md) | [`standalone-16.gph`](fixtures/standalone-16.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 2, RLE](gph.md) | [`rle-16.gph`](../../scripts/check-tile-specs.mjs#L97) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 3, raw](gph.md) | [`palette-3-0.gph`](fixtures/palette-3-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 3, RLE](gph.md) | [`palette-3-1.gph`](fixtures/palette-3-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 4, raw](gph.md) | [`palette-4-0.gph`](fixtures/palette-4-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor priority |
| [GPH text 2.0 mode 4, RLE](gph.md) | [`palette-4-1.gph`](fixtures/palette-4-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor priority |
| [GPH text 2.0 mode 5, raw](gph.md) | [`palette-5-0.gph`](fixtures/palette-5-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 5, RLE](gph.md) | [`palette-5-1.gph`](fixtures/palette-5-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor |
| [GPH text 2.0 mode 6, raw](gph.md) | [`palette-6-0.gph`](fixtures/palette-6-0.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor priority |
| [GPH text 2.0 mode 6, RLE](gph.md) | [`palette-6-1.gph`](fixtures/palette-6-1.gph) | Decode pixels and transparency. [Check](../../scripts/check-tile-specs.mjs) | Pending | Legacy tile editor priority |
| [TAN binary 2.0](tan.md) | [`Tiles/water.tan`](fixtures/format-fixtures.mjs#L35) | Decode timing and ordered frame references. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy animated tile |
| [ANM text 2.0](anm.md) | [`Misc/effect.anm`](fixtures/format-fixtures.mjs#L252) | Decode frames, timing, and audio slots. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy effect animation |
| [FNT text 2.0](fnt.md) | [`Font/one.fnt`](fixtures/format-fixtures.mjs#L258) | Decode 256 glyphs. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy font editor |

## Packaging and companion files

| Type and variant | Repository evidence | Viewer | Desktop open / save / run | Test route |
| --- | --- | --- | --- | --- |
| [Temporary board scratch text (.___)](temporary-board.md) | [`Boards/temp.___`](fixtures/format-fixtures.mjs#L261) | Partial observed Demo shape. [Check](../../scripts/check-format-specs.mjs) | Pending | Legacy scratch sample |
| [Temporary board scratch, DustBall shape](temporary-board.md) | [DustBall observation](compatibility-matrix.md#packaging-media-and-project-extras). Need a redistributable specimen. | Existing sample fails observed-shape validation. | Pending | Acquire sample |
| [Plain ZIP](other.md) | [Synthetic archive cases](../../scripts/check-game-archive.mjs) | Open project entries. [Check](../../scripts/check-game-archive.mjs) | Pending | Both game ZIPs |
| [Toolkit installer ZIP with CMP1 payload](other.md) | [Synthetic wrapper cases](../../scripts/check-game-archive.mjs) | Extract nested game archive. [Check](../../scripts/check-game-archive.mjs) | Pending | Separate package fixture |
| [GIF89a](gif.md) | [`Bitmap/face.gif`](fixtures/format-fixtures.mjs#L266) | Decode GIF metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [JPEG SOF](jpg.md) | [`Bitmap/header.jpg`](fixtures/format-fixtures.mjs#L273) | Decode frame dimensions. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [RIFF/WAVE PCM](wav.md) | [`Media/tone.wav`](fixtures/format-fixtures.mjs#L278) | Decode audio metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [SMF format 0](mid.md) | [`Media/note.mid`](fixtures/format-fixtures.mjs#L283) | Decode MIDI tracks. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [Compound DOC](doc.md) | [`Media/empty.doc`](fixtures/format-fixtures.mjs#L293) | Read compound directory metadata. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |
| [PNG/BMP browser image entries](other.md) | [PNG routing fixture](../../scripts/check-format-specs.mjs#L33). Need renderable PNG and BMP samples. | Browser image routing. [Check](../../scripts/check-format-specs.mjs) | Pending | Companion asset check |

## Open inventory gaps

| Type or layout | Evidence and next check |
| --- | --- |
| GAM older fallback | Trace the legacy reader and obtain an attributable sample before assigning a revision. [Project audit](compatibility-matrix.md#project-boards-and-scripts) |
| BRD headerless fallback | Establish Toolkit 2 provenance and obtain or reconstruct a specimen. [Project audit](compatibility-matrix.md#project-boards-and-scripts) |
| GPH version-1 fallback | Establish its headerless layout with source and sample evidence. [Tile audit](compatibility-matrix.md#tiles-art-and-animation) |
| TBM, ISO, TST 30 and later layouts | Establish Toolkit 2 provenance for each candidate before assigning it to either test game. [Tile audit](compatibility-matrix.md#tiles-art-and-animation) |
| Additional media variants and project extras | Expand sample coverage for the documented media profiles and inventory saves, auxiliary files, and alternate wrappers as evidence appears. [Spec index](README.md) |
