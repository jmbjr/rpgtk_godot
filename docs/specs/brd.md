# BRD · board

Specification revision **1.0** · [conventions](README.md). Partial binary
2.2/2.3 profile.

## Header and tile grid

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

## Remaining inspected fields

| Order | Fields |
| --- | --- |
| 1 | Background image zstr, two skipped zstr, i32 background color, four skipped bytes, i16 ambient mode. Ambient modes 0–3 map to RGB offsets (0,0,0), (75,75,75), (-75,-75,-75), (0,0,75); others use zero. |
| 2 | Four directional board zstr in North, South, East, West order. Skip two bytes, read battle background zstr, skip eight bytes, one zstr and 22 bytes. Read music zstr and nine layer-title zstr. |
| 3 | i16 maximum program index. For each of max plus one slots read program zstr, three i16 coordinates, graphic zstr, skip two bytes, four zstr and two bytes. Then read entry-program zstr and skip one zstr. |
| 4 | i16 maximum item index. For each of max plus one slots read item zstr, three i16 coordinates, skip two bytes, four zstr and two bytes, then read activation and multitask program zstr. |

Program and item counts may be zero and are bounded by input size.
Position fields are preserved as stored in reference evidence. The viewer
does not convert their coordinate basis. Blank and `none` asset slots
are omitted from references.

## Decoded record

`width`, `height`, `layers`, `layerTitles`, `background`, and `ambient`
describe the preview. `tileLookup` holds original values and optional
indexed references. Nonempty `runs` contain `offset`, `length`,
`lookupIndex`, and `shade`. `cellOrder` describes the offset convention.
The board preview uses the first frame of animated tiles. Later board
fields, tile-type behavior, and older text boards are outside the slice.

Evidence includes the demo's 17 boards and the pinned
[board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L461-L851)
for the compressed tile portion.
