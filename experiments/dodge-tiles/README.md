# Toolkit tiles in DODGE

This fixture-based pilot for [issue #31](https://github.com/jmbjr/rpgtk_godot/issues/31) tests whether the existing Toolkit JSON records can feed a DODGE definition catalog. The fixture covers a two-entry tileset, a standalone tile, and a board cell that references the second tileset entry.

| Toolkit data | DODGE projection |
| --- | --- |
| Standalone GPH or one TST entry | A token with component form `tile` inherited from its archetype |
| TST file | A collection with `ordering: "declared"` and one member per entry in file order |
| Tile number and pixel data | Toolkit sidecar with an explicit tile-to-object binding and the original decoded records |
| BRD tile placement | A sidecar row per nonempty board run, with the original lookup value, placement length, shade, and resolution status |

The deck analogy describes the ordered membership. The tileset is an artwork catalog, so the collection has no shuffle, draw, or return behavior and is never instantiated in a scene. The same tile can occur in many board cells without adding catalog members.

Within one archive, a tile ID derives from its artifact ID and, for TST entries, its one-based source number. That number is separate from the zero-based JSON Pointer in the binding. Consumers resolve placements via the binding or the projected object ID. Changing a collection's displayed order leaves the source address intact. Renaming a file or renumbering the original TST entries changes the corresponding source identity. Archive-scoped identity across games remains future work.

The pilot uses the [DODGE 0.2.1 draft](https://github.com/jmbjr/DODGE/blob/9af5804719bc4dc421d1cd76d3587f5b678d3f81/draft/v0.2.1/DODGE_SPEC.md). Its front faces use text labels. Raster data and pixel dimensions stay in the sidecar as decoded Toolkit data, and the check does not render tile artwork or run the full DODGE semantic validator.

## Run the check

With this repo's Node dependencies installed and a local checkout of DODGE at commit `9af5804719bc4dc421d1cd76d3587f5b678d3f81`, run from the root of this repo:

```sh
node experiments/dodge-tiles/check.mjs \
  /path/to/DODGE/draft/v0.2.1/schemas/dodge.schema.v0.2.1.json \
  /tmp/toolkit-dodge-tiles
```

The optional last argument writes `dodge.json`, `toolkit-sidecar.json`, and the separate `tile-card-scene.json`. The check validates the pinned schema and verifies source order, stable IDs across input record order, and the board-to-tile mapping. A separate in-memory board variant checks repeated placements, out-of-range indexes, and missing tiles.

## Build the tabletop review

The tabletop projection adds a separate DODGE review scene and keeps the tile IDs from the catalog. In that scene, the two TST members are reference cards. The scene instantiates the display once, and the board placement continues to refer to the second tile. There is no card generated for the standalone GPH or board in this slice.

After running the check above, build both targets with Python 3.12:

```sh
python -m pip install -r experiments/dodge-tiles/targets/requirements.txt
python experiments/dodge-tiles/targets/build.py \
  /path/to/DODGE/draft/v0.2.1/schemas /tmp/toolkit-dodge-tiles /tmp/toolkit-tabletop \
  --source-sha "$(git rev-parse HEAD)"
```

The build validates the pinned DODGE document, export contract and target manifest schemas and resolves the fixture's supported subset. It compares both manifests, reopens the PDF to check trim size and card order, and checks the TTS save's IDs, positions and asset bytes. The PR workflow uploads the PDF, TTS save, images, manifests and [review instructions](targets/REVIEW.md) together. Opening the save in TTS is the manual acceptance step.
