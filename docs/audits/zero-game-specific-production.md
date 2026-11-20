# Generic production cleanup (#123 / #113)

Baseline: `07cbbbd4` (merged #131). No open PR or uncommitted implementation
was present. The architecture remains one archive/project resolver, static
inspection of commands/references, and one supported RPGCode interpreter with
shared browser services. Archive data owns game rules. No adapter is introduced.

## Classified inventory and decisions

| Files / baseline location | Assumption or inspected decision | Non-BSTW impact and replacement / disposition | Regression |
| --- | --- | --- | --- |
| `playability-audit.mjs:46–49,149–152` | Startup excerpts prefer case zero and named initialization helpers; interaction excerpts prefer a particular quest array/counter and dialogue helper. | Unrelated calls disappear from inspection; familiar-looking text is privileged. Remove both regex lists. Select bounded, ordered source lines from generic parsed calls and indexed references. Do not infer state, reachability or semantics from excerpts. | Renamed helpers, comments/strings, quest-only assignments, unfamiliar and member calls, reference lines, bounded excerpts; two independent browser archives. |
| `model.mjs:86–87` | Plugin-slot explanation uses one game's counts. | Wording suggests the specimen is the format rule. Replace with inclusive maximum-index and empty-slot semantics. Preserve reading every stored slot. | Existing GAM configuration/slot tests and independent renamed archives. |
| `artifacts.mjs:45,1114–1132` | Unsupported-layout diagnostics refer to a demo. | Generic files receive specimen-specific wording. Use layout/record diagnostics. Preserve the headerless partial reader: dispatch is by extension and validated record shape, never file/game identity; producer/field meanings remain unverified. | Existing format checks, including differently named observed-layout inputs. |
| `archive.mjs`, `archive-inventory.mjs`, remaining `model.mjs` | Installer signatures/names, typed asset folders, main-file anchors, scoped resolution and ambiguity. | Preserve verified packaging/layout rules. No game-title/character/startup-basename routing. A `.prg` basename resolves only through its project/role. | Nested/flat/sibling archives and ordinary familiar filenames. |
| `artifacts.mjs`, `asset-format.mjs`, `native-board-tail.mjs`, `media.mjs`, `save-state.mjs`, `pe-inspect.mjs`, `tile-palette.mjs` | Signatures, versions, field order, inclusive slots, coordinate codes, frame/tile formats and structural partial layouts. | Preserve. Source-backed format constants are not game rules. Headerless scratch records remain partial evidence, not a verified native format. No specimen-name selectors found. | Format, native field/tail, media and save/PE checks. |
| `rpgcode-references.mjs`, `script-trace.mjs`, `plugin-audit.mjs`, `game-graph.mjs`, `records.mjs`, `connection-map.mjs`, `inspector-history.mjs` | Command argument roles; source slot/line links; configured plugin and PRG edges; graph/history filters. | Preserve typed, static evidence. Share the generic call scanner with excerpts. Keep unknown/dynamic/unindexed references and static inspection of unsupported source. No quest-value interpretation or plugin capability inference. | Connected JSON schema, graph/trace/connection tests and UI/JSON evidence agreement. |
| `tk3-language.mjs`, `tk3-script-slice.mjs`, `tk3-gam-startup.mjs`, `tk3-runtime-keys.mjs`, `tk3-board-programs.mjs`, `tk3-board-transfer.mjs`, `tk3-fight-bridge.mjs` | Language tokens and call frames, GAM fields, authored placement/region activation, Send coordinates, explicit simulated combat. | Preserve. Variables/methods are arbitrary names. Slots and coordinates come from decoded records, not expected quest locations. No menu-shape/title recognizer remains. No runtime capability added. | Generic startup/key/Talk/Send/encounter/reset regressions; familiar identifiers behave as ordinary source. |
| `playable-scene.mjs`, `placed-sprites.mjs`, `vector-collision.mjs`, `experiments/movement-sandbox/{authored-play,engine,playtest-guidance}.mjs` | Authored sprite slots/positions, ITM override precedence, source collision/vector types, first animation frames, browser input/geometry policies. | Preserve. First/resolved candidate selection is generic UI policy, not a fixed placement slot. Browser 9px actor radius, 46px Talk range, rendering/input defaults and supported activation limits remain explicit approximations. | Independent altered slots/positions, ordinary filenames, movement/placement/activation and staged canvas checks. |
| `tk3-player-services.mjs`, `tk3-canvas-services.mjs`, `midi.mjs`, `piano-roll.mjs`, `sprites.mjs`, `tile-matches.mjs`, `tile-pdf.mjs` | Typed media/image reads, GS cache, screen/canvas handles, audio, pixel/animation and tile operations. | Preserve generic services and lifecycle/resource limits. Neither game names nor quest variables select behavior. | Existing GS/media, canvas, sprite/tile and PDF checks. |
| `app.mjs`, `index.html`, `style.css`, `catalog.json`, sandbox CSS | Inspector links and source jumps, configured launch, generic status/variables, native command catalog and supported browser controls. | Preserve. Checkbox `checked` is UI state, not a quest array. Catalog command descriptions are language reference data. No static quest HUD, title labels or actor names remain. | Normal file/Play/JSON paths and exact excerpt navigation. |
| `experiments/dodge-tiles/{project,card-scene}.mjs` | Experimental record-to-tile mapping and fixed pilot document/archetype identifiers. | Preserve generic mapping; these identifiers describe the export pilot, not an imported game's runtime. Test-only `check.mjs` is not staged. | Existing mapping/PDF checks and staged closure verification. |
| `.github/workflows/pages.yml`, `scripts/check-staged-site.mjs` | Explicit public copy set; old guard missed `.js`, configuration payloads, and the confirmed excerpt residues. | Scan all staged files, including lazy targets and unreferenced files; reject retired payload names and known game selectors in first-party production code. Exempt only the exact six pinned third-party code outputs; other files under `vendor/` are audited too. Keep archives, inert fixture data and historical source evidence separate. | Inject the old selectors/comment, an unreferenced `.js`, lazy adapter and retired JSON; prove legitimate fixture/evidence data still passes. |
| `experiments/movement-sandbox/inn-contract.json`, `docs/specs/*`, fixtures, optional private checks, test/build scripts | Historical source-derived inn/quest evidence and named specimen expectations. | Retain as provenance/test data; not in production imports or Pages copy set. Known game names in tests do not authorize production selectors. Public fixtures may deliberately use misleading names. | Staged traversal rejects a copied retired contract; synthetic archives preserve arbitrary names/values. |

Searches covered tracked first-party production modules, UI/CSS/catalog,
source recognition and resolution decisions, runtime triggers/services,
field/slot/coordinate comparisons, and the Pages copy/import closure.
The policy guard prevents known regressions; it is not a proof against every
possible disguised game rule. The classified code review and independent
metamorphic regressions supply the broader evidence.

## Verification and limitations

Results, exact PR head and CI run are recorded in #123 and the PR. Local
non-browser checks and staged Chromium are reported separately. Public
synthetic archives exercise ordinary Explorer upload, evidence navigation,
connected JSON and Play. Prior title, canvas, GS and generic player tests stay
enabled. Private owner archives are unavailable in this workspace, so no new
actual-ZIP execution or native Toolkit parity is claimed. The owner handles
merge, Pages deployment and deployed acceptance. Local Chromium cannot launch
under the workspace socket restrictions; the full staged browser matrix runs
in PR Actions.

The static scanner is deliberately tolerant and partial: call-shaped syntax
and indexed filename references establish source locations, not runtime
availability, conditional reachability or a complete AST. Excerpts are bounded
and disclose truncation. Native plugins/combat, save/load, full language and
board-entry execution remain separate compatibility work under #123.
