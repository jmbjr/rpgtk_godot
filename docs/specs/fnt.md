# FNT · bitmap font

Specification revision **1.1** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT FONT`.

Read 256 consecutive glyphs in byte order 0–255. Each glyph contains
eight decimal row bytes, one line each, from top to bottom. Values
must be 0–255. Within a row the high bit is the leftmost pixel and a
set bit paints foreground. For zero-based column `x`, test
`row & (0x80 >> x)`.

Decoded data contains `width: 8`, `height: 8`, and `glyphs` as 256
eight-byte arrays. The viewer renders ASCII sample text and exposes
all glyphs in byte order. Extended byte-to-character mapping remains
unverified.

Evidence includes the demo's `BASE.FNT`, Toolkit 2 Help's Font Editor,
and the pinned [font reader and renderer](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonFont.BAS#L211-L221).

## Text 2.0

Line-oriented `RPGTLKIT FONT`, major 2, minor 0. Use the 256 glyphs, each eight row bytes, defined above. The viewer does not claim other header revisions solely because a compatibility reader may ignore version fields.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
