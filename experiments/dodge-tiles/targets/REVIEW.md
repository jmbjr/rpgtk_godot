# Review the Toolkit tileset cards

This fixture contains two cards from `two-tiles.tst`. Tile 01 comes before Tile 02. Both builds use the same two labeled fronts. The fixture board is included as source evidence in `build.json`.

## Print and play

Open `tile-cards.pdf`. Print on US Letter paper at **Actual size** or **100%**, with fit-to-page disabled. Trim at the crop marks. Each finished card measures 2.5 × 3.5 inches.

## Tabletop Simulator

1. Extract the whole download to a permanent folder, including `assets/`.
2. With Python 3 installed, open PowerShell in that folder and run:

   ```powershell
   py -3 .\prepare-tts.py .\tile-cards.tts.json "$([Environment]::GetFolderPath('MyDocuments'))\My Games\Tabletop Simulator\Saves\Toolkit-tile-cards.json"
   ```

   Use your configured TTS Saves folder if it differs from the Windows default. The script creates a new save, so use a new filename on subsequent reviews.
3. In TTS, open **Games → Save & Load** and load **Toolkit tile reference cards**. Check that Tile 01 and Tile 02 are face up, left to right, with the same art as the PDF.

The script binds the save to the extracted PNGs using absolute local paths. The review is for local single-player use. If you move the folder, prepare a new save from the original JSON.

## Trace the cards

- `build.json` records the source commit, DODGE revision, asset hashes, and target coverage.
- `dodge.json` contains the reference display and declared card order. Both manifests resolve the same two members.
- `toolkit-sidecar.json` preserves the original Toolkit records. Its board cell points to `two-tiles.tst2` and uses the same object ID as Tile 02.
