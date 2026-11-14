# BRD · board

Specification revision **1.1** · [conventions](README.md). Partial Toolkit 2
text 2.0/2.1 and binary 2.2/2.3, plus Toolkit 3 binary 2.4 profiles.

## Binary header and tile grid

Read binary header `RPGTLKIT BOARD`, major 2, minor 2 or 3. Skip an i16
and zstr. Read width, height and layer count as i16. Each is positive.
The viewer accepts at most 2,000,000 cells. Read three i16 start coordinates
and an i16 save-disabled flag, then read
an i16 maximum lookup index and that value plus one zstr lookup entries.

Traverse cells in layer, row, column order. A nonnegative i16 token is a
lookup index and places one cell. A negative token encodes run length
as its negation, followed by an i16 lookup index. Read three i16 RGB
shade offsets and one tile-type byte for either form. Index zero is
empty. Reject out-of-range indexes or runs exceeding the grid. For
zero-based coordinates, a cell offset is
`(layer * height + y) * width + x`.

## Remaining inspected binary fields

| Order | Fields |
| --- | --- |
| 1 | Background image zstr, two skipped zstr, i32 background color, four skipped bytes, i16 ambient mode. Ambient modes 0–3 map to RGB offsets (0,0,0), (75,75,75), (-75,-75,-75), (0,0,75); others use zero. |
| 2 | Four directional board zstr in North, South, East, West order. Skip two bytes, read battle background zstr, skip eight bytes, one zstr and 22 bytes. Read music zstr and nine layer-title zstr. |
| 3 | i16 maximum program index. For each of max plus one slots read program zstr, three i16 coordinates, graphic zstr and the six condition fields documented below. Then read entry-program zstr and skip one zstr. |
| 4 | i16 maximum item index. For each of max plus one slots read item zstr, three i16 coordinates and the six condition fields documented below, then read activation and multitask program zstr. |
| 5 (2.3) | Signed i32 maximum thread index, then that value plus one program filename zstr, then the raw coordinate-type byte. Index −1 means zero thread slots. |

Program and item counts may be zero and are bounded by input size.
Position fields are preserved as stored in reference evidence and the
structured `position` field. The viewer
does not convert their coordinate basis. Blank and `none` asset slots
are omitted from references. In 2.3, preserve blank thread slots in the
record and index nonempty thread filenames. Reject a thread count that
cannot fit before the coordinate byte or a truncated tail. The 2.2 tail
uses another order and remains outside the viewer's decoded profile.

