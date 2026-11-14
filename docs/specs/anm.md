# ANM · effect animation

Specification revision **1.1** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT ANIM`; native Toolkit 3 binary 2.3 is also read.

Read width and height in pixels, then the stored frame count. Read
exactly 51 frame slots, each containing image filename, transparent
COLORREF number (`0x00BBGGRR`), and sound filename. Read the numeric
pause in seconds after the slots. Preserve empty slots and the stored
count. For example `explode.anm` stores count 0 but has eight images.

Decoded data contains `width`, `height`, `storedFrameCount`, `frames`
with `image`, `transparentColor` and `sound`, and `pauseSeconds`.
The viewer previews through the last nonempty image or sound slot,
preserving interior blanks. It masks exact RGB matches to the key and
triggers linked sounds during playback. Frame labels are one-based.

Evidence includes `explode.anm`, Toolkit 2 Help's Animation Editor, and
the pinned [compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonAnimation.bas#L140-L164).

## Text 2.0

Line-oriented `RPGTLKIT ANIM`, major 2, minor 0. Use the fixed 51 frame slots and stored frame-count interpretation above. Each slot preserves its image, transparent color and sound. Later binary animation layouts are not this profile.

## Binary 2.3

**Native Toolkit 3 animation format**, verified from the
[pinned animation reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonAnimation.bas#L119-L154)
and the owner-supplied BSTW Expo Demo.

The file starts with NUL-terminated `RPGTLKIT ANIM`, i16 major 2,
i16 minor 3, then i32 pixel width, i32 pixel height, and an i32
**maximum frame index**. Read exactly maximum-plus-one frame
records: image zstr, signed i32 transparent COLORREF, sound zstr.
Finally read an IEEE-754 little-endian **float64 pause (seconds)**.
The reader rejects truncated records, unreasonable dimensions/counts,
non-finite or negative pauses and unexpected trailing bytes.

A frame image may reference an indexed tileset cell such as
`FLcharacters.tst14`. The existing reference graph splits this into
the resolved `FLcharacters.tst` path and one-based tile index 14.
The animation inspector paints that tile using the existing
`tilePixels` decoder, then applies the stored transparency key.
For a frame referring to a native Toolkit 3 `.tbm` file, the
[TBM 3.0 renderer](tbm.md#binary-30) now assembles referenced TST
tiles with per-cell signed RGB shades and transparency into an RGBA
frame; its animation size may be 96 × 96 for `house_3x3`.
Other supported frame media remain browser image files. The playback
controls show only through the **last populated image/sound slot**;
blank slots remain preserved in the stored `frames` array.

**Direct real-ZIP verification:** `BSTW/Misc/bruce_south.anm`
is binary 2.3, 380 bytes, 32 × 32, maximum frame index 50,
pause 0.15 seconds, with two populated images:
`FLcharacters.tst14` and `FLcharacters.tst15`.
Both resolve within the 45-tile
`BSTW/Tiles/FLcharacters.tst` and produce different visible RGBA
pixels. Other directions are West 10/11, East 12/13, North
16/17. The file's other 49 slots are preserved as blanks;
they are not 49 additional visible frames.

The [synthetic native fixture](fixtures/native-character-28-fixtures.mjs)
and [regression](../../scripts/check-bstw-tem-anm.mjs) cover partial
frame populations, independent source tile indices, pause values,
corrupt headers/counts, connected JSON reference edges and revision
spec links. All 37 binary 2.3 ANM files in this BSTW archive have
been identified by their headers. Editor playback, later GAM settings
and plugin execution are not part of this read-only inspection.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
