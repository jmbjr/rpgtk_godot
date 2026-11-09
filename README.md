# RPG Toolkit 2 · Game Explorer

A static viewer for issue #3. Serve the repository root with Python 3 and open
`http://localhost:8000` in a browser.

```sh
python3 -m http.server 8000
```

Choose the game ZIP and optionally its separate Main File. The viewer reads
both files in browser memory. It indexes RPGCode source and resolves the
startup fields of binary Main File format 2.2. Use a command in the source
or graph to inspect the reference and jump to its occurrences.

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
5. Repeat on the GitHub Pages deployment. Test an unreadable ZIP and a
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
