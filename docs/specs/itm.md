# ITM · item

Specification revision **1.0** · [conventions](README.md).

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
