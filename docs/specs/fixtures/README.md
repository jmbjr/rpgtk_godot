# Format conformance fixtures

[format-fixtures.mjs](format-fixtures.mjs) exports synthetic input bytes and
expected status and decoded data for each supported non-tile decoder. It
also supplies multiple variants where the layout differs. It uses only
Node APIs, so another implementation can write the `bytes` to disk or
read them directly. Some standard media examples are metadata test inputs.

After `npm ci`, run `node scripts/check-format-specs.mjs`. It checks
the shared schema, expected decoded fields, and reference states in an
assembled synthetic archive. You can pass a local game ZIP and optional
GAM as arguments to check those records against the same schema.
The original demo and DustBall packages are supplied separately.

## Tile fixtures

These synthetic fixtures contain no original demo artwork. Each source
file has a neighboring `*.expected.json` containing its complete successful
decoded record in an otherwise empty archive.

| Input | Case |
| --- | --- |
| [standalone-16.gph](standalone-16.gph) | Detail 2, raw pixels, four asymmetric RGBA sample positions |
| [standalone-32-rle.gph](standalone-32-rle.gph) | Detail 1, compressed runs spanning columns, including a transparent run |
| [two-tiles.tst](two-tiles.tst) | Version 20, detail 1, two distinct tiles, transparent and opaque black pixels |
| [two-tiles-16.tst](two-tiles-16.tst) | Version 20, detail 2, two 16 × 16 tiles with asymmetric and corner pixels |

Run from the repository root with Node.js 22 or newer.

```sh
npm ci
node scripts/check-tile-specs.mjs
```

The command compares the viewer's records with the expected JSON, validates
both against the schema, and checks the coordinate examples below.
It also exercises the other two supported GPH detail/compression
combinations and rejection of malformed inputs.

| Input | Tile number | (x, y) | Expected RGBA |
| --- | --- | --- | --- |
| standalone-16.gph | — | (0, 0) | (0, 0, 0, 0) |
| standalone-16.gph | — | (0, 1) | (255, 0, 0, 255) |
| standalone-16.gph | — | (1, 0) | (0, 255, 0, 255) |
| standalone-16.gph | — | (1, 1) | (0, 0, 255, 255) |
| standalone-32-rle.gph | — | (1, 0) | (255, 0, 0, 255) |
| standalone-32-rle.gph | — | (1, 1) | (0, 255, 0, 255) |
| two-tiles.tst | 1 | (0, 0) | (0, 1, 2, 0) |
| two-tiles.tst | 1 | (0, 1) | (255, 0, 0, 255) |
| two-tiles.tst | 1 | (1, 0) | (0, 255, 0, 255) |
| two-tiles.tst | 2 | (0, 0) | (0, 0, 0, 255) |
| two-tiles.tst | 2 | (0, 1) | (0, 0, 255, 255) |

GPH coordinates in this table are native. The 16 × 16 viewer preview uses
2 × 2 display pixels per native pixel. TST transparency retains the
stored sentinel's RGB bytes when converted to RGBA.

## Indexed palette fixtures

`palette-3.tst` through `palette-6.tst` contain two entries each, including
transparent 255, opaque black, distinct X/Y colors and an end-of-tile marker.
`palette-N-0.gph` and `palette-N-1.gph` cover raw/RLE for each detail 3–6.
Each has a matching `.expected.json` record. These are controlled fixtures,
not files recovered from a released game. See [palette rules](../palette.md).

The PR's DODGE review artifact also contains `palette-fixtures.zip`: open
it in the website to browse all 12 palette fixtures. `palette-3/` through
`palette-6/` each contain a generated PDF, TTS save and matching assets.

## Older text characters

`format-fixtures.mjs` defines `Chrs/text-0-0.tem`, `Chrs/text-1-0.tem`
and `Chrs/text-1-1.tem` with independent expected records. They cover the
absent size field in text 2.0 and both text 2.1 graphics branches. These
are controlled fixtures, not recovered game files. The DODGE review
artifact includes `older-tem-fixtures.zip` for opening in the viewer.
