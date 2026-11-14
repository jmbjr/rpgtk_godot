# TBM · native Toolkit 3 tile bitmap

Specification revision **1.0** · [conventions](README.md).

## Binary 3.0

The Toolkit 3 tile-bitmap format uses NUL-terminated **\`TK3 TILEBITMAP\`**
(not \`RPGTLKIT TILEBITMAP\`), followed by little-endian i16
major **3** and minor **0**. The [pinned Toolkit 3.1 reader and
writer](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileBitmap.bas#L200-L290)
and [native trans3 renderer](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/tilebitmap.cpp#L69-L175)
establish the record order:

1. i16 **visible width** and **visible height** in 32-pixel tiles.
2. **Inclusive storage grid:** loop x = 0..width, then y = 0..height.
   Each of the \`(width + 1) × (height + 1)\` records stores:
   filename zstr, signed red shade i16, signed green shade i16,
   signed blue shade i16.
3. The renderer uses **only** \`x < width\` and \`y < height\`.
   The extra stored column and row are therefore preserved as source
   evidence but not stamped onto the visible preview.
4. A nonempty tile filename such as \`default.tst48\` is a reference
   to one-based TST tile 48. The existing archive graph resolves its
   \`default.tst\` file and tile number. Empty slots are blank.

The decoder preserves all stored cells in column-major order as
\`tiles: [{x, y, value, shade}]\`, alongside visible \`width\`,
\`height\`, \`storedColumns\`, and \`storedRows\`. It refuses bad
signatures/revisions, truncated records, implausibly large dimensions,
and trailing bytes. Each nonempty stored filename generates a graph
reference; including any nonempty offscreen sentinel records is
intentional.

The preview produces a 32×32 pixel stamp per visible tile from
the already-supported TST 20 decoder, applies signed per-channel
shade offsets to **opaque** pixels, preserves transparent pixels,
and assembles an RGBA bitmap. The same function handles standalone
TBM inspection, native ANM frame playback, and first-frame thumbnails
for Toolkit 3 ITM direction links. Missing TST references remain
visible as unresolved edges; no substitute artwork is fabricated.

### Evidence from BSTW Expo Demo

The owner-uploaded \`BSTW_EXPO_DEMO (1).zip\` (SHA-256
\`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300\`)
has two \`TK3 TILEBITMAP\` 3.0 files:

| Source | Stored grid | Display | Size |
| --- | --- | --- | --- |
| \`BSTW/Bitmap/house_3x3_closed.tbm\` | 4 × 4 records | 3 × 3 tiles / 96 × 96 pixels | 252 bytes |
| \`BSTW/Bitmap/house_3x3_open.tbm\` | 4 × 4 records | 3 × 3 tiles / 96 × 96 pixels | 252 bytes |

Each bitmap stores nine visible references to the existing
\`BSTW/Tiles/default.tst\`; the saved extra row/column are blank.
Both have zero RGB shades. The visible tiles match in eight cells.
Only **bottom-center tile** (zero-based x = 1, y = 2) differs:
closed \`default.tst48\` versus open \`default.tst49\`.

\`BSTW/Misc/house_3x3.anm\` (native ANM binary 2.3) references
these two TBMs in order; the ANM has a stored **96 × 96** frame
size. \`BSTW/Item/house_3x3.itm\` (ITM binary 2.7)
points to this ANM. This forms a complete static inspection chain:
**ITM → ANM → TBM → TST tile**. No Toolkit executable or DLL is
run to display the result.

The [synthetic TBM 3.0 fixtures](fixtures/native-tbm-30-fixtures.mjs)
and [CI regression](../../scripts/check-bstw-tbm-30.mjs) use distinct
tiles, a nonempty offscreen sentinel, signed shades, one transparent
pixel, and a deliberate two-frame difference. The test asserts
the two 96×96 pixel images differ **only** inside their
bottom-center cell, validates connected JSON and spec links,
and rejects invalid data. Passing the optional test with the
owner ZIP path verifies production reader behavior for this sample
without committing copyrighted game data.

**Limitations:** Editor/runtime parity and animation compositing
under nondefault ambient light remain unverified. This profile
does not infer isometric TBM behavior, image codecs for other
extensions, item activation mechanics, or plugin execution.

## Unsupported versions

Only the verified \`TK3 TILEBITMAP\` binary 3.0 layout is supported.
Later or unrelated header versions are reported as unsupported.
