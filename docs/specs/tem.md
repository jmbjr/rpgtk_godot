# TEM · character

Specification revision **1.0** · [conventions](README.md). Partial text 2.2 and
binary 2.3/2.4 profiles.

## Binary read sequence

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
slots are indexed separately as references. The binary parser stops after the walking frames.

Evidence includes the demo's `frap.tem` and `tano.tem` for 2.3,
`cluetest/Chrs/start.tem` for 2.4, and the pinned
[compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686).


## Text 2.2

Read `RPGTLKIT CHAR`, major 2 and minor 2 on separate lines. Read the name,
nine variable names, eight stats in binary order and the portrait. Each
of the 201 move slots contains a filename and four condition fields.
Skip the special move name and enable flag, then read the size code.

- Size 0 begins with 16 walking tiles of 1024 column-major COLORREF
  integers each. `-1` is transparent. Skip 16 battle tiles' worth of
  interleaved pixels, one battle-rest tile and ten custom tiles.
- Size 1 begins with 16 top/bottom walking filename pairs. Skip 64 battle
  filenames, four battle-rest filenames and 20 custom filenames.

Both layouts then have ten accessory names, six armor flags and seven
level-progression fields. Read the four sounds in the binary order and
the level-up script, then skip the level-up type.

The record stores the sixteen size 0 walking tiles in `embeddedWalking`
in the same frame order as `walking`. Its walking filename slots are
empty. The viewer renders the embedded pixels directly. Size 1 uses the
existing walking references. Battle and custom artwork remain outside
this profile.

Evidence includes four DustBall text 2.2 characters, synthetic fixtures
and the [pinned compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L851-L1082).
