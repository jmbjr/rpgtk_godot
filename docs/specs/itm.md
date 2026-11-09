# ITM · item

Specification revision **1.0** · [conventions](README.md).

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
References index nonempty program and graphic slots. Text variants are
outside the supported layout.

Evidence includes demo `kid1.itm` and `herb.itm`, Toolkit 2 Help's item
editor section, and the pinned [compatibility module](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonItem.bas).
