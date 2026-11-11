# Toolkit DOS palette

Specification revision **1.0**. Shared by TST version 20 and GPH text 2.0,
detail levels 3–6. These files contain indexes, not an embedded palette.

| Mode (`detail`) | Native dimensions | Nominal color mode | Stored bytes per TST tile |
| --- | --- | --- | --- |
| 3 | 32 × 32 | 256 colors | 1,024 |
| 4 | 16 × 16 | 256 colors | 256 |
| 5 | 32 × 32 | 16 colors | 1,024 |
| 6 | 16 × 16 | 16 colors | 256 |

All four modes use one unsigned byte per TST pixel, including the
nominal 16-color modes. They are not packed nibbles. The compatibility
reader accepts the full byte range in all modes; the viewer follows it.
Pixels and runs traverse columns before moving right.

The exact 256-entry COLORREF table is exported as `dosPalette` in
[`tile-palette.mjs`](../../tile-palette.mjs). It transcribes the numeric
`CTile::g_pnDosPalette` table from the pinned
[Toolkit source](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L73-L335).
COLORREF uses red in the low byte, green in the next, and blue in the
third. Use this exact table rather than a generic EGA/VGA palette.
For example, indexes 1, 2, 4, 15 and 40 give RGB `(0,0,168)`,
`(0,168,0)`, `(168,0,0)`, `(255,255,255)` and `(255,0,0)`.

| File | Transparent token | Opaque black |
| --- | --- | --- |
| TST palette payload | Index `255` | Index `0` |
| GPH raw/RLE payload | Decimal `-1` | Index `0` or `255` |

GPH accepts indexes `0..255` or `-1`; reject other values. GPH RLE
counts must be positive integers and cannot exceed the remaining pixels.
The transparent token must be handled before looking up a palette color.

## JSON normalization

TST exports use the existing native-size RGB24 representation. Palette
indexes expand to RGB triples, with transparent index 255 normalized to
`[0,1,2]`. `byteLength` remains the original file size, so it differs from
the expanded RGB payload size. GPH exports retain the source `detail`
and expand indexes to COLORREF values; transparent `-1` stays `-1`.
Consumers can use the same RGB/COLORREF rendering path as true-color
files. This normalization preserves rendered pixels, not the original
palette indexes or a byte-for-byte source round trip.

## Evidence and limits

Controlled fixtures cover each detail with two TST entries and both raw
and RLE GPH. They verify axis order, 16 × 16 scaling, transparency,
opaque black, exact tile references, JSON and PDF output.
Real Toolkit 2 examples of these indexed variants are still needed.

The pinned TK3 GPH reader converts indexes for details 3 and 5 but omits
that conversion in its detail 4 and 6 branches, unlike its TST reader.
The [Toolkit editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/Toolkit/forms/TILEEDIT.FRM#L1233-L1239)
selects DOS colors for every detail other than 1 and 2. The viewer consistently applies the DOS palette to all four indexed
GPH modes. This is an intentional correction of that inconsistency,
covered by controlled fixtures; it is not a claim that the old reader
renders every GPH variant correctly. GPH version 1, TST version 30 and
isometric layouts remain outside this profile.
