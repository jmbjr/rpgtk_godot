# Visual diagnostic standard · `diagnostic-v1`

**Purpose:** Make synthetic RPG Toolkit 2 test assets visually obvious and repeatable across legacy formats, without confusing test drawings with historical editor-saved artwork. This standard applies first to the seven TEM variants in `TK2LegacyLab`.

## Expected appearance

Every GPH in the diagnostic kit and every embedded TEM drawing has:

- **32 × 32 native pixels** per source tile, with a **transparent outer margin** at (0,0). The preview can therefore show a checkerboard or empty border.
- A **dark, opaque rectangular field**, a bright accent border and four **orientation registration squares**: upper-left white, upper-right dark, lower-left dark, lower-right white.
- A substantial center mark — no deliberately empty walking or action frames.
- Consistent accent colors: **South green**, **East orange**, **North blue**, **West violet**; **Attack coral**, **Defense blue**, **Special move purple**, **Defeat gray**, **Rest teal**, **Custom yellow**.

Walking poses use a face, eyes and uniform. Referenced walking art separates the face/top and uniform/bottom into two vertically stacked GPH files, whereas embedded walking art stores the full character in one 32 × 32 frame. This **difference in proportions is expected** from the historical layout.

Actions use large bright emblems and a small white frame counter; the four action categories use different accent colors. The ten Custom slots have distinct dot counts. Referenced walking frames 1–4 intentionally reuse their direction's top/bottom artwork; the goal is to test the file references, not run animation. Source geometry still varies by format: text 2.1 referenced battle/rest = 32 × 64; text 2.2 and binary 2.3/2.4 referenced battle/rest = 64 × 64; embedded art = 32 × 32.

## Acceptance checklist

| Inspect | Expected | Fail condition |
| --- | --- | --- |
| A diagnostic GPH (any `diag-*.gph`) | Visible dark field, colored border, white upper-left/lower-right registration squares; outer corner transparent | Completely blank, missing color or flipped registration squares |
| TEM embedded walking | All 16 direction/frame slots show a complete 32 × 32 character, with direction colors | Empty walking slot or scrambled pixels |
| TEM referenced walking | All 16 slots have visible top and bottom parts, with direction color | One missing half or broken GPH link |
| TEM battle artwork | Four visible Attack, Defense, Special move and Defeat frames each; correct dimensions for revision | Blank action frame, wrong part order or missing link |
| TEM Rest and Custom | One Rest and ten distinct Custom frames are visibly populated | Empty frame or missing referenced tile |
| Transparency | Transparent outside each mark; dark interior opaque | Entire image transparent or all-transparent preview |
| Desktop editor | Separately open each TEM, save a copy, reopen, record version/conversion and differences | Any visual discrepancy is recorded, **not** silently deemed compatible |

There are **seven synthetic diagnostic TEMs**, backed by **35 generated GPH tiles**. The generator and CI verify inventory, byte determinism, transparent/opaque pixel signatures, four distinct action colors, all 27 artwork frames per character, and **zero missing art references** in the diagnostic set.

## Evidence and limitations

The seven original conformance fixtures in [`format-fixtures.mjs`](fixtures/format-fixtures.mjs) have **not** been modified. Their sparse/blank pixel fields and intentionally missing graphic references remain part of the format-decoder regression evidence. By contrast, the legacy game's `tem-*.tem` files now use **generated diagnostic editions** in [`visual-character-fixtures.mjs`](fixtures/visual-character-fixtures.mjs) so the user can distinguish a real rendering failure from a placeholder. The diagnostic editions have the **same documented file revisions and layout branches**, but are **not byte-for-byte copies** of the original fixtures or independently authenticated Toolkit 2 writer output.

**Do not mark editor open/save or runtime acceptance as passed** based on viewer decoding, correctly colored diagnostics, or the default project room running. Keep the distinction between *file included*, *reference resolved*, *viewer rendered*, *editor opened*, *editor saved/reopened*, and *runtime executed*. If a real editor saves different bytes, preserve that as separate evidence rather than rewriting these synthetic fixtures.
