# Bruce demo: project and studio plan

Open [Studio director](../../planning/index.html) from the repository or the Explorer footer. The viewer reads [project.manifest.json](project.manifest.json) and derives its results from the linked project, studio, scenario, capability and intake records. No project data or readiness conclusions are embedded in the HTML. Serve the repository over HTTP (for example `python3 -m http.server 8000`); opening an HTML file directly cannot read linked records.

The [recovered intake](INTAKE.md) and [structured intake](intake.json) preserve the original decisions and source messages. Tintagel is the selected reference. Bruce starts in Merlin’s Cave, climbs to the island road, and can turn left to the broken bridge or right to town. The bridge stays broken throughout the Demo. The owner reviewed the initial asset draft as “ok to start with.” Exact creative details remain open; this is not another intake.

## Canonical records

| File | Owns |
| --- | --- |
| project.manifest.json | Entry point; exact record IDs, revisions, relative paths and SHA-256 identities |
| bstw.project.json | Game outcomes, A01–A06 launch bundle, later needs, bounded work, input dependencies, milestones and open decisions |
| bstw.studio.json | Independent reusable studio resources, processes, values, contributor declarations, local access and per-capability support evidence |
| bstw.scenarios.json | Revision-pinned planning assumptions; viewed scenario, adoption and scheduled work remain separate |
| capabilities.json | Qualified player/contributor/authoring identities, recovered graph and later tile-supply refinement |
| intake.json / INTAKE.md | Reviewed starting draft, direct decisions, proposals, source locations and explicit deferrals |

A01 terrain and A02 four-direction sprite tiles supply A05 cave and A03 four walking animations respectively. A03 supplies A04 playable character. A04 AND A05 supply A06 Main File; package the resolved files and verify normal Play/Reset. The village, exact ending and optional startup title are not prerequisites for the first playable cave scene.

The seven ordered additions remain cliff approach, broken crossing, scrolling town, individual residents, quest, key/access and discoveries/ending. They originally had order numbers rather than further A IDs. Later planning-local identities remain distinct. A05 always identifies Merlin’s Cave; prior approach/town work now links to separate requirements. `identityReconciliation` records the corrections and the old character-definition alias to A04.

## Use and save

1. Open Studio director and inspect milestones and all needs.
2. Compare recorded baseline with explicit hypothetical studio scenarios.
3. Select a scenario, change willingness/hours, declared capabilities, tool access, tool support or input assumptions. Expand a need to see all route blockers and producer-work links.
4. Download scenario records to retain edits. Reopen the project and load that JSON to resume. Exports preserve viewed scenario independently of adoption and schedule.
5. Download the derived snapshot for exact input fingerprints, assumptions and evaluator version. This is an output, not another source of project facts.

Baseline actual roster/capacity is incomplete. Hypothetical people/hours, selected tool support and available inputs in S1–S4 are assumptions. One complete OR route makes work startable; every condition inside a route is required. Access alone does not verify support. Startable work does not establish finishability, assignment, produced inputs, accepted artwork or build fulfillment. Shared capacity is flagged, not allocated. Estimates remain unknown.

Five scenarios exercise: recorded baseline; an artist with cave brief/pencil support; artist unavailable with a developer doing synthetic tool work; both in parallel; and native cave-board work with assumed usable inputs. No output is automatically chained into the same scenario. Optional startup, deferred companion and open audio remain visible without blocking the minimum launch milestone.

## Revisions and evidence

Revision 2 explicitly reconciles draft revision 1. Old exported revision-1 scenarios are rejected with a mismatch; do not silently overwrite their references. To intentionally rebase one, review every assumption against the new requirement identities and record a new scenario revision. Updating canonical inputs requires their revisions, dependent references and manifest digests to agree.

`player:C01` and `authoring:C01` are separate original ledgers. Source C IDs remain visible. The broad original authoring C01 was refined to individual tile editing, with C15/C16 providing indexed assembly/export. The historical graph is retained as a sourced proposal; it does not make the web pencil mandatory when imported/native art can supply tiles.

Main support checkpoint remains `2c7128746f748bb0aa0459c36675a2e190a26f16`. #146 is open/draft at `7fb36fe71cdbec87558204b36065b6927f7c243c`; its pencil is not shipped main/deployment evidence. Native/external routes are candidates until their access and relevant round trips are verified. Inspector previews do not establish authoring or execution. No owner game assets, reviews, selections, private originals or DLLs are supplied.

## Verification and continuation

Run `node projects/bstw-demo/verify-plan.mjs` and `node scripts/check-studio-browser.mjs` from repository root. CI runs the same checks, stages only browser runtime plus inert records/docs, and checks every staged first-party module. The generic production-code boundary remains in force; only validated planning JSON formats may contain project names.

Next, record actual people’s declarations/availability and choose one bounded cave art/layout brief. That can happen without settling every story choice. Use the derived blockers to select meaningful work; use [AUTHORING_WORKFLOW.md](../../docs/AUTHORING_WORKFLOW.md) for exact variant/review/build semantics. Studio logic and verification contracts are documented in [STUDIO_PLANNING.md](../../docs/STUDIO_PLANNING.md).
