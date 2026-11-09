# BKG · battle background

Specification revision **1.0** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT BKG`.

Read 209 tile strings in a 19 × 11 column-major grid. Then read music,
select, choose, ready and invalid-action sound strings. Skip one string
of unverified purpose. Read 209 triplets of signed numeric RGB shade
offsets in the same cell order. The index for zero-based `(x,y)` is
`x * 11 + y`. Empty tile names are unplaced.

Decoded data contains `width: 19`, `height: 11`, `order: "column-major"`,
`tiles`, the `audio` slot map, and `shading`. The preview adds each
triplet to the corresponding RGB channels with clamping. Tile and
media references retain the original names.

Evidence includes `temple.bkg`, its editor screenshot, Toolkit 2 Help's
background editor section, and the pinned [compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBackground.bas#L157-L204).
