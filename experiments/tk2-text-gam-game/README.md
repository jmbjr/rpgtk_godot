# Toolkit 2 text-GAM 2.0 coverage game

This is the **third, separately named test ZIP** in the
[issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63)
historical-format coverage series. It exercises the **GAM text 2.0**
main-file reader against the full existing legacy asset set.
The adjacent ZIPs remain `tk2-test-game.zip` (small binary-GAM baseline)
and `tk2-legacy-game.zip` (large binary-GAM coverage project).

## Download and inspect

In this PR's successful GitHub Actions run, download the
`tk2-text-gam-game` artifact. The outer GitHub Actions artifact ZIP
contains `tk2-text-gam-game.zip`. You can select the **outer download
directly** in [Game Explorer](https://jmbjr.github.io/rpgtk_godot/)
under **Game archive**, without unzipping twice.

The project contains **exactly one GAM**:

- `Main/TK2TextGamLab.gam` — text `RPGTLKIT MAIN`, version 2.0
- `Game/TK2TextGamLab/Prg/start.prg` — matching startup script
- `Game/TK2TextGamLab/Boards/room.brd` — unchanged 19×11 room,
  with a solid center tile
- `Game/TK2TextGamLab/Chrs/player.tem` — unchanged player graphics
- All other legacy fixtures from the binary-GAM `TK2LegacyLab` set,
  under the new project root

In Game Explorer, open the GAM and inspect the **configured startup,
opening board and initial character**. All three must resolve.
The GAM reader supports these 2.0 fields and their positions only;
most historical project settings are **not decoded or verified**.

## Byte-for-byte asset parity

This ZIP is derived from the versioned
[legacy manifest](../tk2-legacy-game/manifest.json), not a duplicate
hand-maintained list. Its [manifest](manifest.json) explicitly names the
new project, single GAM revision, and the three allowed content changes:

1. `Main/TK2TextGamLab.gam` uses the 2.0 text layout rather than binary 2.2.
2. `Prg/start.prg` contains the new project title.
3. The top-level README uses the new project name and instructions.

**All other assets must match byte-for-byte**, after renaming
`Game/TK2LegacyLab/` to `Game/TK2TextGamLab/`.
CI compares every entry and verifies the exact inventory, GAM version
and three resolved project bindings.

## Deferred desktop acceptance

When you return to Toolkit 2 desktop testing, extract the inner game
ZIP into the installation containing `Main` and `Game` directories,
then open `Main/TK2TextGamLab.gam` independently. Record which
Toolkit editor release accepts/rejects it; observe whether it upgrades
GAM 2.0 on save and whether the startup room runs. The common board
and player being statically valid does **not** establish GAM text
2.0 editor acceptance or runtime behavior.

## Rebuild

```sh
node scripts/build-tk2-test-game.mjs dist/tk2-legacy-game.zip --legacy
node scripts/build-tk2-test-game.mjs dist/tk2-text-gam-game.zip --text-gam
node scripts/check-alternate-gam.mjs dist/tk2-legacy-game.zip dist/tk2-text-gam-game.zip
```

The [57-row audit ledger](../../docs/specs/legacy-coverage-audit.json)
and [evidence blocker notes](../../docs/specs/unresolved-historical-evidence.md)
keep format inclusion distinct from verified historical editor compatibility.
