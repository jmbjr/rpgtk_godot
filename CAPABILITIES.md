# What can I do with the Game Explorer?

Open an RPG Toolkit game archive, see and hear its contents, and follow how
its files connect. You can also try the supported parts of an imported
Toolkit 3 game and export structural information for further work.

This is a **working capability inventory**, reviewed against main
`53a47eeca10e87050eccf5aaa8823817b5aa1496` on November 21, 2026.
It describes tasks a person can accomplish, rather than every parser,
command or technical panel. The groupings are proposals for discussion;
they do not commit the website to a particular navigation design.

## Start with something you want to accomplish

| I want to… | Start here | A useful result looks like… |
| --- | --- | --- |
| Rediscover an old game's art and sound | Open its ZIP, then browse its files | Recognizable boards, sprites, animations and playable music/sounds |
| Find where a picture, sound or program is used | Select the file, then follow **Used by** or **Connection map** | A linked consumer, with a source line, field or placement where available |
| Understand why something is missing or unsupported | Inspect its references and decoding status | The recorded filename, resolution result and available source evidence |
| Understand what a program refers to | Select a PRG and follow its source/reference links | Movement between the program, referenced assets and command documentation |
| Try a game's supported behavior | Use **Play game** after import | Authored startup and board behavior, or a diagnostic identifying the unsupported operation |
| Take structural information into another tool | Choose **Download connected game JSON** | Decoded records and linked evidence, with unresolved references preserved |
| Make physical cards from a tileset | Select a supported TST and download its print-and-play PDF | Cards containing that tileset's tiles in order |

The exact labels above describe today's interface. A later usability sprint
may change them. The website's existing **Capability graph** refers to
RPGCode commands and catalog entries; it is a technical view, distinct from
this list of user tasks.

## 1. Open and find things in a game

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| Open a local game archive | Choose **Game archive**; optionally choose a separate GAM Main File | Reads supported archive/layout bytes in browser memory; an arbitrary ZIP is not necessarily a compatible game |
| Open a game from a link | Paste a public HTTPS **Game ZIP URL** | Requires the host to allow browser reads; download and import locally if it does not |
| Open supported packaged downloads | Import a single-game Actions wrapper ZIP or recognized Toolkit installer/package | Supported wrappers are recognized structurally; this does not run an EXE or installer |
| Find an asset or program | Browse the archive's folders and files | Inventory includes files whose contents cannot yet be decoded |
| See which files configure the game | Inspect Main File bindings and linked startup assets | Recognized GAM versions expose different supported fields; inspecting a different GAM does not silently replace Play's embedded launch configuration |

## 2. See and hear the contents

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| View individual tiles and tilesets | Open GPH/TST files; select a numbered tile | Format/version coverage is explicit; unsupported layouts remain visible |
| Inspect a board's visual composition | Open a BRD, toggle supported layers and follow its tiles | Static preview coverage and player projection coverage differ; full isometric/native editor parity is unfinished |
| Inspect characters, items, enemies and backgrounds | Open the corresponding asset inspector; follow its source art | Rendering depends on a supported record version and resolvable component assets |
| Watch an animation | Open TAN/ANM or supported animated sprite controls | ANM preview can step/play/loop and play supported frame WAVs; board preview may show a first frame |
| Listen to music and sounds | Open MIDI/WAV and use playback, pause/reset and available sound controls | MIDI uses browser synthesis/sound banks; it is not a claim of original hardware/plugin sound parity |
| Examine how MIDI music is arranged | Expand MIDI tracks or the piano roll and select instruments | This is inspection/playback, not a music editor |
| Preview supported fonts and images | Open the file; enter sample text for a font | Availability follows the supported decoder/browser image format |

## 3. Follow connections between files

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| Find what a file uses and what uses it | Follow **References**, **Used by** and **Connection map** | The index covers recognized bindings and static references; computed runtime filenames can remain unknown |
| Follow a relationship to its evidence | Open its target, source line, tile number, board slot or owner | Evidence precision depends on the relationship; unresolved targets retain the raw value/candidates |
| Narrow a crowded connection view | Filter the direct map by direction, neighbor type or resolution | This is direct-neighbor navigation, not an expandable whole-game multi-hop graph |
| Retrace an investigation | Use browser Back/Forward between inspector selections | Opening another ZIP starts a new archive trail |

The original goal of connecting every asset remains an acceptance target.
Inventory coverage, reference discovery and successful resolution are
different results. A listed file is not proof that every relationship to it
has been found.