The [pinned 2.3 writer](https://github.com/chrisbmatthews/rpgtoolkit/blob/0012b9f9b2093525b4edb42893c5a669cdbb491a/vb/tkCommon/modules/CommonBoard.bas#L724-L734)
and [3.1 compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L1008-L1028)
agree on the 2.3 tail order. The
[historical demo board](https://github.com/chrisbmatthews/rpgtoolkit/blob/4133fc81d4144582e06a63ffc6017eec770d2d86/build/game/demo/Boards/start.brd)
verified the common prefix and a blank thread slot. Synthetic fixtures
exercise populated, empty, and invalid tails.

## Text 2.0 and 2.1

The first line is `RPGTLKIT BOARD`, followed by lines for major 2, the
minor version, and the registration flag and code. Text 2.0 has a fixed
19 × 11 grid, with the first tile immediately after the registration
code. Text 2.1 has two extra lines containing width and height. Both
have eight layers. The text grid stores columns first, then rows, then
layers. Each cell has five lines containing the tile name, red, green
and blue shade offsets, and tile type. Blank numeric fields in the
inspected layout read as zero. The viewer normalizes placed tiles into
the same layer, row, column offsets as binary boards.

After the grid, read the board and border background names, two colors,
ambient mode, four directional links, three battle fields, ten board
constants, music, and eight layer titles. Next come 51 program slots of
11 lines and 11 item slots of 10 lines. Each slot starts with a filename
and three coordinates. A program slot also contains a graphic name.
After three player start coordinates, read 11 item activation scripts,
one save flag and 11 item multitask scripts. Later fields are outside
this slice.

Text 2.1 is verified against `cluetest/Boards/start.brd` and 59 DustBall boards.
Text 2.0 has a
synthetic fixture based on the fixed-size branch of the
[pinned Toolkit 3.0.4 development compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonBoard.bas#L1016-L1118).

## Decoded record

`width`, `height`, `layers`, `layerTitles`, `background`, and `ambient`
describe the preview. `tileLookup` holds original values and optional
indexed references. Nonempty `runs` contain `offset`, `length`,
`lookupIndex`, and `shade`. `cellOrder` describes the offset convention.
Binary 2.3 adds `threads` and `coordinateType` to the record. The preview
uses its existing tile grid and the first frame of animated tiles.
Coordinate conversion, execution of tile-type behavior, and other uninspected fields
and text revisions are outside the slice.

Evidence includes the demo's 17 boards and the pinned
[board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L461-L851)
for the compressed tile portion.

## Compatibility audit

| Layout | Viewer evidence | Toolkit 3 compatibility path |
| --- | --- | --- |
| Text 2.0 | Pinned reader and synthetic fixture | The 3.0.4 development reader applies fixed dimensions and reads the old text grid. |
| Text 2.1 | Cluetest and synthetic fixture | The same reader reads dimensions before the old text grid. |
| Binary 2.2 | Demo and synthetic fixture | The 3.1 reader dispatches it to its pre-vector branch. |
| Binary 2.3 | Historical demo board and synthetic fixtures cover the prefix and the thread/coordinate tail. | The 3.1 reader reads counted thread slots before the coordinate byte. |
| Headerless board | Outside current coverage | The earlier reader has a separate fallback. The exact variants and fixtures still need verification. |

The [later Toolkit 3.1 reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L449-L484)
directs users of old text boards to re-save them in 3.0.6 or earlier.

## Tile types and placement conditions

The decoded record adds `tileTypes`, `programs`, `items`, `start` and
`saveDisabled` for every supported text/binary BRD layout.

`tileTypes` is an exhaustive, compact array of `{offset, length, value}`
runs. It uses the same zero-based layer/row/column offset as graphic runs.
It includes every cell, even when its filename or lookup index is empty.
Adjacent identical values are merged. Binary input uses an unsigned byte
per source graphic run; text input uses an integer per cell, normalized
from x/y/layer traversal. Unknown numeric codes are preserved.

The [older board structure](https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonBoard.bas#L37)
labels codes 0 normal, 1 solid, 2 under, 3 north/south normal, 4 east/west
normal and 11–18 elevate to layer 1–8. These are source labels; the viewer
does not simulate their collision or movement behavior. The optional map
overlay shows nonzero codes; selecting a layer isolates it, and clicking
a cell reports stored codes for the selected layer(s). Overlaying all
layers can overlap codes at the same screen position.

`programs` preserves all stored slots as `{slot, program, position,
graphic, condition}`. `items` preserves all slots as `{slot, item,
position, condition, activationProgram, multitaskProgram}`. `slot` is
zero-based. Text has 51 program and 11 item slots; binary uses its counted
slot arrays. Empty filenames are retained. Graph edges remain limited
to nonempty asset references and carry the existing position evidence.

Each `condition` contains the following six source fields in order:

| Field | Storage | Source meaning |
| --- | --- | --- |
| `mode` | Integer (binary i16) | 0 always active; 1 conditional |
| `initialVariable` | String | Activation variable |
| `finalVariable` | String | Variable at end of activation |
| `initialValue` | String | Initial activation value |
| `finalValue` | String | Value at end of activation |
| `type` | Integer (binary i16) | 0 step on; 1 activation key |

Preserve lexical values such as `"01"`, expressions and unknown numeric
flags. Conditions are displayed without evaluation or gameplay inference.
The [binary reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L950-L1008)
and the earlier text reader linked above establish this sequence.

`start` is the stored `{x,y,layer}` player start. `saveDisabled` preserves
the raw integer (0 allows saving, 1 disables it). No coordinate conversion
is applied. Controlled fixtures cover conditional and blank slots,
lexical values, invisible tile types, unknown codes, RLE runs crossing
rows/layers, and truncated condition tails. These are data extraction
and inspection features, not a running Toolkit engine.

## Text 2.0

Line-oriented `RPGTLKIT BOARD`, major 2, minor 0. Width/height are implicit 19 × 11 with eight layers; no dimension tokens follow registration. See [text layouts](#text-20-and-21) and [tile types and conditions](#tile-types-and-placement-conditions). Tile cells store graphic filenames, not embedded pixels.

## Text 2.1

Line-oriented `RPGTLKIT BOARD`, major 2, minor 1. Explicit width and height follow registration; eight layers are stored. See [text layouts](#text-20-and-21) and [tile types and conditions](#tile-types-and-placement-conditions). Tile cells store graphic filenames.

## Binary 2.2

Binary `RPGTLKIT BOARD`, major 2, minor 2. Use the [binary grid](#binary-header-and-tile-grid), inspected placement fields, and [conditions/types](#tile-types-and-placement-conditions). The viewer stops after item activation/multitask programs; the remaining 2.2 tail is outside this profile.

## Binary 2.3

Binary `RPGTLKIT BOARD`, major 2, minor 3. The common binary grid and placements are followed by counted thread filenames and a coordinate-type byte. See [remaining binary fields](#remaining-inspected-binary-fields). Coordinates are preserved without conversion.

## Binary 2.4

**Native Toolkit 3 vector-board layout.** The NUL-terminated header is
`RPGTLKIT BOARD`, little-endian i16 major 2 and minor 4. This branch
does **not** share the registration/start/per-tile shading sequence of
binary 2.2/2.3. The [pinned 3.1 source reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L486-L685)
establishes the following inspected prefix:

1. Four i16 values: width, height, layer count, coordinate type.
   A further i16 is the **maximum tile-lookup index**, followed by
   maximum-plus-one NUL-terminated tile names.
2. Tiles traverse **layer, row, column** order. A nonnegative i16 is
   a single lookup index; a negative i16 is the *negative run length*,
   followed by one i16 lookup index. Unlike 2.3, there are **no**
   RGB shading or tile-type values following these tile tokens.
3. The shading-block maximum is an i16. Each block stores a **layer i32**
   followed by records of `run length i16, R i16, G i16, B i16`,
   covering that layer's width × height positions. A source run
   crossing the layer boundary is clamped in the visual preview
   while `storedLength` retains the original value.
4. The light maximum is an i16; each light holds layer i32,
   type i32, a maximum-point i16 followed by i32 x/y point pairs,
   and a maximum-color i16 followed by i16 RGB triples.
5. The vector maximum is an i16; each vector holds a maximum-point
   i16 and i32 x/y pairs, then i16 **attributes**, **closed** flag,
   **layer**, **tile type**, and a NUL-terminated **handle**.
   The raw signed closed flag is retained (Toolkit VB true may be
   `-1`). Each maximum index of `-1` signifies an empty list.

After the vector block, the source-defined **native 2.4 tail is now
decoded to exact EOF**. It is deliberately *not* mapped onto the older
pre-vector `programs`/`items` record shapes. The source:
[pinned CommonBoard reader, native branch](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L667-L791).

| Order | Stored tail fields |
| --- | --- |
| Native programs | i16 inclusive maximum index; each record has filename and graphic zstr, initial/final variable/value zstr, four i16 activation/type/repeat-distance/layer values, an i16 inclusive maximum vector-point index with i32 x/y pairs, a raw i16 closed flag and handle zstr. |
| Placed item sprites | i16 inclusive maximum index; each record stores filename, activation program, multitask program, initial/final/loading variable/value zstr (**nine strings**), activation and activation-type i16, x/y/layer i16, and associated waypoint-vector index i16. Positions in code 4 are stored pixel coordinates. |
| Images | i16 inclusive maximum index; each record stores filename zstr, left/top i32, layer i16, draw-type i16, transparent COLORREF i32 and reserved translucency i16. |
| Threads and board constants | Independent i16 inclusive maximum indices and maximum-plus-one filename/constant zstr arrays. Blank values remain stored slots, not resolved references. |
| Labels and links | `layers+1` original layer-title zstr entries (including index 0), then four directional board zstr in North, South, East, West order. The existing viewer still presents a normalized nine-title list. |
| Background and music | Background-image filename zstr, draw-type i32, background-color i32, music filename zstr. |
| Startup and combat | Entry-program zstr, battle-background zstr, skill i16, allow-battles i16, save-disabled i16, ambient signed RGB i16 triples, then player start x/y/layer i16. No further bytes are accepted. |

Native board decoded records preserve `nativePrograms`, `sprites`,
`images`, `threads`, `constants`, `storedLayerTitles`,
`directionalLinks`, all background/combat settings, `start`,
`saveDisabled`, `ambient`, and their raw field values. Every
nonempty supported filename generates a static reference with
position evidence where the source provides coordinates. The board
inspector lists sprite and program slots, links directly to referenced
ITMs and RPGCode files, and shows a **toggleable source-pixel marker
overlay for standard pixel coordinate code 4**, filtered by layer.
Other coordinate modes retain raw values and **do not receive guessed
sprite projections**.

The exported `vectors` preserve each point and raw attributes,
closed flag, layer, tile type and handle; the `lights` and
`shadingLayers` preserve their raw source values. The regular `runs`
combine tile indices and applicable shade blocks for the existing
tile renderer. No imaginary per-cell `tileTypes` are manufactured
in the 2.4 branch. Unlike the earlier partial reader, `background`
and `ambient` now reflect source fields rather than neutral
preview defaults. **Static references, conditions and positions
do not prove live execution or editor/runtime visual parity.**

**BSTW evidence:** The owner-provided
[BSTW Expo Demo](https://github.com/jmbjr/rpgtk_godot/issues/79)
has 285 files, SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`.
Its `BSTW/Boards/start.brd` is 2,093 bytes,
20 × 15 tiles × 2 layers, coordinate code 4, with 9 vector
records and **86 points**. `start2.brd` has 9 vectors and
**67 points**. Seven additional tiny 2.4 boards store other
coordinate codes and zero vectors. These are sample observations;
the game bytes remain **outside this repository**.

The board inspector shows the grid through existing resolved TST
references. For coordinate code **4**, the optional vector overlay
uses raw source pixels scaled by the board preview's 32-pixel
tile cell. This produces an **inspectable diagnostic geometry plot**,
not a claim of pixel-for-pixel editor/runtime parity. Other coordinate
codes are preserved, but rotated, stacked or isometric vector
projections are **not guessed**. The overlay can be toggled and
filtered by stored layer; point coordinates, attributes, tile types,
closed flags and handles remain accessible in the inspector and
[connected-game JSON](connected-game.md).

The [synthetic BRD 2.4 fixture](fixtures/board-24-fixtures.mjs)
and [prefix checks](../../scripts/check-bstw-board-24.mjs)
now cover the complete native file shape, not a truncated
vector-only specimen. The [new tail regression](../../scripts/check-bstw-board-tail.mjs)
independently checks program/sprite/image fields, blank and populated
slot counts, raw positional references, exact player-start and
ambient data, connected-game JSON and deliberate malformed tails.

Direct BSTW evidence: **both `start.brd` and `start2.brd` have
seven placed native item sprites**. Six share the same coordinates:
`lami.itm` (82,200), `rusty.itm` (432,228),
`jim.itm` (590,55), and three `door.itm` placements
(207,349), (512,414), (495,223), all on layer 1.
The doors have separate activation scripts `mwininn.prg`,
`mwinuglyhouse.prg`, `mwinsmallhouse.prg`.
The seventh slot is `loyalis.itm` at (115,115) in
`start.brd`, but `house_3x3.itm` at (325,100) in
`start2.brd`. Both boards have **zero native programs and
images**, one blank thread, eleven `"0"` constants, music
`townmusic-final-8b.mp3`, and player start (107,78,layer 1).
The remaining seven boards have empty sprite/program/image
arrays and parse through the source-defined tail to exact EOF.

Running the tail test with a local BSTW ZIP path checks SHA-256
and all nine original board records. The original third-party
archive remains outside Git and CI.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
