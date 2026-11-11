# Toolkit 2 Legacy Test Lab · incremental format coverage

This is the growing legacy coverage game for [issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63), not yet an all-variants project. It keeps the verified minimal room from TK2TestLab under a **different project name**. The first slice included four standalone 16 × 16 GPH samples (modes 4 and 6, raw and RLE). The second included TST format 20 modes 2–6 and a separate binary BRD 2.2 gallery for each mode. The third adds historical BRD text 2.0/2.1 and binary 2.3 board specimens.

## Install and baseline smoke test

Extract `tk2-legacy-game.zip` into the directory containing the existing Toolkit 2 `Main` and `Game` folders. In RPG Toolkit Development System 2.2, open `Main/TK2LegacyLab.gam`. Run the startup message, dismiss it, walk in all four directions, and test the central blocking tile. The game uses **Default Resolution**, not Set Resolution; no full-screen mode is selected.

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
```

The generator normalizes the checked-in GPH text fixtures to CRLF, preserving their decoded values; checks each GPH's declared mode/compression; copies the TST binary fixtures *byte-for-byte*; builds the five gallery boards and validates both tile-reference edges for each; copies four historical board fixtures and their reference targets without byte changes; validates board dimensions, tile references and thread slots; and checks the full ZIP inventory plus original baseline project bindings. CI uploads this ZIP separately from the unchanged `tk2-test-game.zip` baseline.
