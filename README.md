# RPG Toolkit 2 · Game Explorer

A static viewer for issue #3. Serve the repository root with Python 3 and open
`http://localhost:8000` in a browser.

```sh
python3 -m http.server 8000
```

Choose the game ZIP and optionally its separate Main File. The viewer reads
both files in browser memory. It indexes RPGCode source and resolves the
startup fields of binary Main File format 2.2. Browse the archive by folder.
Programs retain the command reference and source line jumps. Tilesets,
animated tiles, characters, and boards have file-specific previews. Select a
reference to jump to its source file, line, or numbered tile.

The connection index covers literal references in supported RPGCode
commands, configured Main File bindings, animation frames, board tile
placements, directional links, board program and item references, and
the decoded character fields. The map displays the static tile layers and
the first frame of animated tiles. **Tilesets used** includes direct tiles
and animation frames. Other folders remain browsable.

Format sources at the reviewed Toolkit 3 revision include the
[tileset reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1189-L1252),
[animation reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileAnim.bas#L88-L100),
[character reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686),
and [board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L575-L851).

## Smoke test

With Node.js 22 or later, run the fixture checks directly.

```sh
node scripts/smoke.mjs /path/to/Demo.zip /path/to/Demo.gam
```

Then check the browser workflow.

1. Open the supplied `Demo.zip`. Confirm 51 programs and the **Demo default**
   at `Demo/Prg/start.prg`.
2. Confirm 65 calls across 28 built-ins. Select `#SetButton` and jump to lines
   83, 84 and 85. Verify the local call at 33, the inline `#Dos` at 66 and the
   commented-out MIDI example at 26.
3. Open the supplied `Demo.gam`. Confirm **Configured startup**, with
   `Demo/Boards/house1.brd` and `Demo/Chrs/frap.tem` in the project bindings.
4. Select another program and verify its own source and command graph.
5. Choose **Tiles**, then `water2.tan`. Preview it and open its first frame.
   Confirm it selects tile 33 of `water.tst` and shows the reverse link.
6. Choose **Chrs** and `tano.tem`. Follow its **Used by** link to
   `getTano.prg:10`. Open `default.tst` and confirm `house1.brd` is a consumer.
7. Open `house1.brd` from **Boards**. Toggle layers and follow **Used by**
   to the incoming warp and Main File reference. Under **Tilesets used**,
   confirm `default.tst`. Open `castle_out.brd` and look for `water.tst`
   through `water2.tan`.
8. Repeat on the GitHub Pages deployment. Test an unreadable ZIP and a
   truncated Main File, then select valid files again to verify recovery.

The demo files are supplied separately. The graph shows static source use.
It does not evaluate RPGCode or infer reachability for other programs.

## Refresh the command catalog

Run the generator with the reviewed feature baseline and the two REF files,
oldest first. It records source identifiers and indexes the reference
signatures when supplied. Feature assignments outside the demo’s reviewed
trace are grouped by the source event category and can be refined in the
generator.

```sh
python3 scripts/build_catalog.py path/to/RPGTK_2x_Feature_Baseline.md \
  path/to/RPGCODE.REF path/to/rpgcodeEN.ref --output catalog.json
```

The bundled ZIP reader is JSZip 3.10.1 under its MIT option.
See [license](vendor/JSZip-LICENSE.md).
