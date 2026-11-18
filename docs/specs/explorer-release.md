# Explorer release verification

Issues #123 and #37 define the shared archive and navigation checks.
#27 and #41 track the format specifications and Toolkit 2 converter
comparison. #63 supplies the legacy archive and its layout matrix.
#79 and #80 track native Toolkit 3 format and GAM coverage.

## Synthetic browser paths

| Archive | Inventory | Staged Chromium path |
| --- | ---: | --- |
| `tk2-legacy-game.zip` | 146 files | Wrapped GAM → BRD → exact TST tile. Back and Forward return to the board and tile. Trace BKG → MIDI and WAV and exercise transport. |
| Harbor native explorer fixture | 34 files | BRD inline Send → destination board with an incoming jump to the exact source slot and line. TEM → ANM → exact TST tile and frame WAV. WAV returns to the calling PRG line. ENE opens a linked ANM preview, and BKG opens a linked image. |

The staged test compares the file list with connected JSON for both
archives. The export contains project ownership, reference evidence,
decode status, and unresolved candidates. The public site includes
the generic player and uses the embedded GAM for Play even after
another GAM is opened for inspection.

## Local original archives

| Exact input and SHA-256 | Launch mode and observed checkpoint in local staged Chromium |
| --- | --- |
| `BSTW_EXPO_DEMO.zip` · `77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300` | All 285 files imported and exported. The GAM linked to the authored startup PRG. Play reported unsupported startup. Direct board diagnostics rendered `start.brd`, and Loyalis reached the generic `CMwin.prg:301` diagnostic. |
| `demo_tk310_start_board_playable(1).zip` · `367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f` | Direct board diagnostics reached the old man, the authored Send to `out.brd`, the pirate's simulated victory and removal, and the simulated defeat and fresh restart. |

The implementer ran these browser checks. Deployed browser acceptance
and original Toolkit editor/runtime parity are separate checks. The
existing 57-row Toolkit 2 ledger records partial and evidence-blocked
layouts, and #79 retains unresolved native and isometric format coverage.
