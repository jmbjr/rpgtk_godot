# TEM · character

Specification revision **1.0** · [conventions](README.md). Partial text 2.0/2.1/2.2 and
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
slots are indexed separately as references. The binary parser continues through battle, rest and custom frames (see below).

Evidence includes the demo's `frap.tem` and `tano.tem` for 2.3,
`cluetest/Chrs/start.tem` for 2.4, and the pinned
[compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686).


## Text 2.2

Read `RPGTLKIT CHAR`, major 2 and minor 2 on separate lines. Read the name,
nine variable names, eight stats in binary order and the portrait. Each
of the 201 move slots contains a filename and four condition fields.
Skip the special move name and enable flag, then read the size code.

- Size 0 begins with 16 walking tiles of 1024 column-major COLORREF
  integers each. `-1` is transparent. Read 16 battle tiles' worth of
  interleaved pixels, one battle-rest tile and ten custom tiles.
- Size 1 begins with 16 top/bottom walking filename pairs. Read 64 battle
  filenames, four battle-rest filenames and 20 custom filenames.

Both layouts then have ten accessory names, six armor flags and seven
level-progression fields. Read the four sounds in the binary order and
the level-up script, then skip the level-up type.

The record stores the sixteen size 0 walking tiles in `embeddedWalking`
in the same frame order as `walking`. Its walking filename slots are
empty. The viewer renders the embedded pixels directly. Size 1 uses the
existing walking references. Battle, rest and custom artwork is preserved in `artwork` (below).

Evidence includes four DustBall text 2.2 characters, synthetic fixtures
and the [pinned compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L851-L1082).

## Older text 2.0 and 2.1

These revisions share the text 2.2 prefix through the special-move name
and enable flag, and the same accessories/progression/audio/program tail.
The version-dependent graphics block must be consumed before that tail:

| Revision | Size field | Walking | Battle/rest/custom payload after walking |
| --- | --- | --- | --- |
| 2.0 | Absent; implicit size 0 | 16 embedded 32 × 32 tiles | 16 embedded battle tiles, one rest tile, ten custom tiles |
| 2.1, size 0 | Decimal `0` | Same embedded layout | Same embedded layout |
| 2.1, size 1 | Decimal `1` | 16 top/bottom filename pairs | 32 battle filenames, two rest filenames, 20 custom filenames |
| 2.2, size 1 | Decimal `1` | Same referenced walking layout | 64 battle filenames, four rest filenames, 20 custom filenames |

Embedded colors are signed decimal COLORREF integers: `-1` is transparent,
`0..16777215` is opaque. Each tile is column-major. The embedded battle
block is interleaved per pixel (fight, special move, defense, death),
for four frames. The reader deinterleaves that block, then reads rest and custom
art before the shared tail.
For 2.1 referenced battle art, the source loops top/bottom, then four
frames, reading fight/defense/special/death filenames for each frame.
Size codes other than 0 or 1 are unsupported.

All three added layout combinations use the existing partial TEM record,
walking preview and reference contract. Controlled fixtures check all
sixteen embedded frame boundaries, first/last walking references,
portrait, special moves, sounds and level-up script. Truncated graphics,
truncated tails, invalid embedded colors, size codes and unsupported
versions are rejected. No real text 2.0/2.1 character sample has yet been
validated; the evidence is the pinned reader linked above and controlled
fixtures. Character move conditions and progression remain unexported.

## Battle, rest and custom artwork

All supported TEM variants now export `artwork`: 27 frame objects in
Attack (4), Defense (4), Special move (4), Defeat (4), Rest (1), Custom
(10) order. `frame` is one-based within each kind, including ten custom
slots. Each frame has `kind`, `frame`, `width`, `height` and exactly one
of `pixels` or `parts`. Empty slots remain present.

Embedded text art is 32 × 32, with 1,024 column-major COLORREF integers
in `pixels`. Its battle order on disk is frame, x, y, action; the action
order is attack, special move, defense, defeat. Rest is one tile, followed
by ten custom tiles. Values outside `-1..16777215` are invalid.

Referenced text 2.1 battle/rest art is 32 × 64; text 2.2 and binary
2.3/2.4 battle/rest art is 64 × 64. Referenced custom art is always
32 × 64. `parts` preserves every filename, including blanks, with
zero-based tile coordinates `x`, `y`, `value` and unique `evidence`.
Nonempty filenames become graph references. Missing tiles leave a
transparent region and are identified in the inspector.

| Layout | Battle filename traversal | Action order |
| --- | --- | --- |
| Text 2.1 | y, frame | attack, defense, special move, defeat |
| Text 2.2 | x, y, frame | attack, defense, special move, defeat |
| Binary 2.3/2.4 | frame, x, y | attack, defense, special move, defeat |

Rest traverses x then y; custom traverses slot then y. Binary art follows
walking filenames immediately and contains 64 battle, four rest and 20
custom filenames. Earlier prefix-only synthetic binary fixtures have
been extended to cover the full graphics payload. Truncated art is an
error. The existing walking record is unchanged.

The [pinned binary reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L712-L834)
and text reader above establish ordering and coordinates. Controlled
fixtures use distinguishable colors at every action, frame and quadrant
for all seven supported layout combinations. Demo and DustBall supply
additional real-file regression evidence. The inspector shows static
frame galleries with source-tile links; it does not execute battle logic.
