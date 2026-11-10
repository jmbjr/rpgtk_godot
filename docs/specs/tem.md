# TEM · character

Specification revision **1.0** · [conventions](README.md). Partial binary
2.3 and 2.4 profiles.

## Read sequence

| Order | Fields |
| --- | --- |
| 1 | Binary header `RPGTLKIT CHAR`, major 2, minor 3 or 4. Name zstr and nine skipped zstr. |
| 2 | Eight i32 stats in order. XP, HP, Max HP, Defense, Fight, Special power, Max special power, Level. Then portrait zstr. |
| 3 | 201 special-move slots. Each has a zstr reference, eight skipped bytes, and two skipped zstr. |
| 4 | Skip one zstr, one byte, eleven zstr, and seven armor-type bytes. The level-type field is one byte in 2.3 and i32 in 2.4. Skip it and the next 14 progression bytes. Read four sound zstr in attack, defense, special move, defeat order, then level-up program zstr. Skip two bytes. |
| 5 | Read 16 walking frames, four each in South, East, North, West order. Each is a top and bottom zstr. |

## Decoded record

`name`, `stats`, `profile`, and `walking` preserve the inspected fields.
Walking entries contain `direction`, one-based `frame` within the
direction, and two `parts` with `value` and `evidence`. Nonempty asset
slots are indexed separately as references. The parser stops after the
walking frames. Older text variants and the skipped fields are outside
this slice.

Evidence includes the demo's `frap.tem` and `tano.tem` for 2.3,
`cluetest/Chrs/start.tem` for 2.4, and the pinned
[compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686).
