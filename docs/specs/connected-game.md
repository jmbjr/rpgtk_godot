# Connected game JSON

Version 1 · [JSON Schema](connected-game.schema.json)

Open a game ZIP in the viewer and select **Download connected game JSON**.
You can add a matching Main File before exporting. The viewer generates one
JSON document locally and uses the same records as the artifact inspector.

| Field | Meaning |
| --- | --- |
| `archive` | Input archive name and file count, excluding directories and an uploaded Main File. |
| `root` | The uploaded Main File if present, otherwise the sole decoded GAM in the archive. Reports `missing` or `ambiguous` if no root can be chosen. Ambiguous roots list decoded candidates. |
| `artifacts` | All archive files, including disconnected files, plus the uploaded Main File when present. Entries use the [artifact record contract](README.md). |
| `actors` | Decoded character and enemy definitions, and the viewer's conceptual RPGCode author and interpreter roles. |
| `commands`, `capabilities` | Observed built-ins and their capability definitions from the command catalog. Local and unknown symbols remain in the source program record. |
| `edges` | Directed, typed relationships with source evidence. Native GAM 2.9 additional fields use `project-asset` for runtime/combat/media references and `plugin-declaration` for plugin slots/menu/fight plugin filenames. Declaration edges never imply DLL execution. |
| `scriptTrace` | Static, cycle-safe, per-entrypoint `#Include`/`#Run` dependency inspection. Stores configured GAM/board/item script roots, source lines, resolved walks, missing and dynamic gaps, and explicit limits. It is not runtime reachability. |
| Saved state (SAV) | SAV 3.4 records are ordinary artifacts whose `data` includes raw typed globals, party, inventory, equipment, world items, object mappings and a `completion` marker. Outgoing links are source filenames, not executable restoration dependencies. Active-thread stacks remain explicitly unparsed. |
| `coverage` | Counts by artifact decode status and edge resolution status, and limits of the export. Decode counts include any uploaded Main File. |

Resolve a `$ref` by looking up its base ID in the four record dictionaries.
If the reference includes a fragment, apply its JSON Pointer to that record.
For example, `rpgtk:/Tiles/two-tiles.tst#/data/tiles/1` points to the second
tile. The same edge carries `tileIndex: 2` to preserve the one-based Toolkit
address. Artifact IDs are stable for the same archive paths. The archive
defines their scope. Actor, command, and capability IDs use their own
`rpgtk-actor:/`, `rpgtk-command:/`, and `rpgtk-capability:/` namespaces.

The Main File edges describe the configured startup program, opening board,
and initial character. A board's edges distinguish placed tiles and program
slots. Program-slot coordinates are retained as stored in the
`position` field and evidence label. An `invokes` edge identifies an observed built-in occurrence on a
one-based source line. A command's `implements-capability` edge points to
its catalog capability. These relationships describe static evidence.

File edges preserve the indexed value and evidence label. Dynamic
first-argument expressions in supported file commands remain `dynamic`.
Literal host paths and literal save/load/shell resources can be
`external`. Both remain targetless because their resource lies outside
static archive resolution. Missing, ambiguous, unset, and invalid tile
targets also keep their evidence and omit a target. A separately uploaded
GAM is an in-document record with an external origin and can have resolved
edges to archive files.

Cycles are represented by references. Partial decodes and unidentified
files remain visible. Media records carry indexed metadata, and the ZIP
remains the source for original file bytes.

Run `node scripts/check-game-graph.mjs` to validate the fixture export.
For archive checks, append paths to a game ZIP and optionally its matching
GAM.
