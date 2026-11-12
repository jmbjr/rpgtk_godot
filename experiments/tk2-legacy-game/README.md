# Toolkit 2 Legacy Test Lab · incremental format coverage

This is the growing legacy coverage game for [issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63), not yet an all-variants project. It keeps the verified minimal room from TK2TestLab under a **different project name**. The first slice included four standalone 16 × 16 GPH samples (modes 4 and 6, raw and RLE). The second included TST format 20 modes 2–6 and a separate binary BRD 2.2 gallery for each mode. The third adds historical BRD text 2.0/2.1 and binary 2.3 board specimens. The fourth adds seven distinct TEM character-format variants spanning text 2.0–2.2 and binary 2.3–2.4. The fifth adds five visibly diagnostic ITM item layouts (text 2.0/2.1 and binary 2.2/2.3). The sixth adds two ENE text 2.0 enemy-tail variants with individually checkable 2×2 enemy art. The graphics-and-combat batch added the remaining eight standalone GPH combinations plus BKG 2.0, TAN 2.0, FNT 2.0 and STE text 2.0. The packaging/media batch adds temporary scratch-board evidence, JPEG/DOC metadata specimens, two valid images and an external synthetic CMP1 wrapper. [Three-PR completion plan](../../docs/specs/legacy-coverage-three-pr-plan.md).

## Install and baseline smoke test

Extract `tk2-legacy-game.zip` into the directory containing the existing Toolkit 2 `Main` and `Game` folders. In RPG Toolkit Development System 2.2, open `Main/TK2LegacyLab.gam`. Run the startup message, dismiss it, walk in all four directions, and test the central blocking tile. The game uses **Default Resolution**, not Set Resolution; no full-screen mode is selected.

## Test packaging and companion media batch

**No desktop testing is required during this implementation batch.**
The existing playable GAM, player, board and startup program are unchanged.
The table below describes what you should see **in the browser viewer**.

| Test file in `Game/TK2LegacyLab/` | Expected evidence | Important limitation |
| --- | --- | --- |
| `Boards/temp.___` | Five integer header fields `1,2,3,4,5` and one record referencing `two-tiles.tst2` | **Unversioned partial observed scratch format**; not a normal BRD and not proof of board editor acceptance |
| `Bitmap/header.jpg` | JPEG SOF metadata reports 3×2 and 8-bit precision | **Only a synthetic JPEG frame header**. It need not show a picture; a failed browser photo decode is expected |
| `Media/empty.doc` | CFB compound container, 512-byte sector size, no directory entries | **Only a CFB header**, not a complete Microsoft Word document |
| `Bitmap/diagnostic-16.png` | Fully rendered 16×16 image with colored corners and a white cross | Real PNG RGB8 compression; blank image is a test failure |
| `Bitmap/diagnostic-16.bmp` | Same rendered 16×16 picture as the PNG | Real uncompressed Windows BMP24; upside-down, mirrored or different colors is a test failure |

The PNG and BMP share **identical pixels** and bright corner markers:
upper-left red, upper-right green, lower-left blue, lower-right yellow.
Both have a violet outside border, a dark/light checker field and an
opaque white cross through their center. Automated tests validate PNG
chunk CRCs and decompressed scanlines, BMP bottom-up row ordering, all
four corners and matching RGB values at all 256 positions. The samples
are newly generated, not historical Toolkit editor outputs.

**CMP1 installer-wrapper check (separate download):** GitHub Actions
also produces `tk2-legacy-cmp1-wrapper` containing
`tk2-legacy-cmp1-test-wrapper.zip`. This is an **inert viewer-import
fixture**, not a functioning Toolkit installer. Inside the ZIP is a
`setup.inf` label and nested `zip.zip` with an EXE-*named* fake payload;
its MZ prefix, embedded game ZIP and CMP1 trailer imitate the **observed
archive structure only**. **Never execute that .exe**, and do not place
this wrapper inside the `Game/TK2LegacyLab` project directory.

To inspect it, load the downloaded wrapper artifact ZIP directly into
Game Explorer. The importer should unwrap it and show **exactly the same
game files** as `tk2-legacy-game.zip`. CI compares every restored file
byte-for-byte and also tests the GitHub Actions outer ZIP layer. It does
not establish that any installer program runs on Windows.

The original synthetic JPEG, DOC and scratch fixtures are preserved
byte-for-byte. The DustBall scratch variant remains an evidence gap for
the third PR, rather than being silently treated as compatible.

