# Evidence gates remaining after the three-PR historical coverage series

This audit is scoped to the 57 **currently documented** rows in
[test-matrix.md](test-matrix.md), not every possible Toolkit 2 file. The
[versioned audit ledger](legacy-coverage-audit.json) pairs each row with
an actual file, wrapper or an evidence blocker. The CI checker validates
file presence and parser status against the generated ZIPs. This does
**not** establish editor opening, save/reopen, or actual runtime behavior.

## 1. BRD binary 2.3 isometric coordinates — evidence blocked

**What we can support:** The historical binary board 2.3 writer calls
`BinWriteByte(num, theBoard.isIsometric)` after the counted thread tail:
[pinned writer at commit 0012b9f](https://github.com/chrisbmatthews/rpgtoolkit/blob/0012b9f9b2093525b4edb42893c5a669cdbb491a/vb/tkCommon/modules/CommonBoard.bas#L724-L734).
The later compatibility reader reads the byte as `.coordType` and uses
`modBoard.tileToBoardPixel(..., .coordType, ...)` for item placement:
[pinned 3.1 reader at commit 9191b91](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L1008-L1053).
The existing synthetic `Boards/threaded-room.brd` fixture stores
`coordinateType: 1` and the production parser preserves that byte.
The [BRD spec](brd.md) documents the common grid and 2.3 tail shape.

**What we cannot yet claim:** Verified Toolkit 2-authored isometric tile
placement, original screen-to-tile transformation, art ordering, or
reproducible isometric preview. A synthetic byte value 1 alone is **not
an authenticated isometric specimen**.

**Unblock conditions:** Obtain a redistributable board **saved by an
identified Toolkit 2 release**, with (1) a documented isometric setting,
(2) asymmetric tile placements and coordinates, (3) its referenced
tileset/images, and (4) a screenshot or known expected tile positions.
Preserve source bytes, revision, provenance and hash, then compare the
parsed coordinates and geometry against actual editor/render output.
Only then move this matrix row from `evidence-blocked` to a checked
sample; desktop acceptance is still a separate later action.

## 2. DustBall `Boards/temp.___` — evidence blocked

**What we can support:** The original Toolkit Demo scratch record
has five unsigned-or-signed decimal header lines followed by groups of
four records (`tileName`, then three integer lines). The source-backed
[Demo fixture](fixtures/format-fixtures.mjs) and
[temporary-board spec](temporary-board.md) demonstrate that one **partial,
unversioned, Demo-specific layout**. It has no verified version number
and no established producing editor action. The
[compatibility audit](compatibility-matrix.md#packaging-media-and-project-extras)
records a distinct DustBall `Boards/temp.___` observation that
**fails the Demo-shape validator**.

**What we cannot yet claim:** The DustBall scratch record schema,
producer/lifecycle, or relationship to regular `.brd` format. No
redistributable, attributable DustBall scratch bytes are checked into
this repository's conformance fixture inventory, so we cannot write
a justified alternate parser or bundle a passing example.

**Unblock conditions:** Acquire permission to include the original
DustBall scratch file (or a source-backed reproducible equivalent).
Record the original game/archive provenance, exact bytes/hash, and the
Toolkit release if determinable. Compare line counts and field types
against the Demo profile, isolate the distinct record shape, and add
a *separately named* parser/fixture only after the data supports it.
Do not coerce invalid values into the Demo parser or silently treat
`.___` data as a regular BRD.

## Scope beyond the known 57 rows

The [test matrix's open inventory](test-matrix.md#open-inventory-gaps)
also tracks older GAM/BRD/GPH fallbacks, Toolkit-3-associated TBM/ISO/TST
30 candidates, and unclassified auxiliary saves. These are **not
silently counted as completed** by the 57-row ledger, because their
Toolkit 2 provenance and/or writer revisions have not been established.

The separate **latest-version Toolkit 2 test game**, and all editor
open/save/reopen and runtime acceptance, remain pending workstreams.
