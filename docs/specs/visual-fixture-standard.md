# Visual diagnostic standard · `diagnostic-v1`

**Purpose:** Make synthetic RPG Toolkit 2 test assets visually obvious and repeatable across legacy formats, without confusing test drawings with historical editor-saved artwork. This standard applies first to the seven TEM variants in `TK2LegacyLab`.

## Expected appearance

Every GPH in the diagnostic kit and every embedded TEM drawing has:

- **32 × 32 native pixels** per source tile, with a **transparent outer margin** at (0,0). The preview can therefore show a checkerboard or empty border.
- A **dark, opaque rectangular field**, a bright accent border and four **orientation registration squares**: upper-left white, upper-right dark, lower-left dark, lower-right white.
- A substantial center mark — no deliberately empty walking or action frames.
- Consistent accent colors: **South green**, **East orange**, **North blue**, **West violet**; **Attack coral**, **Defense blue**, **Special move purple**, **Defeat gray**, **Rest teal**, **Custom yellow**.

Walking poses use a directional head and uniform. All four facings must look different **even in grayscale**—accent colors alone are not sufficient:

| Direction | Head diagnostic rule |
| --- | --- |
| South · green | Front-facing: **two visible eyes** and centered mouth |
| East · orange | Profile looking **right**: eye on the right and a small nose protruding right |
| North · blue | **Back of head**: hair and highlights, no visible face or eyes |
| West · violet | Profile looking **left**: eye on the left and a small nose protruding left |

The face's eye and nose pixel signatures are checked in CI both for the four standalone referenced walking-top GPH files and for **all sixteen embedded walking frames**. The top/bottom sprite split and existing frame markers are otherwise unchanged; this revision does **not** claim new walking animation or changed frame poses.

Referenced walking art separates the head/top and uniform/bottom into two vertically stacked GPH files, whereas embedded walking art stores the full character in one 32 × 32 frame. This **difference in proportions is expected** from the historical layout.

Actions use large bright emblems and a small white frame counter; the four action categories use different accent colors. The ten Custom slots have distinct dot counts. Referenced walking frames 1–4 intentionally reuse their direction's top/bottom artwork; the goal is to test the file references, not run animation. Source geometry still varies by format: text 2.1 referenced battle/rest = 32 × 64; text 2.2 and binary 2.3/2.4 referenced battle/rest = 64 × 64; embedded art = 32 × 32.

## Item diagnostics (same visual contract)

The five [legacy ITM test editions](../../experiments/tk2-legacy-game/manifest.json)
use the same diagnostic-v1 transparent outer pixel, dark opaque background,
asymmetric white corner marks and four direction colors as the TEMs.
Unlike character faces, each item is a **pink diamond-shaped relic** with
a bright glint; it should never be mistaken for a humanoid sprite.

Each of the 16 walking frames must show an opaque relic, with a shifting
diamond center and an increasingly long white frame marker for frames 1–4.
The same direction has four visually **different** frames. The Rest tile
has a teal border. Text 2.0/2.1 embedded variants store one 32×32 frame
per walking slot and Rest. Text 2.1 referenced and binary 2.2/2.3
variants resolve **two GPH sources per slot**, displayed as a taller
32×64 composition. The 34 generated GPHs consist of 32 direction/frame
top/bottom parts plus two Rest parts.

A completely blank graphic, repeated frame, unresolved GPH, opaque outer
corner or wrong item geometry is **a test failure** for these diagnostic
editions. The older sparse source fixtures and the separate
`Item/token-2.itm` historical board dependency *are not* visual
acceptance specimens and may intentionally contain empty frames.
Desktop editor open/save and gameplay results remain unverified.

## Acceptance checklist

| Inspect | Expected | Fail condition |
| --- | --- | --- |
| A diagnostic GPH (any `diag-*.gph`) | Visible dark field, colored border, white upper-left/lower-right registration squares; outer corner transparent | Completely blank, missing color or flipped registration squares |
| TEM embedded walking | All 16 direction/frame slots show a complete 32 × 32 character, with direction-specific head shape and color | Empty walking slot, identical facings or scrambled pixels |
| TEM referenced walking | All 16 slots have visible top and bottom parts, with direction-specific head shape and color | One missing half, identical facings or broken GPH link |
| TEM battle artwork | Four visible Attack, Defense, Special move and Defeat frames each; correct dimensions for revision | Blank action frame, wrong part order or missing link |
| TEM Rest and Custom | One Rest and ten distinct Custom frames are visibly populated | Empty frame or missing referenced tile |
| Transparency | Transparent outside each mark; dark interior opaque | Entire image transparent or all-transparent preview |
| Desktop editor | Separately open each TEM, save a copy, reopen, record version/conversion and differences | Any visual discrepancy is recorded, **not** silently deemed compatible |

There are **seven synthetic diagnostic TEMs**, backed by **35 generated GPH tiles**. The generator and CI verify inventory, byte determinism, transparent/opaque pixel signatures, four distinct action colors, all 27 artwork frames per character, and **zero missing art references** in the diagnostic set.

## Evidence and limitations

The seven original conformance fixtures in [`format-fixtures.mjs`](fixtures/format-fixtures.mjs) have **not** been modified. Their sparse/blank pixel fields and intentionally missing graphic references remain part of the format-decoder regression evidence. By contrast, the legacy game's `tem-*.tem` files now use **generated diagnostic editions** in [`visual-character-fixtures.mjs`](fixtures/visual-character-fixtures.mjs) so the user can distinguish a real rendering failure from a placeholder. The diagnostic editions have the **same documented file revisions and layout branches**, but are **not byte-for-byte copies** of the original fixtures or independently authenticated Toolkit 2 writer output.

**Do not mark editor open/save or runtime acceptance as passed** based on viewer decoding, correctly colored diagnostics, or the default project room running. Keep the distinction between *file included*, *reference resolved*, *viewer rendered*, *editor opened*, *editor saved/reopened*, and *runtime executed*. If a real editor saves different bytes, preserve that as separate evidence rather than rewriting these synthetic fixtures.
