# ITM · item

Specification revision **1.1** · [conventions](README.md).

## Binary 2.2 and 2.3

Read binary header `RPGTLKIT ITEM`, major 2, minor 2 or 3. In the table
`n` is i16 in minor 2 and i32 in minor 3.

| Order | Fields |
| --- | --- |
| 1 | Name and description zstr. Four u8 flags in equip, menu, board, battle order. A usable-by u8 and 51 character zstr. |
| 2 | Buy and sell price (`n`), key-item u8, eight armor-slot u8, accessory zstr. Four `n` modifiers in HP, defense, fight, special-power order. |
| 3 | Equip and remove program zstr. Menu HP and special power (`n`), then menu-use program zstr. Battle HP and special power (`n`), then battle-use program and item animation zstr. |
| 4 | On-board and pickup program zstr. Size type u8. Sixteen walking pairs of top/bottom zstr, then the resting top/bottom pair. |

Decoded data includes `version` (minor), `name`, `description`, `modes`,
`usableBy`, `characters`, prices, `keyItem`, `armorSlots`, `accessory`,
`modifiers`, `programs`, `animation`, `menu`, `battle`, `sizeType`,
`walking` and `rest`. Preserve raw usable-by, armor-slot and size codes.
Walking groups are South, East, North, West, four frames per direction.
References index nonempty program and graphic slots.

Evidence includes demo `kid1.itm` and `herb.itm`, Toolkit 2 Help's item
editor section, and the pinned [compatibility module](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonItem.bas).


## Text 2.0 and 2.1

Read `RPGTLKIT ITEM`, major 2, and minor 0 or 1 as separate lines. The
remaining fields are line-delimited. Blank numeric fields read as zero.

1. Read name, four use flags in binary order, seven armor slots, accessory,
   four equip modifiers, and equip and remove scripts.
2. Read menu HP, special power and script, then the same three battle
   fields. Read on-board and pickup scripts. Only text 2.1 stores a
   size code. Text 2.0 uses size 0 and starts the graphics immediately
   after the pickup script.
3. Size 0 stores sixteen walking frames and one resting tile. Each tile is
   either a single `-2` line for an absent frame or 1024 COLORREF values
   in column-major order. A value of `-1` is transparent. Size 1 stores
   sixteen top/bottom filename pairs and a resting pair.
4. Read usable-by, 50 character names, buy and sell prices, key-item
   flag, one-line description and item animation. Unread trailing fields
   remain outside this profile.