## 4. Understand source and compatibility

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| Read a program beside command/reference evidence | Select a PRG, choose a call and jump between source and references | Static call scanning is partial; recognizing a call does not mean Play can execute it |
| Inspect decoded records and format documentation | Expand decoded JSON and follow revision-specific specifications | Some layouts/fields still have partial or missing historical/editor evidence |
| Investigate startup and board behavior bindings | Inspect GAM/BRD/ITM bindings; follow entry/task source and owner links | Inline background source currently needs further support; task execution and inspection are separate checks |
| Inspect plugin or save-file metadata | Open supported DLL/SAV records | The site does not execute arbitrary DLLs or resume a game from an inspected save |

## 5. Try supported game behavior

These capabilities are **limited Toolkit 3 compatibility**, using one shared
source-driven player. They do not establish a complete playthrough of an
arbitrary imported game. Public examples are synthetic regression games;
their success is evidence for their exercised behavior.

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| Start through the game's own supported startup | Choose **Play game** | Supported GAM startup, included helpers, source title/text/cursor choices, media and canvas/input share the runtime; unsupported language/services diagnose |
| Move around and activate supported board interactions | Move with keys/D-pad; Talk or use imported game keys/regions | Supported placements, step/key triggers and board transfers use session state; collision uses documented browser approximations |
| Observe board entry, background programs and moving characters | Try **TK3 Living boards · Harbor/Grove**, or compatible imported source | File-backed cooperative tasks and queued PushItem movement work; ItemPath/pathfinding, inline tasks and some task-to-foreground transitions remain open |
| Investigate a board while bypassing startup | Use **Board diagnostics → Play opening board (direct diagnostic)** | Fresh session, startup skipped, board entry still runs; this is a different evidence path from normal Play |
| Test encounter follow-up scripts | Use the explicitly labeled simulated outcome controls | Runs supported victory/defeat follow-up behavior; native combat is not implemented |
| Inspect a running script problem | Read the diagnostic and follow available source/owner links into Explorer | A useful error is evidence of a boundary, not a successful execution result |

Save/load gameplay, arbitrary native plugins, full language/object support,
native combat and complete Toolkit 2 runtime compatibility remain open.
Current details live in the [shared script contract](docs/specs/tk3-script-interaction.md)
and [board lifecycle contract](docs/specs/tk3-board-lifecycle.md).

## 6. Take results away

| Capability | How to use it today | Boundary |
| --- | --- | --- |
| Export a connected structural description | **Download connected game JSON** | Includes supported decoded records, identities, relationships and unresolved evidence; it is not an editable or rebuilt playable project |
| Print a selected tileset as cards | Select a supported TST → **Download print-and-play PDF** | Exports the whole selected tileset in order; it does not infer a complete game's tabletop rules |

Selecting/recombining a graph subset, editing assets/programs, generating a
general DODGE video-game profile and exporting a playable Godot project are
future work. Existing DODGE print-and-play/TTS experiments have their own
[track](docs/PROJECT_TRACKS.md).

## What evidence supports this inventory?

This draft was prepared by the integration review chat from all 18 repository
issues and their discussions, recent merged PRs, the current source and its
contracts. It is a repository review, not a new human usability study.

| Evidence class | What was checked for this draft | What it establishes |
| --- | --- | --- |
| Repository implementation | Main `53a47ee`; latest authored-board work in PRs #133–#135 | The implementation and documented boundaries exist at that revision |
| Synthetic CI | Main Actions [44941133882](https://github.com/jmbjr/rpgtk_godot/actions/runs/44941133882), checks successful | Automated checks, including staged browser regression paths, passed; this is not owner acceptance |
| Deployment | Same run's Pages deploy successful; public HTML returned HTTP 200 and contained the Living boards downloads | Deployment completed and the document was reachable; no fresh rendered interaction test was performed in this review |
| Actual game ZIPs | Existing reports in the source contracts and issue #123 | Historical checks apply only to their recorded ZIP, revision and checkpoint; no private ZIP was rerun for this draft |
| Original Toolkit | Pinned-source findings and outstanding editor/runtime work in #27/#41/#63/#79 | Source inspection and original executable verification remain separate evidence |

For detailed evidence, use the [Explorer verification paths](docs/specs/explorer-release.md),
[format coverage matrix](docs/specs/compatibility-matrix.md), and
[roadmap/issue map](docs/PROJECT_TRACKS.md).

## How to refine this file

A capability currently means: **a person can perform an observable task with
an identifiable input and recognize a useful result**. A decoder, runtime
instruction or accordion is an implementation detail unless it enables such
a task. Several capabilities can share one underlying system.

For each revision, check whether a newcomer recognizes the task, can locate
its starting action and understands the result and limits. Split or merge
entries based on that feedback. Keep detailed syntax/version tables in the
specifications; update this file when a user task, starting action or support
boundary changes. Record human verification with the build, input, browser,
verifier and observed result.
