# ANM · effect animation

Specification revision **1.1** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT ANIM`.

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

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