## Test graphics and combat completion batch

This batch adds **12 matrix entries** to the legacy game without changing its
startup room or claiming that the desktop editor accepts every synthetic file.

| Format group | Test filename(s) under `Game/TK2LegacyLab/` | Expected viewer result |
| --- | --- | --- |
| GPH mode 1 (32×32 RGB raw/RLE) | `Tiles/mode-1-raw.gph`, `Tiles/standalone-32-rle.gph` | Both display colored pixels with transparency |
| GPH mode 2 (16×16 RGB raw/RLE) | `Tiles/standalone-16.gph`, `Tiles/mode-2-rle.gph` | Both display scaled 16×16 colored pixels |
| GPH mode 3 (32×32 256-color indexed) | `Tiles/palette-3-{0,1}.gph` | Raw and RLE use the pinned palette |
| GPH mode 5 (32×32 16-color indexed) | `Tiles/palette-5-{0,1}.gph` | Raw and RLE use the pinned palette |
| BKG text 2.0 | `Bkrounds/bkg-text-20-diagnostic.bkg` | A full 19×11 checker/border of tiles, with subtle signed shading on the left/right edges |
| TAN binary 2.0 | `Tiles/tan-binary-20-diagnostic.tan` | Four ordered and visibly different tile frames; speed 8 |
| FNT text 2.0 | `Font/fnt-text-20-diagnostic.fnt` | 256 8×8 glyph slots with recognizable `A`, `B`, `0`, `1` and mostly filled registration patterns |
| STE text 2.0 | `StatusE/ste-text-20.ste` | Name `Old effect`, version 2.0, three rounds, signed HP amount -50 and expected status flags |

The BKG and TAN test files use six additional named 32×32 diagnostic GPH
tiles. They have dark interiors, bright borders, distinct center markers and
transparent outer corners. The source GPH 3/5 indexed variants are intentionally
preserved byte-for-byte (after CRLF normalization); they may be more
minimal-looking than the generated `diag-*` artwork. The original format
conformance fixtures remain unchanged.

**Viewer check:** load the legacy ZIP, open each new GPH, then the BKG
background, TAN animation and FNT preview. Check the BKG has a full grid
and the TAN references four different GPHs. Inspect the text STE separately
from the existing binary `StatusE/slow.ste`; inspect existing
`SpcMove/pulse.spc` and `Misc/effect.anm` and verify their static links.
Every referenced BKG/TAN tile should resolve.

**Desktop checks are intentionally deferred.** These assets are standalone:
the original main board, player, and runtime bindings do not use them.
The TAN speed records source timing only; no claim of accurate Toolkit 2
playback is made. The generated FNT is a visible parser/editor diagnostic,
not a historically authenticated typeface.

## Test historical ENE text 2.0 enemy tails

The Toolkit 2 ENE 2.0 format has **two documented endings** under the
same header revision: four sound filename slots only, or four sound slots
**followed by four animation filename slots**. The legacy ZIP now provides
two generated diagnostic editions built from the original synthetic
[short and extended format fixtures](../../docs/specs/fixtures/format-fixtures.mjs),
which remain unchanged in the source repository.

| Enemy under `Game/TK2LegacyLab/Enemy/` | Tail variant | What you should see |
| --- | --- | --- |
| `ene-text-20-short.ene` | Short · sounds only | Coral 2×2 enemy with a diagonal facial scar, **no animation slots** |
| `ene-text-20-animated.ene` | Extended · sounds and animations | Violet 2×2 enemy with a crown, **four animation slots** all set to `effect.anm` |

Every enemy image is composed from **four different** 32×32 GPH tile
quadrants at grid coordinates (0,0), (0,1), (1,0) and (1,1). Both
should form a single recognizable face with two eyes, horns and mouth.
Transparent outer corners and asymmetric eyes/marks expose wrong tile
order, clipping, orientation, and missing references. The enemy uses
**2×2 of the available 19×7 grid**, not all 133 slots.
[Diagnostic-v1 expectations](../../docs/specs/visual-fixture-standard.md)
apply, including no unexpected blank quadrants.

