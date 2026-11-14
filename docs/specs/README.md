# RPG Toolkit 2.x data specifications

Specification revision **1.1**. These pages describe verified file layouts
and the viewer's separate version 1 decoded JSON records. File format
versions, this spec revision, and the JSON schema version are independent.

The [compatibility matrix](compatibility-matrix.md) compares these profiles
with the pinned Toolkit 3 readers and tracks evidence and remaining gaps.
The [Toolkit 2 test matrix](test-matrix.md) links the individual fixtures
and tracks test game and desktop editor coverage.

## Sources and reverse engineering

These specifications reconstruct the Toolkit 2 file layouts supported by
the viewer. We read the legacy readers, writers, and converters in the
RPG Toolkit source repository and compared them with available game files,
editor observations, and synthetic fixtures. A compatibility reader can
skip fields or change their meaning during conversion, so the per-format
pages identify which fields the viewer actually preserves.
[Upstream RPG Toolkit repository](https://github.com/chrisbmatthews/rpgtoolkit)

| Pinned upstream revision | How it is used |
| --- | --- |
| [3.1-era snapshot](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead) | Main source for legacy layouts and conversion behavior, including character artwork order, binary boards, and tile dimensions, strides, transparency, and palette lookup. |
| [3.0.4 development snapshot](https://github.com/chrisbmatthews/rpgtoolkit/tree/08f2fe3d21828ea3519875553a2bad2aa10a7adc) | Earlier readers for text boards and items, and reader/writer evidence for status effects. |
| [Binary board writer revision](https://github.com/chrisbmatthews/rpgtoolkit/tree/0012b9f9b2093525b4edb42893c5a669cdbb491a) | Evidence for the binary BRD 2.3 thread slots and coordinate-type byte. |
| [Historical demo revision](https://github.com/chrisbmatthews/rpgtoolkit/tree/4133fc81d4144582e06a63ffc6017eec770d2d86) | Contains the BRD 2.3 sample used to check the common prefix and a blank thread slot. |

The individual specs link to the relevant functions and line ranges.
The DOS color table in the viewer transcribes Toolkit's
`CTile::g_pnDosPalette`. [Palette source and interpretation](palette.md)

We also reverse engineered behavior from original files where source
inspection left gaps:

| Case | Sample evidence and remaining uncertainty |
| --- | --- |
| Temporary board `.___` files | The original Demo establishes the observed numeric prefix and repeated tile records. The producer, field meanings, and version are unverified, and DustBall's file differs. [Temporary board notes](temporary-board.md) |
| DustBall installer packaging | The shipped archive establishes the observed nested ZIP and the executable's `CMP1` footer describing the embedded ZIP. Coverage is limited to that observed wrapper. [Packaging evidence](compatibility-matrix.md#packaging-media-and-project-extras) |
| Enemy text 2.0 tails | Demo files establish two observed tail lengths under the same header revision, including the shorter layout. Editor handling of the short tail still needs confirmation. [Enemy spec](ene.md) |
| Special move text 2.0 use flags | The Demo file and Toolkit 2 editor observation establish the displayed values for that move. The Toolkit 3 reader uses different labels, so further controlled editor saves are needed to settle the general interpretation. [Special move spec](spc.md) |

Some source-derived cases also require an interpretation. For example,
the viewer applies palette lookup to 16 × 16 indexed GPH tiles based on
the Toolkit editor and the other indexed branches. The pinned Toolkit 3
GPH reader omits that lookup for modes 4 and 6. Controlled fixtures verify
the viewer's interpretation, and real samples remain a follow-up.
[Palette evidence and limits](palette.md#evidence-and-limits)

In the [compatibility matrix](compatibility-matrix.md), **Sample** means
a real file was checked, **Source** means the code path was traced, and
**Fixture** means a synthetic case verifies the documented layout. These
labels let readers distinguish observed file behavior from source-based
reconstruction. [Fixture index](fixtures/README.md)

## Format index

| Type | Spec | Covered file layout | Evidence |
| --- | --- | --- | --- |
| GPH | [Standalone tile](gph.md) | Text 2.0, details 1–6, raw or run-length encoded | Demo detail 1 RLE; pinned palette table and raw/RLE fixtures for all details. |
| TST | [Tileset](tst.md) | Binary version 20, details 1–6 | Demo detail 1; native-size RGB/palette fixtures and pinned compatibility source. |
| GAM | [Main File](gam.md) | Toolkit 2 text 2.0 / binary 2.2; Toolkit 3 binary 2.9 startup and complete source-defined settings, including declared plugins and runtime-key scripts | Demo.gam, DustBall, pinned reader, real BSTW ZIP and synthetic 2.9 tail fixtures |
| PRG | [RPGCode program](prg.md) | Source and static indexing | Demo startup trace and Toolkit 2 Help |
| TAN | [Animated tile](tan.md) | Binary 2.0 | Demo animation files |
| TEM | [Character](tem.md) | Toolkit 2 text 2.0/2.1/2.2 and binary 2.3/2.4; Toolkit 3 binary 2.8 portrait, directional ANMs and vector bases | Demo, Cluetest, DustBall, pinned native reader, BSTW and synthetic fixtures |
| BRD | [Board](brd.md) | Text 2.0/2.1 and binary 2.2/2.3 legacy fields; native binary 2.4 tiles, shading, vectors, placed sprites, program/image slots and background/start state | Demo/Cluetest, pinned native reader, all 9 BSTW boards and synthetic full-tail fixtures |
| ITM | [Item](itm.md) | Toolkit 2 text 2.0/2.1 and binary 2.2/2.3; Toolkit 3 binary 2.7 ANM references and vector bases | DustBall, Demo, pinned Toolkit 3 reader, BSTW's 11 items and synthetic fixtures |
| ENE | [Enemy](ene.md) | Text 2.0, two observed tails | Demo enemies |
| BKG | [Battle background](bkg.md) | Text 2.0 | Demo backgrounds |
| SPC | [Special move](spc.md) | Text 2.0 | Demo move and Toolkit 2 editor |
| ANM | [Effect animation](anm.md) | Text 2.0 and native binary 2.3, frame/TST/TBM links, transparency and pause | Demo explosion, pinned native reader, BSTW Bruce and house animations, synthetic fixtures |
| TBM | [Native tile bitmap](tbm.md) | Toolkit 3 binary 3.0 inclusive tile/shade grid; composed TST artwork | Pinned native source, both BSTW house_3x3 TBMs, synthetic shade/transparency fixtures |
| SAV | [Saved game](sav.md) | Toolkit 3 binary 3.4 read-only globals, party, equipment, current-board state and object mappings | Pinned native state reader/writer, BSTW NewFile.sav and synthetic fixtures |
| DLL | [Static plugin/PE ABI audit](plugin-abi.md) | Read-only Windows PE32/PE32+ export names, architecture, source GAM plugin declarations and role reconciliation | Pinned COM/legacy plugin loader, all 7 original BSTW DLL headers and inert synthetic PE fixtures |
| FNT | [Bitmap font](fnt.md) | Text 2.0 | Demo base font |
| STE | [Status effect](ste.md) | Text 2.0 and binary 2.2 | DustBall status effects, editor fixture and compatibility reader |
| GIF | [GIF image](gif.md) | GIF87a/GIF89a metadata | GIF spec and demo images |
| JPG/JPEG | [JPEG image](jpg.md) | SOF metadata | JPEG spec and demo images |
| WAV | [Wave audio](wav.md) | RIFF/WAVE metadata | WAVE spec and demo sounds |
| MID | [Standard MIDI File](mid.md) | Formats 0–2 metadata | SMF spec and demo music |
| DOC | [Compound document](doc.md) | CFB header and directory | Microsoft CFB spec and demo EULA |
| `___` | [Observed temporary board text](temporary-board.md) | Demo-specific records | Original demo only |
| PNG/BMP and unknown | [Other entries](other.md) | Browser image preview or inventory only | Viewer behavior |

The [artifact-record schema](artifact-record.schema.json) covers the
shared envelope and supported data types. The [tile-record schema](tile-record.schema.json)
also describes successful GPH and TST records independently.
The [fixture index](fixtures/README.md) provides synthetic examples and
validation commands. Each format page
identifies unsupported variants and the boundaries of the evidence.

The [connected game export](connected-game.md) assembles these records and the
observed RPGCode relationships in one document.

## Decoded record conventions

A successful record has `schemaVersion: 1`, an archive-relative `path`,
`format`, a `decode.status` of `decoded` or `partial`, type-specific `data`, and
`references.incoming` and `references.outgoing` arrays. The original file
size in bytes is `data.byteLength` when recorded. The separately uploaded
GAM record omits this field and uses `rpgtk-main:/` as its ID prefix. The stable `$id` is `rpgtk:/` followed
by the archive path with each segment encoded using JavaScript
`encodeURIComponent` conventions. Slashes delimit segments and path case
is retained. See [tile addressing](tst.md#tile-addressing) for tile subrecords.

A reference keeps its original `value`, `evidence`, and resolution
`status`. `resolved` edges carry a `target`. `missing` means no candidate,
`ambiguous` means multiple candidates, `tileset-unavailable` means the
candidate has no decoded tile count, and `tile-index-out-of-range` means
the index fails the decoded bounds check. An edge can also include
`source`, a one-based source `line`, or a board `placements` count.
`unset` is possible for a separately supplied GAM binding. A target uses
`$ref` and may include a one-based `tileIndex`. References describe static
evidence. A resolved path identifies an archive entry even if its decoder
reported an error. Tile payloads have no outgoing asset references.

A recognized decoder can report `decode.status: "error"` with a diagnostic
message. Preview-only images use `media`, and unknown extensions use
`unidentified`. The shared schema validates these envelopes and applies
type-specific payload rules to successful decoded or partial records.


## Layout notation

For Toolkit binary formats, `u8` is an unsigned byte, `i16` and `i32`
are signed little-endian integers, and `zstr` is a Windows-1252 string
terminated by byte zero. A binary Toolkit header consists of a signature
`zstr` followed by major and minor `i16` values. Skips are byte counts
unless described as fields.

A Toolkit text 2.0 header consists of the stated signature, `2`, and `0`
on successive lines. Subsequent strings and numbers consume one line
each, including blank string slots. The viewer trims these lines, accepts
CRLF, LF and CR, and tries UTF-8 before Windows-1252. Use decimal values
for numeric fields. Boolean fields are false for zero and true for
nonzero. Unless stated otherwise, parsers reject truncation and unexpected
headers. A read boundary in a partial format leaves later bytes uninterpreted.

## Source revision metadata and inspector links

The Toolkit 3 binary GAM 2.9 startup prefix is separately supported as a
partial reader (issue #80); this does not extend BRD/TEM decoding to Toolkit 3.

Records may include `sourceFormat` alongside the existing envelope: `encoding`
(`text`, `binary`, `source`, `unknown`), nullable string `version`, boolean
`supported`, and optional integer `detail` for tiles. This metadata is detected
from the source header before decoding, including unsupported/truncated inputs.
`supported` means that the header identifies a supported layout, not that the
payload is valid; check `decode.status` separately. Existing records without
this optional metadata remain valid. A supplied GAM receives the same metadata
from its verified major/minor fields.

Each inspector displays the source encoding/revision and links to that revision's
section on the format page. TST/GPH links also select the detail section.
Unknown and unsupported revisions link to explicit coverage limits. PRG has
no stored format revision; temporary-board version fields are unverified.
Standard media formats use their own standards and do not acquire a Toolkit
version from their filenames. TEM additionally labels embedded pixels versus
filename references; no provenance or pixel-match dependency is inferred.

When a decoder adds a revision or detail, update `asset-format.mjs`, the matching
revision section, this index, the compatibility matrix and regression fixtures
in the same PR. `scripts/check-asset-formats.mjs` checks supported-header labels
and that every generated specification link has an existing Markdown heading.
