# Project authoring: requirements, work and asset variants

## Direction and implementation status

Owner direction recorded November 23, 2026: connect a project, discover the
assets it needs, filter the work by what a contributor can do, open a bounded
assignment, and save the result as a proposed implementation variant. A later
review can accept that variant, provisionally accept it, or request changes.
A particular build selects exact compatible variants to fulfill its needs.

This is a planned product workflow and implementation handoff. It does not
describe features already available in the web Toolkit. Reviewed main
`75d6a7688a5a8a9083601ae3488ef3d71bb475b3` includes #144's
[authoring capability graph](AUTHORING_CAPABILITIES.md), but no requirement-led
work queue, contributor matching, variant submission, review or build-selection
workflow. The [Explorer inventory](../CAPABILITIES.md) remains the source for
tasks supported today. No game assets or project implementation are supplied
by this document.

## Concepts that must remain distinct

| Concept | Meaning | Cave example |
| --- | --- | --- |
| Project requirement | An intended game/player outcome, with its source and acceptance criteria | The demo needs an explorable cave area; further story choices remain with the owner |
| Asset requirement | A stable need that exists before a file does; includes constraints, consumers and acceptance | A01 needs cave terrain artwork for floor, wall and an exit edge |
| Work item | A bounded assignment contributing to one or more asset requirements | Draw a floor tile contributing to the A01 tileset |
| Authoring capability | An observable task the production workflow must enable | C01 draws/edits a tile; C13 imports artwork; C15 assembles numbered tiles |
| Contributor skill | Knowledge a person brings, recorded separately from software support | Pixel art, terrain readability, familiarity with a particular tool |
| Production route | One way of performing the work, with its tools, skills, inputs and output constraints | Web tile drawing, or external artwork followed by import |
| Variant and revision | A candidate fulfillment with a stable identity and exact saved content revisions | Illustrative name: "Test Cave 5", attributed to "Joe Schmo"; these are not existing assets or people records |
| Review decision | An assessment of an exact variant revision against an exact requirement revision and target | Provisionally accepted for a demo, with a recorded limitation |
| Build selection | The exact variant revisions chosen to satisfy a build's asset requirements and target | A demo selects one A01 tileset revision and its dependencies |

A01 identifies the cave tileset need, not every individual tile within it.
A tile work item can be a partial contribution to A01. A successfully decoded
file, a completed work item, an accepted variant and a satisfied build
requirement are separate outcomes.

Asset requirement IDs must survive renamed files and replacement artwork.
Keep explicit links to existing archive identities, source paths and numbered
tiles where relevant; do not derive requirement identity from a file path.
Existing decoded records and resolver IDs retain their current meaning.

## Planned workflow capabilities

W01-W07 are stable workflow capability IDs introduced here. C01/C13-C17 retain
their existing authoring meanings. All W capabilities below are planned;
the implementation options are candidates, not shipped support claims.

| ID | Capability and observable result | Small initial implementation option | Later alternatives |
| --- | --- | --- | --- |
| W01 | Connect a project and see its required assets, existing candidates, unmet needs and dependency context | Open a versioned local project manifest linked to the existing archive/model where available | Repository or service adapter supplying the same project records |
| W02 | Find work suited to the contributor's skills, known tools and selected readiness filters | Explicit skill/tool tags, a contributor's self-declared profile, and a filtered work list | Shared profiles or richer recommendations with explained matches |
| W03 | Open a bounded assignment in an appropriate authoring route with the requirement already attached | Work brief plus an editor launch carrying project, requirement, work-item and route IDs | External-tool instructions and import return path using the same assignment context |
| W04 | Save or import an attributed proposed variant revision against the assignment | Persist editable source/output references and provenance with the project manifest | Repository-backed submissions or shared artifact storage |
| W05 | Review an exact submission against the requirement and retain the decision and evidence | Explicit review records with reviewer, scope and provisional conditions | Collaborative review UI; permission enforcement when shared accounts are implemented |
| W06 | Select compatible exact variant revisions for a build and identify gaps or conflicts | A build selection manifest with target and explicit requirement-to-revision bindings | Target-specific build adapters using the same selections |
| W07 | Reopen the project and retrace a need, its work, submissions, reviews and selected uses | Reopen saved records, resolve their links and expose a compact trace view | Query/export over the same relationships |

### Find suitable work without requiring the whole game's context

Match contributor skills and tool familiarity against at least one viable
production route. Alternatives are OR choices; a contributor need not know
every possible tool. Requirements within the chosen route still apply.
For example, external drawing followed by C13 can supply artwork without
requiring proficiency in the web drawing editor.

Keep these filters independent and explain why work is shown or hidden:

- Contributor fit: declared skills, tool familiarity and relevant subject
  knowledge. Unknown or learning status remains explicit, rather than being
  inferred as proficiency or inability. Contributors can inspect excluded work.
