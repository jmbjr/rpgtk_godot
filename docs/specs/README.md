# RPG Toolkit 2.x data specifications

Specification revision **1.1**. These pages describe verified file layouts
and the viewer's separate version 1 decoded JSON records. File format
versions, this spec revision, and the JSON schema version are independent.

The [compatibility matrix](compatibility-matrix.md) compares these profiles
with the pinned Toolkit 3 readers and tracks evidence and remaining gaps.

| Type | Spec | Covered file layout | Evidence |
| --- | --- | --- | --- |
| GPH | [Standalone tile](gph.md) | Text 2.0, details 1–6, raw or run-length encoded | Demo detail 1 RLE; pinned palette table and raw/RLE fixtures for all details. |
| TST | [Tileset](tst.md) | Binary version 20, details 1–6 | Demo detail 1; native-size RGB/palette fixtures and pinned compatibility source. |
| GAM | [Main File](gam.md) | Binary 2.2 and text 2.0 startup fields | Demo.gam and DustBall main.gam |
| PRG | [RPGCode program](prg.md) | Source and static indexing | Demo startup trace and Toolkit 2 Help |
| TAN | [Animated tile](tan.md) | Binary 2.0 | Demo animation files |
| TEM | [Character](tem.md) | Text 2.0/2.1/2.2 and binary 2.3/2.4, walking/battle/rest/custom art | DustBall, Demo and Cluetest characters, compatibility reader and synthetic fixtures |
| BRD | [Board](brd.md) | Text 2.0 and 2.1 and binary 2.2 and 2.3 placements, links, raw conditions and tile types | Demo boards, Cluetest text board, compatibility readers and synthetic fixtures |
| ITM | [Item](itm.md) | Text 2.0/2.1 and binary 2.2/2.3 | DustBall and Demo items, compatibility reader and synthetic fixtures |
| ENE | [Enemy](ene.md) | Text 2.0, two observed tails | Demo enemies |
| BKG | [Battle background](bkg.md) | Text 2.0 | Demo backgrounds |
| SPC | [Special move](spc.md) | Text 2.0 | Demo move and Toolkit 2 editor |
| ANM | [Effect animation](anm.md) | Text 2.0 | Demo explosion |
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
