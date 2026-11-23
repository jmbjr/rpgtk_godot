# Toolkit authoring capabilities

This graph starts with A01, the cave terrain tileset from the
[owner-led game intake](https://github.com/jmbjr/rpgtk_godot/issues/142).
It describes what an author must be able to do. Tool selection and web features
are tracked separately from prerequisites.

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