- Production readiness: required inputs/dependencies are available, missing,
  or unverified. Ability to perform the work does not imply its inputs exist.
- Tool support: the route is implemented, partial, external, proposed, or
  unverified. A viewer preview does not establish authoring support.
- Project need: no candidate, proposed candidates, changes requested,
  provisional fulfillment, or a selected fulfillment for the chosen build.

#### W02 and W03 discoverability requirements (planned)

The [discoverability follow-up](https://github.com/jmbjr/rpgtk_godot/issues/147)
tracks implementation and acceptance.

- **W02 — Discover project vocabulary.** Let contributors browse and select
  recognized skills and tools using readable labels backed by stable IDs.
  Preserve existing free-text declarations when reopening saved projects.
- **W02 — Explain the match.** For included and excluded work, show the
  relevant production routes, their capability IDs, required skill and tool
  declarations, and any undeclared requirements. One viable matching route
  is sufficient. Show tool support and input readiness independently of fit.
  Unchecked inputs stay unverified.
- **W03 — Understand the assignment before launching.** Describe the
  immediate deliverable, format and dimensions where relevant, constraints,
  required references and their availability, and acceptance checks. Identify
  creative choices explicitly left open. Keep board, level and game context
  linked and expandable so the contributor can work from the brief.


### Save, review and build behavior

Saving a submission creates a proposed variant revision and retains its
assignment links automatically. Optional draft/autosave storage can precede
submission, but must have an explicit status. An external-tool import must
preserve the same links. Contributors may create competing variants.

Review decisions apply to exact saved content and requirement revisions, with
their target/scope. Record proposed, provisionally accepted, accepted, and
changes-requested outcomes separately. Provisional acceptance includes its
reason, limits and remaining check. A later edit produces a new revision and
does not inherit acceptance silently. One tile's approval does not accept the
entire tileset or a complete playable game.

A build pins exact variant revisions and required dependency revisions. It
checks target, format, reference/slot compatibility and unmet requirements.
Selection and acceptance are distinct: an accepted variant can remain unused;
a deliberately selected provisional variant retains its limitations in that
build. Record that choice explicitly. Saving a candidate must not silently
replace another build's selected content or renumber existing tiles.

## Minimum durable information

This is a logical contract, not a new executable schema or a prescribed
storage backend. Choose field names/schema versioning in the implementation;
preserve the relationships and revision semantics below.

| Record | Information that must survive save/reopen and handoff |
| --- | --- |
| Project | Stable project ID, metadata version, requirement/work records, and linked archive or repository context when available |
| Requirement | Stable project-scoped ID and revision, intended outcome or asset role, parent/consumer/dependency links, constraints, provenance and acceptance criteria; unresolved decisions explicit |
| Work item | Stable ID, linked requirement revision(s), bounded contribution and completion criteria, input needs, available production routes, required skills/tools and work status |
| Contributor profile | Stable contributor reference, display name and explicitly declared skill/tool familiarity; unknowns remain unknown |
| Production route | Stable reference, authoring capability IDs, required tools/skills, expected inputs/outputs and implemented/external/unverified support evidence |
| Variant revision | Stable variant ID plus exact revision/content identity, fulfilled or contributed-to requirement revisions, work item, contributor, chosen route/tool/version when known, editable sources, produced files, dependencies and provenance/license information |
| Review | Exact variant revision, requirement revision, target/scope, reviewer, decision, timestamp, evidence and provisional conditions or requested changes |
| Build selection | Build ID/revision, target, requirement-to-variant-revision bindings, dependency/output mappings and explicit unresolved or provisional selections |

Unknown provenance, tool versions, skill claims or licenses must be recorded
as unknown, not invented. Attribution is not proof of authenticated identity.
A local first increment can use an explicitly entered contributor reference;
shared accounts and authorization remain separate implementation decisions.

Keep source artwork distinct from packaged outputs. Stable revision references
and content hashes can identify the exact bytes reviewed and built. Retain
tile slot bindings and existing static-reference evidence when mapping a
chosen variant into a Toolkit tileset or board. A requirement change must make
older reviews visibly refer to the earlier requirement revision.

Saving a project must include its artwork or durable, resolvable references
to it. Browser-only object URLs or an unsaved editor buffer do not establish
persistence. A fresh session must recover the assignment, metadata and exact
saved artwork together, and identify any unavailable referenced files.

## Toolkit and DODGE targets

Print-and-play, TTS and video game are implementation targets. Each can have
its own candidate variants, representation constraints, generated outputs and
acceptance evidence. A build selects compatible variants for its target;
shared source artwork may feed multiple targets through explicit mappings.
Acceptance for one target does not automatically establish another target's
acceptance. Whole-game adaptations can require different asset decompositions.

The existing [Toolkit-to-DODGE tile pilot](../experiments/dodge-tiles/README.md)
already retains tile/object bindings and board references, and its fixture
pipeline produces target manifests for PDF/TTS experiments. Reuse those
identities and mappings where appropriate. That evidence does not establish
W01-W07, a contributor/review service, a complete game conversion, or general
playable Godot export. This plan does not change the DODGE specification.

## Current foundational handoff — November 25, 2026

The owner has paused production implementation in #146. The next milestone is [assumption-driven capability feasibility](CAPABILITY_PROGRESSION.md): separate the capability progression model from studio support, add explicit applicability/quality/availability assumptions, and derive explainable current/later opportunities. This is not a schedule or an execution plan. Preserve the recovered intake and reuse #149’s durable loading/identity/persistence machinery. The contract’s target/profile/availability acceptance cases come before automatically resuming tile-editor integration.

## Paused request-bound tile handoff

The retained production increment is **request-bound tile authoring**: establish the
minimal durable request-to-variant contract and carry it through C01's
create/open/save flow. C01 remains the first drawing capability on the
documented A01 production path. W03/W04 supply its assignment and submission
context; a minimal W01/W02 work list and W07 save/reopen path make that context
usable across sessions. W05/W06 remain planned follow-on capabilities; this
increment need not implement shared review, accounts or a build service.

An initial local manifest and explicit skill/tool tags are sufficient options.
An existing external-art route can also be represented, with its actual
support marked honestly. Implementing every route is unnecessary. Original
archive inspection must remain available independently of project authoring.

The proposed C01 editor scope is one 32x32 opaque square tile, color selection,
pencil drawing, enlarged/actual-size preview and save/reopen. A standalone
uncompressed true-color GPH is a candidate editable output because its
[documented format](specs/gph.md) and decoder already exist; PNG or a separate
source representation remain implementation choices requiring a justified
round-trip check. C13 import, C15 indexed assembly, C16 TST export and
conditional C17 transparency retain their separate capability boundaries.

### End-to-end acceptance for the first increment

Use explicitly synthetic project metadata and diagnostic artwork for automated
checks. Do not create or choose owner game artwork, story, contributor skills
or build acceptance on the owner's behalf.

1. Open a project with an asset requirement, linked tile work item, constraints
   and a production route. Preserve A01's tileset-versus-tile distinction when
   using an illustrative A01 context.
2. Set a contributor's declared skill/tool tags. Show suitable work, explain
   a second unmatched or unknown-skill item, and expose readiness separately.
3. Open the selected brief and launch the editor with its assignment attached.
   Draw an asymmetric diagnostic tile with known colors at known coordinates.
4. Save a proposed variant with contributor and route provenance. Verify that
   it links back to the exact requirement/work item and retains source/output
   references. It remains unreviewed and unselected for a build.
5. Reload/reopen the saved project and artwork. Compare dimensions and all
   pixels through the existing decoder, then change a pixel and save again.
   Retain exact revision identity/history and the assignment links.
6. Confirm a second variant can coexist; a partial tile submission does not
   mark A01 complete or mutate the imported archive or a build selection.

Document implemented starting actions and support evidence after delivery.
W05 later proves review/revision/provisional semantics; W06 later proves exact
target-compatible selection and explicit missing/provisional dependencies.
Neither should be reported as delivered by the first increment's tests.

## Maintenance and continuity

- This file owns the workflow, record relationships, W IDs and handoff checks.
  [AUTHORING_CAPABILITIES.md](AUTHORING_CAPABILITIES.md) owns C capability
  prerequisites and production-route alternatives; keep the links aligned.
- Update [CAPABILITIES.md](../CAPABILITIES.md) only when a supported human task
  or boundary changes; keep plans labeled as plans. Use
  [PROJECT_TRACKS.md](PROJECT_TRACKS.md) for roadmap placement.
- Maintain project requirements, work items and asset burndown as durable
  project data when implemented. Never make chat history the only source of
  assignment context or turn illustrative variants into actual accepted assets.
- Preserve owner decisions and unresolved intake choices from
  [#142](https://github.com/jmbjr/rpgtk_godot/issues/142). Generic workflow
  infrastructure can proceed while creative scope remains open. Original
  private archives, assets, source and DLLs require separate publication
  authorization; this workflow grants none.


## Studio records and director projection

[Studio director](../planning/index.html) opens revision-pinned project/studio/scenario records and derives readiness without embedding a second dataset. [STUDIO_PLANNING.md](STUDIO_PLANNING.md) owns that contract; [the reconciled project](../projects/bstw-demo/README.md) owns its manifest and source intake. The recovered A01–A06 launch bundle and authoring C02–C12 are preserved alongside the later tile refinement. Local planning, assumption export/import and evidence counts do not implement shared W05/W06 review/build services or establish actual game fulfillment.

