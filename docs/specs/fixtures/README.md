# Tile conformance fixtures

These synthetic fixtures contain no original demo artwork. Each source
file has a neighboring `*.expected.json` containing its complete successful
decoded record in an otherwise empty archive.

| Input | Case |
| --- | --- |
| [standalone-16.gph](standalone-16.gph) | Detail 2, raw pixels, four asymmetric RGBA sample positions |
| [standalone-32-rle.gph](standalone-32-rle.gph) | Detail 1, compressed runs spanning columns, including a transparent run |
| [two-tiles.tst](two-tiles.tst) | Version 20, detail 1, two distinct tiles, transparent and opaque black pixels |

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
