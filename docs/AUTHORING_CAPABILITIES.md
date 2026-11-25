# Toolkit authoring capabilities

This graph starts with A01, the cave terrain tileset from the
[owner-led game intake](https://github.com/jmbjr/rpgtk_godot/issues/142).
It describes what an author must be able to do. Tool selection and web features
are tracked separately from prerequisites.

The [project authoring workflow](AUTHORING_WORKFLOW.md) adds planned W01-W07
capabilities for connecting requirements to work, contributor skills, proposed
asset variants, reviews and build selections. These are planned authoring
tasks, separate from the shipped Explorer inventory. Start there for the next
implementation handoff: request-bound tile authoring with C01.

## A01 tile and tileset dependencies

```mermaid
flowchart TD
    C01["C01 Create and edit a tile"] --> G["At least one usable tile"]
    C13["C13 Import artwork as a tile"] --> G
    C14["C14 Open a TST for editing"] --> G
    C14 --> C01
    G --> C15["C15 Create and edit an indexed tileset"]
    C15 --> C16["C16 Export a compatible TST"]
    C16 --> V["A01 Viewer acceptance"]
```

The usable-tile node is an **OR gate**. An author can draw a tile, import art,
or start with a tile from an existing TST. Opening a TST also supplies tile art
for editing through C01. Adding an unchanged imported tile needs no pixel edit.
The gate applies to assembling a usable tileset. An editor can still allow the
author to start an empty set. C17 applies when the artwork needs transparency.

| ID | Capability | Acceptance |
| --- | --- | --- |
| C01 | Create and edit an individual tile | Create a tile, save it, reopen it, change pixels, and verify that the edit persists. |
| C13 | Import artwork as a tile | Import a single image or extract a cell from a sheet and verify its pixels and dimensions. |
| C14 | Open an existing TST for editing | Open a compatible TST and expose its tiles with their original slot numbers. |
| C15 | Create and edit an indexed tileset | Create and reopen a set, append a tile, and replace slot artwork while preserving the numbers of existing tiles. |
| C16 | Export a Toolkit-compatible TST | Export a tileset and open it in the online viewer. Verify the tile numbers, count, and appearance against the authored set. |
| C17 | Author and preserve tile transparency | Set or import transparent pixels and verify their appearance after export. |

A01 uses original 32×32 square terrain tiles for floor, wall, and an exit edge.
Its initial path is C01 → C15 → C16, with C13 available if the artwork is created
elsewhere. C14 covers a future editing workflow for existing Toolkit assets.
C17 is conditional for A01 and also applies to A02 if Bruce's art uses
transparent pixels. The downstream A05 board check verifies that a board cell
still resolves its tile after the artwork in that slot changes.

### Project context and capability status

The tile-supply OR gate remains valid for both internal and external tools.
Drawing artwork can occur independently; the integrated project workflow must
retain the originating requirement and assignment when a person creates,
opens, imports or saves artwork. C01's pixel round trip is accompanied by
W03/W04 assignment and proposed-variant persistence. An individual tile can
contribute to A01 without fulfilling its entire tileset requirement. Review
and exact build selection are separate W05/W06 outcomes.

| Capability | Current web Toolkit authoring support at main `75d6a76` | Other evidence and limits |
| --- | --- | --- |
| C01 | Missing drawing/edit/save/reopen workflow | External pixel-art and native Toolkit editors are candidate production tools; no selected A01 round trip is recorded |
| C13 | Missing artwork-to-editable-tile import | The viewer previews images from archives; this does not convert artwork into a tile for authoring |
| C14 | Missing editable-TST opening | Existing TST inspection exposes numbered previews; it does not provide an editable tileset |
| C15 | Missing indexed tileset authoring | Repository fixture builders generate predetermined sets; they are not a general author-facing assembly workflow |
| C16 | Missing author-facing TST export | Existing readers/tests and synthetic TST writers provide implementation evidence; JSON/PDF exports do not fulfill C16 |
| C17 | Missing transparency authoring | Existing decoders/previews exercise transparency; authoring and export preservation still need verification |

Contributor skill (for example, pixel art or tool familiarity), implemented
software capability, available inputs and requirement fulfillment are separate
facts. Work filters must distinguish them and allow alternative production
routes. The workflow contract records the requirement-to-variant links and
the evidence needed before an external route can count as verified support.

## Tools and processes to evaluate

| Capability | Candidate implementation path | Web Toolkit feature candidate |
| --- | --- | --- |
| C01 | Pixel-art editor or the native Toolkit tile editor | Draw, edit, and save individual tiles. |
| C13 | Image or sheet prepared in an external editor | Import an image or extract tiles from a grid. |
| C14 | Native Toolkit workflow or a compatible reader feeding an editor | Open a TST as editable artwork and numbered slots. |
| C15 | Native Toolkit tileset workflow or an indexed asset pipeline | Assemble or update numbered slots. |
| C16 | Native Toolkit export or a compatible writer | Export a TST and verify it through the existing viewer. |
| C17 | Art editor and compatible encoding workflow | Preview transparency and preserve it on export. |

These production paths are candidates pending a round-trip check. The
[Explorer inventory](../CAPABILITIES.md) records inspection and preview support.
The [pinned authoring references](TK3_AUTHORING_REFERENCES.md) document Toolkit
behavior. For A01, a path through C13 → C15 → C16 could unblock production if
tile artwork already exists. C01 remains a reusable authoring capability for
later terrain and sprite assets.


## Recovered complete authoring graph

The original intake graph is now preserved in [the capability ledger](../projects/bstw-demo/capabilities.json) and [source recovery](../projects/bstw-demo/INTAKE.md). It defines C02 animation frames, C03 playable character, C04 walkable board, C05 launch configuration, C06 resolved packaging, C07 board connections, C08 board object, C09 procedural dialogue/logic, C10 placement/activation, C11 stateful interaction and C12 progress/completion. These are documented requirements and mappings, not shipped authoring support claims.

Keep the current C01/C13–C17 tile-supply refinement above. The old broad C01 artwork node was decomposed; imported artwork need not pass through a web pencil. Use qualified `authoring:C01` and `player:C01` identities when joining project data because the initial player-outcome ledger used the same bare C numbers. A05 is Merlin’s Cave, A02 is four-direction sprite artwork, A03 is four ANMs, A04 is the TEM and A06 is the GAM/launch package. [Project records](../projects/bstw-demo/README.md) own that recovered asset ledger.
