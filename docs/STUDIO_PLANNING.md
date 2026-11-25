# Studio records and derived director view

The director view is a deterministic projection of saved records. Open [Studio director](../planning/index.html), choose a project, and inspect its needs under the selected studio scenario. The [project index](planning/index.json) locates the manifest. No prior chat or manually composed dashboard is needed to recover project scope.

The first project is the [Bruce demo](../projects/bstw-demo/README.md), now reconciled with the recovered original intake. Its launch bundle is A01–A06; the original authoring graph C02–C12 is restored. The [source narrative](../projects/bstw-demo/INTAKE.md) distinguishes direct owner decisions, a reviewed starting draft, assistant proposals and deferred details. This feature creates no game artwork or creative decisions.

## Record ownership

| Record | Owns | Does not establish |
| --- | --- | --- |
| Project manifest | Stable entry point; relative paths and exact identities/revisions/digests | Availability, acceptance or an adopted execution plan |
| Project | Player outcomes, asset needs, bounded work, input producer links, milestones and open decisions | Actual people’s willingness or tool verification |
| Studio | People/tools, processes, values, declarations, access and per-capability support | Project scope, completed work or automatic team assignments |
| Scenario | Exact baseline references, explicit assumptions and timebox; viewed/adopted/scheduled identities | New baseline facts, verified output or capacity allocation |
| Capability ledger | Qualified stable identities, historical graph and production-route alternatives | That every historical proposed edge is mandatory on every route |
| Intake | Evidence and decision authority | Current support, execution, final art or exact deployed owner acceptance |
| Derived snapshot | Input fingerprints, scenario assumptions, evaluator version and computed results | Another editable source of requirements or completion |

Projects may share a studio. To compare another studio, load a manifest that pins that studio and matching scenario records; never overwrite one studio’s identity to make a comparison. The viewer can open any same-origin manifest supplied by the project picker or `?project=` URL. No shared account/backend or permission service is claimed.

## Derivation contract

`readPlan` loads the manifest and five linked JSON records with cache revalidation, checks SHA-256 identities and exact revision references, and validates links. `snapshot` then evaluates one scenario with version `rpgtk-director/0.2.0`. Neither mutates the baseline. The same exact records, scenario and evaluator produce the same snapshot; no clock, random choice, model-generated conclusions or schedule optimizer participates.

Routes are OR alternatives; input, access, tool-capability, process and contributor requirements within a route are AND conditions. Every missing and unknown condition is retained. A capable person must also be willing and have positive known hours. Tool access and capability support are separate: partial/unverified support cannot pass as verified. An incomplete roster means absent declared skill is unknown rather than proof of impossibility. An explicitly complete roster may establish that a required contributor is missing.

A route with a known missing condition is blocked, otherwise unknown conditions make it unverified, otherwise it is startable. One startable route enables work even if another route is blocked. Declined work or zero hours cannot supply a route. Eligibility is a snapshot property, separate from assignment, effort, schedule, completion, review or build selection. Shared people are counted once and contention is flagged; their hours are not assigned to every task.

Input assumptions can allow planning but never produce game files or accept assets. Producer work links explain where missing inputs could come from. No same-sprint output bootstrapping occurs. Synthetic fixtures allow editor development independently of final game art. Enabling tool development does not verify the resulting tool.

The default view shows milestones, grouped asset needs, scenario comparisons and startable work. Expand needs for exact requirement revisions, briefs, acceptance, AND inputs, tool/contributor conditions and upstream producer work. Capability identities and source fingerprints remain inspectable. Task counts are inventory, not percent complete. Unspecified creative details stay open without invalidating recorded geography or the launch bundle.

## Exact revision evidence

Current project arrays contain no variants, reviews or selected builds. The director reads minimal explicit metadata without implementing W05/W06 services:

- Variant: `id`, positive `revision`, `requirement: {id, revision}`, and 64-character SHA-256 `contentHash`.
- Review: `variantRef: {id, revision, contentHash}`, the exact `requirement`, `reviewer`, `evidence`, `decision`, `target`, and `scope`.
- Selection: build `bindings`, each with exact `requirement` and `variantRef`.

The view counts a whole-requirement accepted revision only for an exact `accepted` review with `target: tk3` and `scope: whole-requirement`. A partial tile’s review cannot accept a tileset. Proposed revisions, accepted revisions and selected uses are displayed separately. These counts do not validate the whole game’s runtime, provenance, compatibility, dependency closure or owner acceptance. General review/build services remain owned by [AUTHORING_WORKFLOW.md](AUTHORING_WORKFLOW.md).

Changing a requirement prevents its old reviews being counted for the new revision. Review and selected-use content hashes must match the exact variant. Multiple scenario assumptions never mutate these records. Baseline available inputs need evidence or a binding; users must record actual production/verification before adopting them as facts.

## Persistence and validation

Scenario edits are in memory until downloaded. Export includes exact baseline refs, scenario revisions and separate viewed/adopted/scheduled state. Reopen/load restores the same assumptions. Invalid imports are rejected before replacing current state. Revision-1 exports require explicit reconciliation with revision 2; the UI does not rebase them automatically.

Validation rejects unknown references, duplicate identities, mismatched revisions/hashes, invalid hours/support values, ambiguous capability namespaces, mandatory asset dependency cycles and the studio size limit. There is no fallback that renders stale embedded data after a failed load. Source project data remains inert JSON, while the viewer/evaluator are generic browser modules.

`projects/bstw-demo/verify-plan.mjs` checks recovered identity and launch boundaries, five scenarios, OR/AND behavior, multiple blockers, willingness/capacity, access versus support, contention, no output chaining, partial/stale reviews, invalid data, file digests and deterministic reload. `scripts/check-studio-browser.mjs` exercises normal entry, assumptions, export/import, text escaping, record reloading and narrow layout. CI stages linked records and reruns checks on the staged site. Deployment and actual owner game acceptance remain separate.

Next: the owner chooses one bounded cave brief and records actual studio declarations/availability; no new intake is needed. Keep the manifest, supporting docs and capability mappings aligned whenever scope/support changes.
