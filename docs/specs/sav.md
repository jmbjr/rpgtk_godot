# SAV · Toolkit 3 saved-game state

Specification revision **1.0** · [conventions](README.md).

## Binary 3.4

Native Toolkit 3.1 writes the NUL-terminated **RPGTLKIT SAVE** signature
then little-endian **major i16 = 3, minor i16 = 4**. A file-format
revision is distinct from the Toolkit product release and exported
JSON schema revision.

Authoritative source: [pinned native runtime save reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/state.cpp#L92-L568)
and [matching save writer](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/state.cpp#L573-L940).
The older VB save loader covers a different layout and is not the
authority for the native 3.4 count widths.

| Order | Source-defined records |
| --- | --- |
| 1. Globals | Four i32-counted tables: numeric name zstr + f64, object name zstr + f64, literal name zstr + value zstr, and redirect name zstr + target zstr. Object numbers are engine object identities, not filenames. |
| 2. Party | i32 player count, then name and character filename zstr pairs. Empty names/filenames preserve empty slots. |
| 3. Inventory | **i16 count**, each filename zstr + handle zstr + signed quantity i32. |
| 4. Equipment | For each of sixteen 1-based equipment slots, a filename and handle zstr pair for each player (slot-major, player-major). Then four signed i32 modifiers (HP, SMP, defense, fight) per player. |
| 5. Presentation | Menu color, selected player, gold, message-window color as i32; window-background zstr; debug/font color i32; font-face zstr; font size, bold, underline, italic, game time in seconds and steps in tiles as six i32; Main File and current-board zstr. |
| 6. Positions | Per player: x/y **f64 pixel coordinates**, layer and active as i32, and four i32 waypoint values (vector index, cycles, next node, attributes). Then per-player next level/progression i32 pairs. |
| 7. Other players | 26 former player filename/handle zstr pairs, menu/fight graphics zstr, unused window-width i32, and last swapped-character name zstr. |
| 8. World items | i32 **slot count**. Empty slot: one empty filename zstr only. Populated slot: filename and six activation/condition zstr, two signed **i16 activation flags**, x/y f64, then layer, active, vector index, cycles, next node, attributes as i32. Source-defined state can differ from authored BRD placements. |
| 9. Threads | i32 **inclusive maximum thread index**; each slot has filename zstr, persistence i32 and conditional item-link data, sleeping flag i32 and duration f64. Nonempty threads may include nested CProgram execution state. |
| 10. Runtime tail | After empty or otherwise fully understood thread records: movement size f64; i32 object-mapping count, each object ID i32 + class-name zstr; then final loop-offset i32 and exact EOF. |

The decoder exports globals, party, inventory, equipment,
equipmentModifiers, misc, positions, levelProgress, formerPlayers,
presentation, worldItems, threads, movementSize, objectClasses
and loopOffset. Counts and strings have bounded limits, doubles must
be finite, and a **complete** record must finish at exact EOF.

A nonempty thread filename invokes a separate native program-state
serializer, which is deliberately **not guessed** in this slice.
The decoder returns a structurally valid known prefix with
**completion = active-thread-state-unparsed** and an explicit
unparsedTailBytes count. This is distinct from full
**completion = complete**. Neither state asserts that a browser
can resume the saved execution.

The inspector shows the party, character positions, equipment,
inventory, saved world items and click-through asset references.
It provides a name/value search of the large global tables but
renders no more than 40 matching rows at a time. All stored values
remain intact in standalone and connected-game JSON. Static references
resolve the basename of source filenames, retaining the original
Windows path strings in the raw record. Inspecting or exporting
a SAV does not execute RPGCode or any DLL.

### BSTW Expo Demo evidence

Read-only owner ZIP: **BSTW_EXPO_DEMO (1).zip**, SHA-256
77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300.
Its sole save is **BSTW/Misc/NewFile.sav**, 149,796 bytes.
An independent source-guided byte walk parsed all records to exact EOF.

| Section | Verified original sample |
| --- | --- |
| Globals | 4,055 numeric; 1,271 object; 664 literal; 0 redirects |
| Party | Bruce (bruce.tem) and Loyalis (loyalis.tem); Bruce selected |
| Inventory | BUGS.ITM, handle bugs, quantity 3 |
| Equipment | hat.itm in different slots on both party members; HP +1, SMP +4, defense +2, fight +3 on both |
| Main File / current board | Main\BSTW.gam / start.brd |
| Gold / game time | 12,345 / 52 seconds |
| Player coordinates | Bruce (133,117,layer 1), active; Loyalis (0,0,layer 1), inactive |
| World item slots | 12 slots; only slot 11 has hat.itm |
| Threads | One empty slot; no nested thread state |
| Runtime tail | Movement size 0; 1,297 object-class mappings; loop offset 0 |

Counts describe **stored state entries**, not executable game
capabilities, and object-class mappings are not plugin declarations.
A current-board item record cannot prove that its interaction
will occur during play.

[Small synthetic fixture](fixtures/native-save-34-fixtures.mjs)
and [CI regression](../../scripts/check-bstw-sav-34.mjs)
check field alignment, i16 versus i32 widths, preserved blank slots,
typed variables, saved links, complete/opaque thread distinctions,
JSON schema, truncation and unsupported versions. An optional
local owner-ZIP argument validates the same parser against the
original archive hash, without committing the game files.

## Unsupported versions

Only binary **3.4** is supported. Older text and other binary save
revisions need separate source and file evidence. The viewer
does not write or execute saves.
