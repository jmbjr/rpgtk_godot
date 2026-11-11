# Toolkit 2 Legacy Test Lab · first coverage slice

This is the first increment of [issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63), not the completed all-variants legacy game. It reuses the verified minimal room from TK2TestLab under a **different project name** and includes four standalone 16 × 16 indexed GPH samples (modes 4 and 6, each raw and RLE).

## Install and baseline smoke test

Extract `tk2-legacy-game.zip` into the directory containing the existing Toolkit 2 `Main` and `Game` folders. In RPG Toolkit Development System 2.2, open `Main/TK2LegacyLab.gam`. Run the startup message, dismiss it, walk in all four directions, and test the central blocking tile. The game uses **Default Resolution**, not Set Resolution; no full-screen mode is selected.

## Individually open the four standalone GPHs

Open these tiles one by one using the Toolkit 2 **tile editor's standalone GPH open command**, not the project Main File. The game deliberately does *not* reference the GPHs; adding them to a board or a character would conflate standalone-file compatibility with in-game placement.

| Relative to Toolkit installation | Stored mode | Encoding |
| --- | --- | --- |
| `Game/TK2LegacyLab/Tiles/palette-4-0.gph` | 4 · 16 × 16 · 256-color | Raw |
| `Game/TK2LegacyLab/Tiles/palette-4-1.gph` | 4 · 16 × 16 · 256-color | RLE |
| `Game/TK2LegacyLab/Tiles/palette-6-0.gph` | 6 · 16 × 16 · 16-color | Raw |
| `Game/TK2LegacyLab/Tiles/palette-6-1.gph` | 6 · 16 × 16 · 16-color | RLE |

For **each** file, record the exact Toolkit editor release, whether opening succeeds, whether the transparent and colored pixels render correctly, and whether saving a **copy** and reopening works. Preserve the original samples; note any conversion, changed format revision/mode, or rejection. These are synthetic, source-backed conformance fixtures—not verified editor-written files. The ZIP normalizes the fixture text to **CRLF line endings** for desktop compatibility while preserving field values and pixels; the committed source fixtures remain unchanged. Do **not** mark runtime GPH behavior as passed merely because the project runs.

The [manifest](manifest.json) lists exact ZIP locations, source fixture paths, GPH modes and compression, and coverage status. See the [matrix](../../docs/specs/test-matrix.md) for viewer and desktop results.

## Rebuild and validate

```sh
node scripts/build-tk2-test-game.mjs dist/tk2-legacy-game.zip --legacy
```

The generator includes the checked-in GPH fixture bytes unchanged, checks each GPH decodes as 16 × 16 with the declared mode and compression, verifies baseline project references, and checks the ZIP inventory. CI uploads this ZIP separately from the unchanged `tk2-test-game.zip` baseline.
