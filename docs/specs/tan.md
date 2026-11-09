# TAN · animated tile

Specification revision **1.0** · [conventions](README.md).

Read the binary header `RPGTLKIT TILEANIM`, major 2, minor 0, then an
i32 stored speed and an i32 frame count. Read that many zstr tile
references in frame order. Count must be nonnegative and fit the
remaining file. Filenames can include [one-based TST tile numbers](tst.md#tile-addressing).

The record stores `data.speed` and ordered outgoing references labeled
`Frame 1`, `Frame 2`, and so on. The inspector's timing is a viewer
approximation based on the stored speed. Engine timing is outside this
profile.

Evidence includes `water2.tan` in the demo and the pinned
[Toolkit compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileAnim.bas#L88-L113).
