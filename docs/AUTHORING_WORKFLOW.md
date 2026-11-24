# Project authoring: requirements, work and asset variants

## Direction and implementation status

Owner direction recorded November 23, 2026: connect a project, discover the
assets it needs, filter the work by what a contributor can do, open a bounded
assignment, and save the result as a proposed implementation variant. A later
review can accept that variant, provisionally accept it, or request changes.
A particular build selects exact compatible variants to fulfill its needs.

The local tile authoring workspace implements C01 and bounded paths through
W01–W04 and W07. It opens a local manifest, filters tile work on declared
skills and tools, launches the web pencil from a brief, and persists proposals
and their artwork in a project download. W05 review and W06 build selection
remain planned. See [current starting actions](#start-a-local-tile-assignment).

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

## Workflow capabilities

W01–W07 are stable workflow IDs. The local tile path covers the subset shown
below. See the [capability graph](AUTHORING_CAPABILITIES.md) for C01 and C13–C17.

| ID | Capability and observable result | Local tile implementation | Later alternatives |
| --- | --- | --- | --- |
| W01 | Connect a project and see its required assets, existing candidates, unmet needs and dependency context | Partial: open a versioned manifest and see its requirements, work and proposals. Archive linking remains planned. | Repository or service adapter supplying the same project records |
| W02 | Find work suited to the contributor's skills, known tools and selected readiness filters | Partial: filter by declared skill/tool fit for the web pencil. Readiness is shown independently. | Shared profiles or richer recommendations with explained matches |
| W03 | Open a bounded assignment in an appropriate authoring route with the requirement already attached | Implemented for the web pencil: launch from the linked brief | External-tool instructions and import return path using the same assignment context |
| W04 | Save or import an attributed proposed variant revision against the assignment | Implemented for the web pencil: save attributed proposals and embedded GPH in the manifest | Repository-backed submissions or shared artifact storage |
| W05 | Review an exact submission against the requirement and retain the decision and evidence | Planned: exact-revision review with reviewer, scope and provisional conditions | Collaborative review UI; permission enforcement when shared accounts are implemented |
| W06 | Select compatible exact variant revisions for a build and identify gaps or conflicts | Planned: build target and explicit requirement-to-revision bindings | Target-specific build adapters using the same selections |
| W07 | Reopen the project and retrace a need, its work, submissions, reviews and selected uses | Partial: reopen the manifest and retrace briefs, contributors, proposals and exact tile revisions | Query/export over the same relationships |

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

The work brief should show the immediate deliverable, format/dimensions,
constraints, references and acceptance criteria. Board, level and game context
stays linked and can be expanded when useful. Do not require an artist to
understand the entire game's story or dependency graph to draw a floor tile.

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

## Start a local tile assignment

1. Choose **Author a project tile** from the Explorer home page. Open a
   version 1 JSON manifest. Use the
   [synthetic project sample](specs/fixtures/synthetic-tile-project.json) to
   try the workflow or as a starting shape for your own manifest.
2. Enter a contributor ID and display name. Declare comma-separated skills
   and tools, then choose **Apply contributor**. The sample matches
   `diagnostic drawing` and `web pencil`. Turn off **Show suitable work only**
   to inspect unmatched assignments and their separate readiness.
3. Open the brief and choose **Draw a new tile**. Name the variant, pick a
   color and draw. With the pencil focused, arrow keys move the cursor and
   Space paints. Both enlarged and actual-size previews update as you draw.
4. Choose **Save proposed variant and download project**. Open the downloaded
   JSON in a fresh session, return to the brief and open a saved revision.
   Saving from a revision adds a new revision with that revision as its base.
   **Draw a new tile** starts an independent proposal for the same assignment.

### Local manifest and artwork

The sample defines the version 1 fields. IDs are scoped to the project, and
work items refer to exact asset requirement IDs and revisions. Each asset
requirement links to its project requirement. Each variant retains the work
item, requirement revision and route. Each revision retains the contributor
snapshot, creation time, tool, proposed status, source/output roles and the
embedded artwork. The contributor profile is self-declared.

Use lowercase skill/tool tags in manifests. `web-pencil` identifies the
implemented route. Other route IDs can be recorded with unverified web support.
Use `ready`, `missing`, or `unverified` for readiness. Save and reopen keep
extra project data such as source notes. The editor operates on the downloaded
manifest, so simultaneous edits to separate copies require manual reconciliation.

The [standalone GPH format](specs/gph.md) serves as both the editable source and
Toolkit-format tile output for this slice. Version 1 embeds the full GPH as text
inside the manifest. It uses mode 1, raw opaque COLORREF pixels and column-major
order. The existing decoder reads it on reopen. A broken assignment or missing
embedded artwork is reported when opening a project. The workspace keeps archive
inspection independent.

## Next implementation handoff

Verify the local C01 round trip with the check below. The next gap on the
initial A01 draw route is C15, assembling usable tiles into numbered slots.
A bounded follow-on can evaluate choosing exact saved tile revisions for a
draft tileset while retaining their slot mappings and partial-contribution
links. C16 export, C13 import, C14 open-for-editing, C17 transparency, W05
review and W06 build selection remain planned. Owner creative decisions stay
in the intake.

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

The Pages workflow runs `node scripts/check-tile-authoring-browser.mjs site`
after staging the viewer and generating the synthetic Toolkit 2 archive. The
check exercises the steps above through the home-page entry point, downloads
the actual manifest, and tests invalid artwork recovery.

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
