# GPH · standalone tile

Specification revision **1.0** · Toolkit text format **2.0**.
See the [spec index](README.md) for JSON conventions.

## Original file layout

The header and payload are line-oriented. The supported tokens are ASCII
in the Toolkit's Windows-1252 text encoding. Canonical numeric tokens are
decimal integers. Writers can use CRLF line endings. The viewer also
accepts LF and CR, trims whitespace around tokens, and compares the
signature without regard to case.

| Line | Value | Meaning |
| --- | --- | --- |
| 1 | `RPGTLKIT TILE` | Signature |
| 2 | `2` | Major format version |
| 3 | `0` | Minor format version |
| 4 | `1` or `2` | Detail 1 is 32 × 32. Detail 2 is 16 × 16. Both use true-color values. |
| 5 | `0` or `1` | Raw pixels or run-length encoding |
| 6 onward | Decimal tokens | Pixel payload |

With compression `0`, read one color per line for exactly the tile's pixel
count. With compression `1`, read a positive run length on one line and
one color on the next. Repeat the color for the given count, then read the
next pair. Runs can cross columns. The expanded pixel count must reach
`width × height` exactly. An incomplete payload, invalid color or run, or
run that overshoots the pixel count is an error. The viewer stops reading
when the tile is complete. Canonical writers end the payload there.

Pixels are **column-major**, with zero-based `x` increasing rightward and
`y` increasing downward. The expanded array index is `x * height + y`.

| Stored color | Decoded pixel |
| --- | --- |
| `-1` | Transparent |
| `0` through `16777215` | Opaque Windows COLORREF, packed as `0x00BBGGRR` |

For opaque values, red is the low byte, green the next byte, and blue the
third. Decimal `255` is red, `65280` is green, and `16711680` is blue.
Decimal `0` is opaque black. The inspector enlarges 16 × 16 previews using
nearest-neighbor sampling. The stored coordinates and decoded JSON stay
16 × 16.

## Decoded JSON

Format `gph`. The [success schema](tile-record.schema.json) requires
`data.width`, `data.height`, `data.detail`, boolean `data.compressed`,
`data.order: "column-major"`,
`data.encoding: "Toolkit COLORREF; -1 is transparent"`, and the expanded
`data.pixels` array of original color integers. References to a GPH point
to the whole record. The [fixtures](fixtures/README.md) include raw and
compressed examples with expected records.

## Evidence and limits

- The demo's `Demo/Tiles/key.gph` verifies the text 2.0, detail 1,
  compressed variant.
- The pinned Toolkit 3 [compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L994-L1127)
  corroborates header order, pixel traversal, true-color dimensions,
  transparency, and run expansion. Synthetic fixtures exercise the
  additional combinations.
- Version 1 and indexed palette detail levels 3–6 appear in the
  compatibility reader. They are outside this specification's supported
  profile. Toolkit 2 Help's *Tileset Manager* distinguishes standalone
  GPH tiles from grouped TST tiles and describes the different detail levels.
