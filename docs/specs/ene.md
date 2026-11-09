# ENE · enemy

Specification revision **1.0** · [conventions](README.md). Text 2.0,
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
