# BRD · board

Specification revision **1.0** · [conventions](README.md). Partial text 2.0/2.1 and
binary 2.2/2.3 profiles.

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
