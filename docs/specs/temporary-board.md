# Observed temporary board text · `___`

Specification revision **1.0** · [conventions](README.md). Fixture-specific
partial reader.

The original demo's `Boards/temp.___` has no signature. The viewer
recognizes five signed decimal safe integers on separate lines,
followed by one or more four-line records. Each record is a blank
or numbered TST filename (extension followed by decimal digits),
then three signed decimal safe integers. It rejects incomplete records
and invalid tokens. Matching uses trimmed lines and the PRG text decoder.

Decoded data contains `layout`, the five-element `header`, and
`records` containing `tileName` and `values`. Tile references use
one-based source lines and follow [tile addressing](tst.md#tile-addressing).
The producer and meanings of the numeric fields are unverified.
DustBall's similarly named file does not match this profile.