The decoded record pads the unused index 0 of `armorSlots` and
`characters` to match the binary record shape. Size 0 stores inline
pixels in `embeddedGraphics.walking` and `embeddedGraphics.rest`. An
absent frame is `null`. The filename arrays remain empty for those
frames. The viewer renders the pixels in place. The [Toolkit 3.0.4 development converter](https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonItem.bas#L534-L656)
instead extracts the pixels into a generated tileset. Evidence includes
75 DustBall text 2.1 items and synthetic fixtures for both graphics
layouts. Text 2.0 uses a synthetic fixture based on the pinned converter.
Later binary revisions remain outside this profile.

## Text 2.0

Line-oriented `RPGTLKIT ITEM`, major 2, minor 0. Graphics are embedded; there is no later size-code token. Use [text item layouts](#text-20-and-21), including absent-tile sentinel behavior.

## Text 2.1

Line-oriented `RPGTLKIT ITEM`, major 2, minor 1. The size code selects embedded pixels or referenced top/bottom tile pairs. Use [text item layouts](#text-20-and-21).

## Binary 2.2

Binary `RPGTLKIT ITEM`, major 2, minor 2. The numeric values selected by the shared binary profile use i16. See [binary layouts](#binary-22-and-23). Graphics use filename slots.

## Binary 2.3

Binary `RPGTLKIT ITEM`, major 2, minor 3. The version-dependent numeric values use i32 instead of i16; other byte flags and string slots keep their documented widths. See [binary layouts](#binary-22-and-23).

## Binary 2.7

**Native Toolkit 3.1 item layout.** Source evidence: the
[pinned 3.1 item reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonItem.bas#L349-L511)
and [native trans3 item graphics order](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/item.cpp#L200-L296).
The read-only owner-supplied BSTW Expo Demo ZIP (SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`)
contains **11 ITM files**, all binary 2.7, verified by an independent
source-guided binary walk to each file's exact EOF.

The initial binary 2.3 header and inventory/stat fields **still apply**
through the single item size-code byte: name and description zstr,
four use flags and usable-by byte, 51 character zstr slots, i32 prices,
key flag, eight armor bytes, accessory zstr, four i32 equipment
modifiers, equip/remove program zstr, menu HP/SMP i32 + program,
battle HP/SMP i32 + program and ANM zstr, on-board/pickup programs,
and an item size-code byte.

**The native 2.7 graphics section replaces the old tile-pair array.**
It contains, in order:

1. **Ten** animation filename zstr: walking South, North, East,
   West, Northwest, Northeast, Southwest, Southeast; the
   historical Rest slot; and one reserved slot. The reserved
   filename is retained as `reservedGraphic`.
2. **Eight** standing/idle zstr in the same direction order.
3. Two little-endian IEEE-754 doubles, **speed then idleTime**.
   These are stored values, not claims about precise runtime loops.
4. Signed i32 **maximum custom-animation index** and
   maximum-plus-one pairs of animation filename zstr + handle zstr.
   An empty custom slot is still an actual stored slot.
5. Signed i16 **maximum vector-base index**; per base, signed i16
   maximum point index and maximum-plus-one little-endian i32 x/y
   pairs. The first two bases are labeled Collision and Activation,
   but the original points remain intact.

The native record exports `directionalAnimations`,
`standingAnimations`, `restAnimation`, `reservedGraphic`,
`customAnimations`, `vectorBases`, `speed` and `idleTime`
alongside the common item fields. **No legacy 16×2 GPH walking
array or resting pair is invented.** Every nonempty ANM filename,
and every nonempty program reference in the common fields, enters
the ordinary reference graph. The inspector shows item roles and
modifiers, clickable directional ANMs, a first-frame TST thumbnail
where the referenced image is a supported indexed tile, and raw
collision/activation vector coordinates. Empty graphic slots are
reported as unassigned, not missing.

### BSTW item evidence

| Item examples | Verified source properties |
| --- | --- |
| `jim.itm`, `lami.itm`, `loyalis.itm`, `rusty.itm` | Board objects with four cardinal animations; pickup programs `mwinJim.prg`, `mwinLami.prg`, `mwinStartBoardLoad.prg`, `mwinRusty.prg`, respectively |
| `house_3x3.itm` | South ANM `house_3x3.anm` has two TBM frames, `house_3x3_closed.tbm` and `house_3x3_open.tbm`, linked to the now-supported [native TBM 3.0 renderer](tbm.md); first-frame house artwork is composited from TST tiles |
| `door.itm`, `testvision.itm` | Standalone board graphics and directional ANM links |
| `hat.itm` | Equipment modifiers HP +1, defense +2, fight +3, special power +4 |
| `pot_health.itm`, `toast.itm`, `bugs.itm` | Menu-use items, including HP +10 for Health Potion and SMP +10 for Toast; artwork may be empty |

All 11 BSTW items contain two four-point vector bases in the
observed files. `jim_south.anm` resolves to
`BSTW/Tiles/FLcharacters.tst` tiles **5** and **6** via
the native ANM 2.3 reader. That tileset already has a functional
TST pixel renderer. The raw game ZIP and any DLL/EXE files
remain out of the repository.

[Small synthetic ITM 2.7 fixture](fixtures/native-item-27-fixtures.mjs)
and [conformance test](../../scripts/check-bstw-itm-27.mjs)
verify deliberately different numeric values, all graphic slot
orders, TST 14/15 pixel links, missing/empty artwork, custom
slots, vector points, invalid maxima/truncation and connected JSON
references. Passing the optional read-only test against a local
BSTW ZIP proves decoder acceptance for this identified sample;
it does **not** establish editor save/reopen compatibility,
runtime collision/activation behavior or editor/runtime-perfect TBM rendering.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
