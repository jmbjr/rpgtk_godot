# TST · tileset

Specification revision **1.1** · TST format **20** · modes **1–6**.
See the [spec index](README.md) for JSON conventions.

## Format and mode

The **format revision** selects the file layout. TST stores it as the
integer `20`; this identifier is independent of the Toolkit release.
The **mode** selects tile dimensions and color encoding. The Toolkit source
calls this field `detail`. It is a mode code, not a ranking of quality.

The primary reference for all six modes is the Toolkit's own
[`CTile::calcInsertionPoint`](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1377-L1406),
which lists each mode's dimensions, nominal color count and byte stride.
[`openFromTileSet`](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1190-L1330)
shows the pixel and transparency rules; the
[palette rules](palette.md) link to the exact source color table.
This spec reconstructs the layout from the pinned legacy reader and
controlled fixtures; the [compatibility matrix](compatibility-matrix.md)
distinguishes fixture coverage from real game samples.

## Original file layout

A TST in this profile has a six-byte binary header and fixed-size tile
records. It has no string signature. All header values are signed 16-bit
little-endian integers in the supported viewer profile.

| Byte offset | Type | Meaning |
| --- | --- | --- |
| 0 | i16 LE | Format version. Must be `20`. |
| 2 | i16 LE | Tile count. Valid range `0..32767`. |
| 4 | i16 LE | Detail. `1`/`2` for true-color or `3`–`6` for [indexed palette tiles](palette.md). |
| 6 onward | RGB24 or indexes | Exactly `count × bytesPerTile` bytes. |

Details 3–6 use the [DOS palette layout and transparency rules](palette.md).
The following RGB byte rules apply to details 1 and 2.

Each tile contains `width × height` pixels in column-major order. Each pixel is three
consecutive unsigned bytes in **R, G, B** order. There are no row strides,
padding bytes, or compression. `[0, 1, 2]` is the transparent sentinel.
All other triples, including black, are opaque. Reject truncated headers,
unsupported version/detail values, negative counts, or payload sizes that
differ from the exact header-derived length.

## Tile addressing

Tile numbers in Toolkit references are **one-based**. For tile number
`n`, the payload starts at `6 + (n - 1) * bytesPerTile`. The tile size
is 3,072 bytes for detail 1 and 768 for detail 2. For zero-based
coordinates `(x, y)` within that tile, the RGB triple starts another
`3 * (x * height + y)` bytes later. X grows rightward and Y downward.

Legacy references append the decimal tile number immediately after the
extension, as in `default.tst10`. The viewer resolves the filename in the
archive and checks the tile number against `1..count`. A JSON reference
to this example can use
`rpgtk:/Demo/Tiles/default.tst#/data/tiles/9` and `tileIndex: 10`.
The pointer's array index is zero-based. A reference to the entire
tileset omits the fragment and tile index.

## Decoded JSON

Format `tst`. The [success schema](tile-record.schema.json) requires
`data.width` and `data.height` (both 32 or both 16), `data.count`,
`data.encoding: "base64 RGB24, column-major"`, `data.transparentRgb: [0, 1, 2]`,
and `data.tiles`. The array contains `count` objects in file order.
Each has a one-based `number` and `rgb`, a base64 string for the exact
stored bytes for details 1–2, or normalized palette RGB bytes for details 3–6.
See [palette normalization](palette.md#json-normalization). The RGB string has 4,096 characters for detail 1 or 1,024
for detail 2, with no padding. The sentinel stays in those bytes. The
viewer doubles detail 2 pixels with nearest-neighbor sampling for its
32 × 32 preview cells and keeps the original pixels in the export.
The count and sequential numbering are also checked by the
[conformance command](fixtures/README.md).

## Evidence and limits

- The original demo's `char.tst`, `default.tst`, `enemy.tst`, and
  `water.tst` all use this header and payload. The synthetic fixture
  exercises two tile offsets and distinguishable X/Y pixels. Detail 2 is
  verified with a separate synthetic fixture and the pinned source.
- The pinned Toolkit 3 source documents the [six-byte header](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1345-L1355),
  [RGB order and transparency](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1215-L1276),
  and [one-based offsets](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1377-L1406).
- Version 30 and isometric layouts appear in that
  source. They are outside this specification's supported profile.

<a name="binary-20-detail-1"></a>

## TST format 20 — Mode 1: 32 × 32, 24-bit RGB

Storage: binary. Mode 1: 32 × 32, 24-bit RGB stores each pixel as three RGB bytes. The transparent value is `[0,1,2]`.
The stored `detail` field is `1`.

<a name="binary-20-detail-2"></a>

## TST format 20 — Mode 2: 16 × 16, 24-bit RGB

Storage: binary. Mode 2: 16 × 16, 24-bit RGB stores each pixel as three RGB bytes. The transparent value is `[0,1,2]`.
The stored `detail` field is `2`.

<a name="binary-20-detail-3"></a>

## TST format 20 — Mode 3: 32 × 32, 256-color palette

Storage: binary. [Mode 3: 32 × 32, 256-color palette](palette.md) stores one palette index byte per pixel. Index `255` is transparent.
The stored `detail` field is `3`.

<a name="binary-20-detail-4"></a>

## TST format 20 — Mode 4: 16 × 16, 256-color palette

Storage: binary. [Mode 4: 16 × 16, 256-color palette](palette.md) stores one palette index byte per pixel. Index `255` is transparent.
The stored `detail` field is `4`.

<a name="binary-20-detail-5"></a>

## TST format 20 — Mode 5: 32 × 32, 16-color palette

Storage: binary. [Mode 5: 32 × 32, 16-color palette](palette.md) stores one palette index byte per pixel. Index `255` is transparent.
The stored `detail` field is `5`.

<a name="binary-20-detail-6"></a>

## TST format 20 — Mode 6: 16 × 16, 16-color palette

Storage: binary. [Mode 6: 16 × 16, 16-color palette](palette.md) stores one palette index byte per pixel. Index `255` is transparent.
The stored `detail` field is `6`.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