To test in [Game Explorer](https://jmbjr.github.io/rpgtk_godot/),
open each of the two `ene-*` enemy files. Compare their colors, inspect
the **2×2 sprite**, and check the optional `animations` data:
the short version should have *none*, while the extended version
should have named Attack, Defense, Special move and Defeat references
to the existing `effect.anm`. Verify both use `tone.wav` for
Attack sound and reference `pulse.spc` as their first special move.

In Toolkit 2, open each enemy **individually in the enemy editor**,
verify the 2×2 art and any animation controls the editor exposes,
then save a **copy**, reopen it, and record any compatibility issues or
format changes. The enemy assets are **not placed in a battle** and
the existing startup room does not trigger an encounter. Desktop
editor and runtime acceptance remain pending. Distinct graphics and
completed viewer checks do not imply an animation ran in Toolkit 2.

## Test historical ITM text 2.0/2.1 and binary 2.2/2.3 items

The five `Item/itm-*.itm` specimens are **generated diagnostic editions**
of the [original format fixtures](../../docs/specs/fixtures/format-fixtures.mjs);
those original sparse or absent-frame fixtures remain unchanged. Their artwork
comes from the [visual-item-fixtures generator](../../docs/specs/fixtures/visual-item-fixtures.mjs).
Unlike the sparse reference `Item/token-2.itm` already included for the older
board tests, **all five `itm-*` test items are deliberately filled**.

| Item under `Game/TK2LegacyLab/Item/` | Stored ITM revision | Expected visual |
| --- | --- | --- |
| `itm-text-20-embedded.itm` | Text 2.0 embedded | 16 vivid 32×32 walking relics + 1 Rest |
| `itm-text-21-embedded.itm` | Text 2.1 embedded | Same complete embedded graphics, explicit size mode |
| `itm-text-21-referenced.itm` | Text 2.1 referenced | 16 32×64 top/bottom GPH pairs + 1 Rest pair |
| `itm-binary-22.itm` | Binary 2.2 referenced | 16 GPH pairs + Rest; i16 numeric fields |
| `itm-binary-23.itm` | Binary 2.3 referenced | 16 GPH pairs + Rest; i32 numeric fields |

Each frame is a diamond-shaped pink **relic**, with a different direction
accent (South green, East orange, North blue, West violet), a dark opaque field,
white registration corners and a transparent outer margin. A small frame
marker and a shifting diamond distinguish frames 1–4. Rest is teal. The
referenced forms are deliberately taller due to the two stacked 32×32
GPH halves. The [diagnostic-v1 contract](../../docs/specs/visual-fixture-standard.md)
documents the exact pass/fail signals.

To test: open the new legacy ZIP in Game Explorer. In the **Item** folder,
select each `itm-*` file, not the older `token-2.itm` dependency, and
inspect all 16 walking slots plus Rest. **None should be blank or missing**.
Verify the embedded-versus-referenced graphics modes and that the walking
frames show four different positions per direction. Then open each ITM
**individually in Toolkit 2's item editor**, inspect it, save a *copy* and
reopen the copy. Record its editor release and any conversion or rejection.
These items are **not assigned to gameplay or placed on a board**; editor
open/save and runtime acceptance remain unverified.

## Test historical TEM text 2.0–2.2 and binary 2.3–2.4 characters

These seven files are now **diagnostic editions**, not byte-for-byte copies of
[the original sparse format fixtures](../../docs/specs/fixtures/format-fixtures.mjs).
The originals remain unchanged for strict decoder conformance, while
[visual-character-fixtures.mjs](../../docs/specs/fixtures/visual-character-fixtures.mjs)
generates bright 32 × 32 test artwork with predictable visual signatures.
See the [visual diagnostic standard](../../docs/specs/visual-fixture-standard.md)
for expected pixel patterns, colors, transparency and pass/fail examples.
The seven formats are still separate synthetic variants, **not active player
characters** or verified editor-saved bytes.

| Character file (inside `Chrs/`) | Layout | Artwork check |
| --- | --- | --- |
| `tem-text-20-embedded.tem` | Text 2.0; implicit size 0 | Embedded 32 × 32 walking, battle, rest and custom pixels |
| `tem-text-21-embedded.tem` | Text 2.1; size 0 | Embedded artwork, explicit size field |
| `tem-text-21-referenced.tem` | Text 2.1; size 1 | External walking tiles, 32 × 64 battle/rest slots |
| `tem-text-22-embedded.tem` | Text 2.2; size 0 | Embedded artwork; palette and transparency |
| `tem-text-22-referenced.tem` | Text 2.2; size 1 | External walking tiles, 64 × 64 battle/rest slots |
| `tem-binary-23.tem` | Binary 2.3 | External tile-reference slots and one-byte level type |
| `tem-binary-24.tem` | Binary 2.4 | External tile-reference slots and four-byte level type |

In the [browser viewer](https://jmbjr.github.io/rpgtk_godot/),
open each character to inspect **16 visibly filled walking frames** and
**27 visibly filled Attack/Defense/Special move/Defeat/Rest/Custom artwork slots**.
Each should have a dark interior, bright accent, transparent outside,
and distinctive white corner squares. Confirm embedded variants show stored
pixels rather than file references. Referenced variants use the generated
`diag-*.gph` tiles for each walking half and every artwork part.
All GPH references in these diagnostic characters should resolve;
there are **no intentionally blank graphic slots** in this edition.

In Toolkit 2, open **each character independently** in the character editor,
check its name, stats, graphics and warnings, and save **a copy**, then reopen
it. Record the exact editor release, whether it accepted the file, and whether
it rewrote the format or changed embedded/referenced artwork. Do not assign an
older specimen to the main GAM or mark it runtime-tested from the main room.

The ZIP supplies the existing synthetic `face.gif`, `two-tiles.tst`,
`tone.wav`, `pulse.spc`, `slow.ste` and `effect.anm` as
dependencies where applicable. The **historical source fixtures** still
include intentionally missing `battle-*.gph` and sound references, but
the newly packaged **visual diagnostic editions resolve every art tile**.
If a diagnostic TEM's artwork is blank, that is a visual test failure
rather than an expected missing historical asset.

**Desktop editor opening, save/reopen and runtime acceptance remain pending.**

## Test historical BRD 2.0/2.1 and 2.3 boards

These four files are built from the existing source-only [format conformance fixtures](../../docs/specs/fixtures/format-fixtures.mjs). Each is copied **byte-for-byte** into the legacy ZIP. The original editor-saved bytes have not been independently confirmed, so success in the browser viewer is not evidence the desktop editor will accept or preserve the layout.

| Board under `Game/TK2LegacyLab/Boards/` | Revision | Grid | Desktop check |
| --- | --- | --- | --- |
| `legacy-text-20.brd` | Text 2.0 | Fixed 19 × 11 × 8 | Open board in editor, inspect layers and shaded tile placements |
| `legacy-text-21.brd` | Text 2.1 | 2 × 3 × 8 | Open board in editor, inspect tiny grid and placements |
| `legacy-binary-23-empty.brd` | Binary 2.3 | 1 × 1 × 1 | Open board in editor, check empty thread slots and orthogonal coordinate flag |
| `legacy-binary-23-threads.brd` | Binary 2.3 | 1 × 1 × 1 | Open board in editor, check three thread slots and stored coordinate flag 1 |

For **each** board, inspect it first in the [Game Explorer](https://jmbjr.github.io/rpgtk_godot/), check its dimensions and tile references to `two-tiles.tst`, then open it **individually** in Toolkit 2's board editor. Record whether open succeeds, whether the geometry, layers and tile references display correctly, and whether saving a **copy** and reopening succeeds. Note the exact editor version and any automatic upgrade or rewrite. The source fixture's absent `other.prg` and `absent.prg` references are intentional unresolved-evidence cases, not grounds to mark the board format decoder broken.

The ZIP also includes `Tiles/two-tiles.tst`, `Item/token-2.itm`, `Bitmap/face.gif`, and `Media/note.mid` as controlled reference targets. Their inclusion is not a claim of separate editor or runtime acceptance.

**Important:** The binary 2.3 fixture with coordinate flag 1 only checks that the raw field is preserved; it does **not** establish isometric rendering behavior. The four legacy boards are not the active GAM board, and have not been run in the game.

## Test the TST mode 2–6 tilesets and gallery boards

All five tilesets are exact copies of the repository's synthetic conformance fixtures. Each tileset has two tiles. Each gallery board places tile 1 throughout its interior and tile 2 on its border and center block; the viewer's connected game graph should link the gallery board to *both* numbered tiles. These boards **are not referenced by the active GAM or startup script**, so opening and running the default room proves nothing about these five files.

| Format 20 mode | Color/storage | Tileset path under `Game/TK2LegacyLab/Tiles/` | Companion board under `Game/TK2LegacyLab/Boards/` |
| --- | --- | --- | --- |
| 2 | 16 × 16 true-color | `two-tiles-16.tst` | `test-tst-mode-2.brd` |
| 3 | 32 × 32, 256-color palette | `palette-3.tst` | `test-tst-mode-3.brd` |
| 4 | 16 × 16, 256-color palette | `palette-4.tst` | `test-tst-mode-4.brd` |
| 5 | 32 × 32, 16-color palette | `palette-5.tst` | `test-tst-mode-5.brd` |
| 6 | 16 × 16, 16-color palette | `palette-6.tst` | `test-tst-mode-6.brd` |

For each mode: select its tileset in the [browser viewer](https://jmbjr.github.io/rpgtk_godot/), inspect tile 1 and tile 2, open its companion board, and follow both tile references back to the tileset. Then in the Toolkit 2 desktop editor, **open the tileset explicitly**, verify both tiles' colors/transparency, and save a *copy* and reopen it. Open the corresponding board **in the board editor** and check the rendered placements, 19 × 11 dimensions, border and center tile, and any warnings. Record tile-editor results separately from board-editor results. If the editor saves or converts a format, record the resulting revision/mode.

Do not mark these gallery boards as run-tested; they do not participate in the main project's execution. The TST modes are synthetically verified against pinned legacy source, but desktop Toolkit 2 acceptance is pending.

## Individually open the four standalone GPHs

Open these tiles one by one using the Toolkit 2 **tile editor's standalone GPH open command**, not the project Main File. The game deliberately does *not* reference the GPHs; adding them to a board or a character would conflate standalone-file compatibility with in-game placement.

| Relative to Toolkit installation | Stored mode | Encoding |
| --- | --- | --- |
| `Game/TK2LegacyLab/Tiles/palette-4-0.gph` | 4 · 16 × 16 · 256-color | Raw |
| `Game/TK2LegacyLab/Tiles/palette-4-1.gph` | 4 · 16 × 16 · 256-color | RLE |
| `Game/TK2LegacyLab/Tiles/palette-6-0.gph` | 6 · 16 × 16 · 16-color | Raw |
| `Game/TK2LegacyLab/Tiles/palette-6-1.gph` | 6 · 16 × 16 · 16-color | RLE |

For **each** file, record the exact Toolkit editor release, whether opening succeeds, whether the transparent and colored pixels render correctly, and whether saving a **copy** and reopening works. Preserve the original samples; note any conversion, changed format revision/mode, or rejection. These are synthetic, source-backed conformance fixtures—not verified editor-written files. The ZIP normalizes the fixture text to **CRLF line endings** for desktop compatibility while preserving field values and pixels; the committed source fixtures remain unchanged. Do **not** mark runtime GPH behavior as passed merely because the project runs.

The [manifest](manifest.json) lists exact ZIP locations, source fixture paths, modes, compression and gallery-board references. See the [matrix](../../docs/specs/test-matrix.md) for viewer and desktop results.

## Rebuild and validate

```sh
node scripts/build-tk2-test-game.mjs dist/tk2-legacy-game.zip --legacy
node scripts/check-companion-media.mjs
node scripts/build-tk2-installer-fixture.mjs dist/tk2-legacy-game.zip dist/tk2-legacy-cmp1-test-wrapper.zip
```

The generator normalizes the checked-in GPH text fixtures to CRLF, preserving their decoded values; checks each GPH's declared mode/compression; copies the TST binary fixtures *byte-for-byte*; builds the five gallery boards and validates both tile-reference edges for each; copies four historical board fixtures and their reference targets without byte changes; validates board dimensions, tile references and thread slots; packages seven generated historical TEM visual diagnostic editions and their 35 GPH tiles; checks character revisions, walking/artwork geometry, transparent and opaque pixel signatures, resolved tile references and shared support assets; adds five synthetic diagnostic ITM files and 34 distinguishable item GPHs; adds two text ENE tail variants and eight quadrant GPHs with exact byte, tile-order, alpha, animation-tail and reference checks; and adds eight GPH storage variants plus a visible BKG, four-frame TAN, registered 256-glyph FNT and text STE with byte, pixel, reference and layout checks; adds the source-backed scratch/JPEG/DOC metadata entries and full, visibly checkable PNG/BMP companions; verifies a separate byte-identical CMP1 wrapper fixture; and checks the full ZIP inventory plus original baseline project bindings. The source-only format fixtures remain separately unmodified. CI uploads this ZIP separately from the unchanged `tk2-test-game.zip` baseline.
