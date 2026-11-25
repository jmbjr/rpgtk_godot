# Project tracks and proposed usability work

## Current owner direction — November 22, 2026

### Authoring workflow clarification — November 23, 2026

The owner clarified that authoring starts from a project's unmet asset needs.
A contributor filters work by their skills, tool familiarity and subject
knowledge, opens the relevant brief, and saves an attributed proposed variant
against the requirement. Review can provisionally accept or accept an exact
revision; a build independently selects compatible exact revisions. Keep
contributor skills, authoring capabilities and implemented tool support distinct.

The [project authoring workflow](AUTHORING_WORKFLOW.md) owns planned W01-W07,
the minimal durable relationships and acceptance/handoff checks. The
[authoring graph](AUTHORING_CAPABILITIES.md) retains C01/C13-C17 prerequisites
and the draw/import/open alternatives for tile supply. The next authoring
increment is request-bound tile creation/editing: carry requirement/work context
through C01 and save/reopen a proposed variant. Shared review/accounts and build
services remain later work. This clarification does not settle open creative
intake choices, authorize game asset creation or claim these features exist.

### Owner-led game intake

The owner-led discussion from [intake #142](https://github.com/jmbjr/rpgtk_godot/issues/142) has been recovered in [the canonical project records](../projects/bstw-demo/README.md):
a completely new, simpler game authored by the owner with AI assistance, built
one selected asset/capability increment at a time. The working reference is the
owner's old BSTW demo, decomposed locally into candidate requirements rather than
adopting its plugin/class-library implementation. The recovered intake records
owner decisions and leaves detailed creative briefs explicitly open. The existing TK3
test game and generated regression labs do not define the new creative scope.

Use core Toolkit editor features and ordinary procedural RPGCode first. Combat
is provisionally excluded. Menu/inventory/save requirements need an intake
decision: original default menus and combat are plugin-backed and must not be
assumed to be plugin-free or implemented in the browser. Retain one generic
player/model/runtime; keep game decisions in new content. New assets can enter
the repository after the concrete scope is agreed; original ZIPs/assets/DLLs and
private source stay local unless separately authorized.

Intake #142 specifies exact ZIP/hash provenance, capability and requirement
ledgers, an asset burndown, a minimum launch bundle, owner decision points and
complete-game acceptance. [Pinned TK3 authoring references](TK3_AUTHORING_REFERENCES.md)
support that work. #92 remains the original BSTW evidence ledger; this is a new
authoring track, not restoration of its removed adapter or proof of original-ZIP
compatibility.

Main `840f7c55` includes merged #140's bounded multi-hop board dependency
investigation. Actions 45090803221 passed checks and Pages deployment; human
acceptance remains separate. Earlier review snapshots below retain their dates.

### Future opportunity, gated on the simpler completed game

[Opportunity #141](https://github.com/jmbjr/rpgtk_godot/issues/141) records the
research sources and exact known license/scope limits:

- [Adonthell — Waste's Edge](https://adonthell.nongnu.org/) and its
  [data-driven port](https://github.com/Ferk/wastesedge-v32): investigation,
  dialogue/quest material, maps and beginning/ending references.
- [JGA: Crossroads of Destiny](https://github.com/freakified/jga): released story,
  screenplay, chapter scenes and turn-based mechanics.
- [Flare: Empyrean Campaign](https://github.com/flareteam/flare-game):
  editable campaign/quest/NPC/item/enemy content.
- [Ashes of the Hollow Sun](https://github.com/drifter2023/crpg-narrative-design):
  open GDD; detailed dialogue, regional quests and mechanical notes remain planned.

None is selected for adaptation. Promotion requires the simpler game's
owner-agreed complete scope to be implemented and accepted on an exact deployed
build, with all in-scope assets/scripts and story paths verified. Source/license
review and an owner scope choice then precede any external adaptation.
The generic TK3 → TK2 → DODGE/Godot direction remains; #33 stays separate.

## Original track review snapshot

Reviewed November 21, 2026 against main
`53a47eeca10e87050eccf5aaa8823817b5aa1496`. All 18 issues, including closed
milestones and their discussions, were reviewed. There were no open PRs at
the review checkpoint. This document maps the work; live issues retain the
detailed assignments and acceptance evidence.

## Product direction

The current product helps a person open an RPG Toolkit game, inspect its
contents and follow its asset/source connections. Supported execution helps
investigate those same imported records through the shared model/runtime.
The long-term direction is a Godot toolkit informed by verified Toolkit
semantics. Game identity and rules belong in imported data and source.

The [capability inventory](../CAPABILITIES.md) describes today's user tasks.
The following tracks explain why different kinds of work are in the backlog.
They are not separate website modes that a visitor should have to learn.

## Active and future tracks

| Track | Human outcome | Issues and current position | Remaining acceptance |
| --- | --- | --- | --- |
| **Explore assets and connections** | See/hear what is in a game and trace how its pieces relate | #37 and explorer scope of #123. Initial viewer, per-file JSON and connected JSON shipped in #3/#8/#9; shared resolver and connected workflows followed in #125–#126 | Complete reference/provenance coverage for supported records; clearer navigation; bounded board dependency investigation is in review; selection/export/recomposition remain separate |
| **Format accuracy and evidence** | Trust what the viewer says and see where knowledge is incomplete | #27 specifications; #41 Toolkit 2 converter parity; #63 historical matrix/specimens; #79 native Toolkit 3. Initial GAM work #80 is closed | Historical layouts, projection, schema/conformance completeness and original editor/save/runtime comparisons; the 57-row TK2 ledger includes 3 partial and 2 evidence-blocked rows |
| **Generic Toolkit 3 execution** | Try supported authored behavior and diagnose a failure at its source | #123. Startup/language/title/canvas/audio in #128–#131; entry/tasks/live moving entities in #133–#135 are merged and deployed | Owner acceptance of authored boards; inline tasks, pathfinding and verified foreground handoff, broader language/objects, native combat/plugins and save/load remain separate work |
| **Toolkit 2 execution** | Eventually try older games using verified shared systems | Next runtime phase in #2/#123, after the current generic TK3 sequence; #41/#63 provide format evidence | Define a source-backed playable slice; decoder coverage does not establish runtime compatibility |
| **Project authoring and asset fulfillment** | Find suitable asset work, submit attributed variants, review fulfillment and select content for a build | Owner direction from #142 and #144's C graph; planned [W01-W07 workflow](AUTHORING_WORKFLOW.md) and next handoff | Request-bound C01 round trip first; review and build selection later; all are planned, with creative intake decisions retained separately |
| **DODGE print-and-play / TTS** | Turn selected content into physical or tabletop experiments | #33. Tile identity pilot #31 closed; selected-tileset PDF exists; generated fixture PDF/TTS checks are experimental | Owner-selected conversion scope and verified rules; a tileset PDF does not establish whole-game conversion |
| **DODGE video-game profile / Godot** | Reuse verified game structure/behavior in a future toolkit | #1, downstream of generic TK3 then TK2 compatibility in #2 | Multiple verified games, stable source identities and a usable target mapping; no general playable Godot export exists today |

Usability spans the current Explorer and player. It needs an explicit delivery
sequence alongside compatibility work, rather than being inferred from
additional format readers or runtime commands.

## Closed experiments and retained regression evidence

| Issues | Meaning today |
| --- | --- |
| #3, #8, #9 | Delivered initial viewer and JSON milestones. Later work supersedes their original UI/coverage assumptions. |
| #31 | Delivered tile/tileset identity pilot; feeds the separate #33 experiment. |
| #80 | Delivered initial native GAM 2.9 reader; native format parity remains in #79. |
| #94, #96 | Delivered historical movement/inn experiments, subsequently retired during generic consolidation. They are not current parallel product paths. |
| #113 | Game-specific production cleanup completed through #124/#132; retained named fixtures and historical documents are evidence, not game dispatch rules. |
| #92 (open) | Preserves BSTW findings and a future generic regression/playthrough target. Complete original-ZIP ending remains unproven; it does not authorize a game-specific implementation path. |

Issue #2 is the umbrella roadmap. #123 owns the shared Explorer/runtime
implementation sequence. #37 owns graph investigation; #27/#41/#63/#79
own format/evidence gaps. Keep tasks assigned to these owners instead of
creating another competing compatibility roadmap.

## Changes since the previous roadmap checkpoint

PRs #133–#135 have merged. Main Actions
[44941133882](https://github.com/jmbjr/rpgtk_godot/actions/runs/44941133882)
passed checks and deployed Pages at `53a47ee`. They add board entry,
cooperative file-backed background tasks and shared moving-entity state.
The Living boards Harbor/Grove archives provide synthetic regression paths.

The prior #2/#123 wording that calls these unmerged/next implementation work
is superseded by this result. Actual owner-ZIP execution and deployed human
acceptance remain pending. The pinned public demo's ItemPath/inline task
requirements are still unsupported; queued PushItem fixtures do not prove
that demo's pursuit behavior. Original Toolkit execution was not performed.

## Interface findings before Sprint 1

These are source/interface observations and hypotheses to validate with a
person, not completed usability research:

- The page identifies itself as a Toolkit 2 source viewer although it also
  handles native TK3 records, media, connected export and supported execution.
- Archive setup mixes the primary import action, numerous downloadable
  regression ZIPs, native Toolkit instructions and technical status panels.
- Browsing, previews, references, command catalogs, decoded data, playability
  evidence and runtime controls appear at different levels without a short
  explanation of which task each serves.
- **Capability graph** names a command/catalog view; a visitor could reasonably
  expect it to explain product capabilities instead.
- Many disclosures preserve valuable detail, but their quantity and labels do
  not by themselves tell someone what to open first or what a result means.

## Sprints 1–3 merged; board investigation in review

PR #136 merged at `7265632fd80b12add39725e2fd94e2054f94c58f` and established this
inventory/track map. PR #137 implements Sprint 1 below: accurate identity, one
archive picker, three experience-labeled examples and post-import task actions,
with normal Play separated from direct diagnostics. Its PR and `first-use-review`
Actions artifact record the exact build, fixture hashes, desktop/mobile screenshots,
keyboard/journey results and remaining owner acceptance. PR #137 merged at `e392e99f10754e9ad2612e76243f23753713161f`; its integration
checks and Pages deployment were verified by the owner at handoff. Owner
usability acceptance is not established by merge or automated checks. Material decisions
and the short owner checklist are in [first-use.md](usability/first-use.md).

Sprint 2 ([PR #138](https://github.com/jmbjr/rpgtk_godot/pull/138), merged at `ff0f2fb`)
implements the selection identity, preview/source, single visible
connection view and technical evidence structure described in
[selected-asset.md](usability/selected-asset.md). Its review PR/Actions artifact
record synthetic evidence. Main [Actions 45011045812](https://github.com/jmbjr/rpgtk_godot/actions/runs/45011045812) passed checks and Pages deployment; independently verified during Sprint 3.
Human acceptance is still separate.

Sprint 3 ([PR #139](https://github.com/jmbjr/rpgtk_godot/pull/139), merged at `cd1ecbe`)
refines complete board/tile/history, audio/caller, unresolved-reference,
technical/export and normal/direct Play journeys. [Complete-journey notes](usability/complete-journeys.md)
record the implementer's production observations, source corroboration, cached
asset issue, decisions and required fresh-context staged evidence. No newcomer
study or owner usability acceptance has been performed. The implementation and
automated checks do not complete the human acceptance item below.

## Usability delivery sequence

These are reviewable outcomes for discussion. They do not prescribe a new
framework, a full redesign or removal of technical evidence. Validate the
capability groups with the owner before treating a navigation design as final.

### Sprint 1 — Explain the product and the first useful action

**Outcome:** a visitor can describe the product, choose a task and reach a
recognizable result after opening an archive or a public example.

- Review the capability inventory with the owner; settle the initial task
  names and the primary first-use journey.
- Give the page an accurate short identity and explanation of current scope.
- Make import and example selection understandable. Label examples by what a
  person can observe; put the full regression-download inventory in an
  appropriate secondary location.
- Clearly distinguish opening an archive, inspecting it, playing supported
  behavior and bypassing startup for diagnostics.

**Acceptance:** a new visitor can explain what the site does, what input to
provide, which example demonstrates their intended task and what to do next.
Verify one visual asset, one sound and one relationship using the actual
staged UI. Record desktop/mobile and keyboard results; record owner review
separately from automated checks.

### Sprint 2 — Make a selected asset understandable

**Outcome:** someone can tell what they selected, preview it, follow a
relationship and return without losing their place.

- Organize existing information around preview, connections and source/detail
  with a consistent selection context. Decide the exact arrangement from
  the reviewed tasks, rather than the current module boundaries.
- Explain missing targets, unsupported versions, unknown computed references
  and runtime limitations in terms of what the person can still do.
- Keep decoded records, source provenance and diagnostic evidence accessible
  as secondary detail with descriptive labels.
- Preserve #137's **RPGCode command reference** label; the old **Capability graph**
  ambiguity was resolved in Sprint 1.

**Acceptance:** complete board → tile → used-by, sound → caller source line,
and missing-reference investigation; Back/Forward restores the expected
selection. Verify independently structured TK2 and TK3 fixtures and ensure
the UI agrees with connected JSON. Preserve existing playback and exports.

### Sprint 3 — Validate complete journeys and simplify from evidence

**Outcome:** an unfamiliar person can accomplish the agreed tasks without
knowing the implementation or the issue history.

- Walk through opening a game, viewing art, listening to sound, tracing a
  dependency, trying supported behavior and exporting a result.
- Observe confusing words, competing controls, hidden state, focus order and
  narrow-screen problems. Refine the interface and capability inventory from
  those observations.
- Make current support and experimental/test controls understandable in their
  relevant context. Keep encounter simulations explicitly labeled.

**Acceptance:** record who attempted each task, the exact build/archive,
browser/device, observed result and remaining confusion. Human verification
must remain visible beside synthetic regression coverage; do not convert a
merged PR or green CI into an assumed usability pass.

## Maintenance

- Use #2 for direction and #123 for compatibility delivery; link usability
  assignments there when the proposed sprint scope is agreed.
- Update `CAPABILITIES.md` when a human task, its starting action or its
  support boundary changes. Keep command/format detail in existing contracts.
- Record merge, deployment, synthetic tests, actual ZIP tests, owner browser
  acceptance and original Toolkit checks independently, with exact versions.
- Keep private game archives, assets, DLLs and source local unless the owner
  separately authorizes publication.


## Current Explorer checkpoint: evidenced board dependencies

#139 main checks and Pages deployment passed in Actions 45085632842; verified
independently along with the live build identity. The next review adds a bounded
read-only outgoing investigation from a selected board: expand multiple hops,
retain each route’s evidence, identify cycles/shared assets/unresolved links,
open exact source/tile/owner evidence and return through the existing inspector.
This advances #37/#123 without changing resolution, runtime or JSON semantics.
Material decisions, limits, synthetic verification and one owner checklist are
in [board-dependencies.md](usability/board-dependencies.md). Editing/rewriting,
subset selection/export, merging archives and playable Godot export remain future
work. Automated evidence and owner usability acceptance remain separate.

## Reconciled intake and studio planning

The original intake has been recovered from both shared transcripts, including A01–A06, the ordered additions and authoring C02–C12. [The project manifest](../projects/bstw-demo/project.manifest.json) is the durable entry point; [the intake](../projects/bstw-demo/INTAKE.md) retains source authority and open choices. #142’s earlier waiting status is historical. [Studio director](../planning/index.html) derives milestones and route readiness from the linked project, studio, capability and scenario records. Actual roster/hours, creative briefs, production verification, asset acceptance and deployment remain separate. #149 carries this planning integration; #146 remains the independent local tile editor proposal.
