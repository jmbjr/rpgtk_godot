# ENE · enemy

Specification revision **1.1** · [conventions](README.md). Text 2.0,
signature `RPGTLKIT ENEMY`.

| Order | Fields after header |
| --- | --- |
| 1 | Name, four stats (HP, special power, fight, defense), can-flee flag, sneak chance, sneak-up value, graphic width and height. |
| 2 | 133 tile names in a fixed 19-column × 7-row grid. For zero-based coordinates use `x * 7 + y`. The preview takes the rectangle declared by width and height. |
| 3 | 101 alternating special-move name and weakness name pairs. |
| 4 | AI value, uses-script flag, script name, XP, gold, victory program, escape program. |
| 5 | Four sound slots in attack, defense, special move, defeat order. Either end here or include four animation slots in the same order. Reject other tail lengths. |

The record keeps `name`, `stats`, `canFlee`, `sneakChance`, `sneakUp`,
dimensions, `tileStride: 7`, `tiles`, `specialMoves`, `weaknesses`,
`ai`, `usesScript`, `script`, `xp`, `gold`, `programs`, `sounds`,
and `animations`. The viewer preserves raw AI and sneak values.
Missing graphics stay visible as missing references.

Evidence includes the original demo enemies and the pinned
[compatibility module](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonEnemy.bas).

## Text 2.0

Line-oriented `RPGTLKIT ENEMY`, major 2, minor 0. Both documented observed tail lengths use this header revision; the revision alone does not distinguish them. Use the tile-grid and optional-animation-tail rules above.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
