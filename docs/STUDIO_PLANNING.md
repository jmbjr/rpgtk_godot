# Studio-aware project planning draft

Owner direction: November 24, 2026. Start with a one-to-five-person studio and
the small Bruce demo. The [initial saved baseline](../projects/bstw-demo/README.md)
includes project, studio and scenario records plus a standalone director view.
These are draft planning records and a portable aid, not an integrated product
feature or a commitment to the reconstructed creative scope.

## Record ownership

| Record | Owns | Does not establish |
| --- | --- | --- |
| Project | Intended player outcomes, asset needs, constraints, candidate work and dependency alternatives; preferred studio reference | Who is actually available or which proposed artwork is accepted |
| Studio | Organizational plan: people and tools as resources, processes, shared values, declared capabilities and availability evidence | All projects' game design, asset scope or completion |
| Scenario | Exact project/studio revisions, timebox and explicit resource/input/design assumptions | New baseline facts or an adopted/committed execution plan |
| Execution proposal | Candidate work and all route blockers under one scenario; later explicit allocations and estimates | That every eligible task fits or finishes in a sprint |
| Variant/review/build records | The existing W04–W06 exact-revision contribution, acceptance and selected-use relationships | Fulfillment merely because planning labels or resource assumptions changed |

A project points to a separate studio by stable ID, revision and relative path.
Several projects may reference one studio. Other studios retain distinct
identities/revisions; scenario comparisons must disclose a change of studio as
an assumption rather than overwrite the original organization. The initial
viewer supports one bundled studio with scenario overrides; loading alternate
studio files is future integration work.

Use contributor **capabilities** in new interfaces and planning records. Record
human contributions such as terrain artwork or board layout and tool functions
such as C01 or C15 separately, then connect them in a production route. Do not
introduce a universal “can use tool” capability. Capability declarations help
discover work; they are not permission gates. Legacy `skills` fields in #146's
manifest remain compatibility fields, not a new organizational ontology.

## Dependencies and candidate work

Preserve existing C/W meanings. New contributor/tool vocabulary and new `BSTW-`
requirements/work IDs in the sample are explicitly local to this planning draft.
A01 remains the cave terrain need. A02/A05 are mentioned by existing repository
evidence without full definitions; mark their scope incomplete. Do not reuse
unavailable intake IDs for newly inferred needs.

A bounded work item references its exact requirement revision. Its production
routes are OR alternatives. Each route's required inputs, tool capabilities,
process support and a capable willing person with available capacity are AND
requirements. Explain every missing or unknown condition, even when another
condition already blocks the route. Native/external routes may be alternatives;
web implementation is not automatically mandatory.

The project stores input dependencies by stable ID and producer work links.
An input later needs a binding to exact produced revisions and its readiness
evidence. The initial draft has no produced game assets or bindings. A tile
contribution is not a completed tileset, and an area layout contribution is not
necessarily a whole board or an accepted map count.

Known missing inputs/tool support produce a blocked route. Unknown roster,
capability, willingness, capacity or access preserves an unverified condition.
At least one fully satisfied route makes work startable. Startable is a snapshot
property, separate from an assignment, effort estimate, schedule, completion,
review or build selection. Flag resource contention; never count one person's
hours once per capability. The five-person constraint counts unique people.

Keep tool-enablement dependencies honest. Board-editor development can begin
with synthetic tiles even when final game tiles are missing. Creating the game
board still requires its usable input art/layout and a viable authoring route.
Tool development does not automatically make the tool ready; verify its output
before recording newly available studio capability. Do not automatically chain
same-sprint outputs, bootstrap cycles or hide unsupported runtime behavior.

## Assumptions and director views

Pin scenario revisions and retain all changed assumptions. Compare eligible
work, blockers, unknowns and shared capacity side by side. Record person
willingness independently of capability; declined work removes a person from
that route for the timebox. Preserve unknown estimates and availability.
Scenarios are options, not ranked plans without the director's priorities and
actual resource data. UI focus (`viewedScenarioId`) is distinct from adoption
(`adoptedScenarioId`) and explicit `scheduledWork` commitments.

The default director view shows game outcomes, asset groups, studio support
and gaps. Expand detail when a person needs an assignment, a distinct blocker
or separate acceptance. Changing view scale must preserve underlying identities
and links. For this team size, avoid decomposing every pixel or editor gesture
into an organizational capability. Unknown board/tile/character counts remain
unknown; counts of planning records are not completion percentages.

The studio's initial values preserve human creative choices and artwork, AI
assistance with coordination/implementation/checks, willingness, honest evidence,
small-team simplicity and private-original boundaries. Processes connect briefs,
contributions, exact-revision review, explicit build selection and normal Play
verification. Record actual support separately from intended process. None of
this grants AI authority to resolve the owner's open story or accept artwork.

## Initial baseline and next integration

The full original intake was not available in this conversation or located in
main. #142 has an intake contract but no detailed comments at the checkpoint.
The baseline records the owner-confirmed island/cliff/broken-bridge/town/clue
route, preserves A01/A02/A05 boundaries, and exposes an open ending and asset
ledger reconciliation. It is partial and must be reconciled rather than treated
as proof that the intake is complete.

Main checkpoint: `2c7128746f748bb0aa0459c36675a2e190a26f16`. #148 documents
#147's discoverability requirements. #146 is still open at
`7fb36fe71cdbec87558204b36065b6927f7c243c`; its proposed local tile implementation
is not main/deployment evidence. The sample passes that exact version 1
project structural validator, but its richer planning fields are separate from
the tile editor's narrow behavior. No artwork, reviews or build selections are
supplied. The standalone director aid does not implement shared review,
authenticated accounts, allocation optimization or a studio backend.

Next: reconcile the detailed intake, record actual roster/capacity and one
bounded art/layout brief, verify a usable production route, and choose candidate
work. An integrated director workflow should later open these records, explain
all route blockers, retain exact assumptions and compare scenarios through the
normal project entry point. W05/W06 review/build semantics remain owned by
[AUTHORING_WORKFLOW.md](AUTHORING_WORKFLOW.md). C prerequisites remain owned by
[AUTHORING_CAPABILITIES.md](AUTHORING_CAPABILITIES.md).

The saved baseline README records checks and limits. The scenario/data checks
pass; view-script behavior was checked in a DOM harness. Rendered browser/layout
verification was blocked by sandbox socket restrictions. Deployment, owner game
acceptance, original private archive execution and original Toolkit parity were
not checked. The standalone aid makes no claim about those evidence classes.
