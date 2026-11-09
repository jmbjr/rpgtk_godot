# RPG Toolkit 2.x data specifications

Specification revision **1.0**. These pages describe verified file layouts
and the viewer's separate version 1 decoded JSON records. File format
versions, this spec revision, and the JSON schema version are independent.

| Type | Spec | Covered file layout | Evidence |
| --- | --- | --- | --- |
| GPH | [Standalone tile](gph.md) | Text 2.0, detail 1 or 2, raw or run-length encoded | Demo fixture for detail 1 RLE. Compatibility source and synthetic examples for the other listed combinations. |
| TST | [Tileset](tst.md) | Binary version 20, detail 1 | All four demo tilesets, compatibility source and synthetic example. |

The [decoded tile-record schema](tile-record.schema.json) covers successful
GPH and TST records. The [fixture index](fixtures/README.md) provides original
bytes, expected decoded output, and a validation command. Each format page
identifies unsupported variants and the boundaries of the evidence.

## Decoded record conventions

A successful record has `schemaVersion: 1`, an archive-relative `path`,
`format`, `decode.status: "decoded"`, type-specific `data`, and
`references.incoming` and `references.outgoing` arrays. The original file
size in bytes is `data.byteLength`. The stable `$id` is `rpgtk:/` followed
by the archive path with each segment encoded using JavaScript
`encodeURIComponent` conventions. Slashes delimit segments and path case
is retained. See [tile addressing](tst.md#tile-addressing) for tile subrecords.

A reference keeps its original `value`, `evidence`, and resolution
`status`. `resolved` edges carry a `target`. `missing` means no candidate,
`ambiguous` means multiple candidates, `tileset-unavailable` means the
candidate has no decoded tile count, and `tile-index-out-of-range` means
the index fails the decoded bounds check. An edge can also include
`source`, a one-based source `line`, or board `placements`.
The references are indexed from the containing archive. The tile payloads
themselves have no outgoing asset references.

Malformed or unsupported bytes can still appear in the inspector. Their
records carry `decode.status: "error"` and a diagnostic message. The
success schema describes complete decoded tile payloads.
