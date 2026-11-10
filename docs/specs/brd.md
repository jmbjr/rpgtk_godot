# BRD · board

Specification revision **1.0** · [conventions](README.md). Partial text 2.0/2.1 and
binary 2.2/2.3 profiles.

## Binary header and tile grid

Read binary header `RPGTLKIT BOARD`, major 2, minor 2 or 3. Skip an i16
and zstr. Read width, height and layer count as i16. Each is positive.
The viewer accepts at most 2,000,000 cells. Skip eight bytes, then read
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
| 3 | i16 maximum program index. For each of max plus one slots read program zstr, three i16 coordinates, graphic zstr, skip two bytes, four zstr and two bytes. Then read entry-program zstr and skip one zstr. |
| 4 | i16 maximum item index. For each of max plus one slots read item zstr, three i16 coordinates, skip two bytes, four zstr and two bytes, then read activation and multitask program zstr. |

Program and item counts may be zero and are bounded by input size.
Position fields are preserved as stored in reference evidence and the
structured `position` field. The viewer
does not convert their coordinate basis. Blank and `none` asset slots
are omitted from references.

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
The board preview uses the first frame of animated tiles. Later board
fields, tile-type behavior, and other text revisions are outside the slice.

Evidence includes the demo's 17 boards and the pinned
[board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L461-L851)
for the compressed tile portion.

## Compatibility audit

| Layout | Viewer evidence | Toolkit 3 compatibility path |
| --- | --- | --- |
| Text 2.0 | Pinned reader and synthetic fixture | The 3.0.4 development reader applies fixed dimensions and reads the old text grid. |
| Text 2.1 | Cluetest and synthetic fixture | The same reader reads dimensions before the old text grid. |
| Binary 2.2 | Demo and synthetic fixture | The 3.1 reader dispatches it to its pre-vector branch. |
| Binary 2.3 | Viewer accepts it. A dedicated fixture still needs verification. | The 3.1 reader dispatches it to its pre-vector branch, with version-specific tail fields. |
| Headerless board | Outside current coverage | The earlier reader has a separate fallback. The exact variants and fixtures still need verification. |

The [later Toolkit 3.1 reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L449-L484)
directs users of old text boards to re-save them in 3.0.6 or earlier.
