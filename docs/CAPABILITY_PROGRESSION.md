# Capability progression and assumption-driven feasibility

Owner direction: November 25, 2026. This is the next foundation milestone. Production implementation in #146 is on hold. The goal is to help a small studio director understand what can be pursued under explicit assumptions without manually reconnecting every requirement.

This document defines the model and acceptance contract. The first feasibility increment extends #149 with applicability, quality-profile and relative time-window evaluation; [STUDIO_PLANNING.md](STUDIO_PLANNING.md) records the implemented boundary and remaining refinement. The [illustrative records](planning/feasibility-example.json) are a design/acceptance example, not another game definition or an input accepted by the current viewer.

## Three connected models

| Model | Question it answers | Owns |
| --- | --- | --- |
| Capability progression model | What outcomes must be enabled, what must exist first, and which production routes can satisfy them? | Outcome/asset needs, capability refinements, output constraints, prerequisite gates, alternatives and conditions |
| Studio support model | Which people, tools, access and processes can support those routes, with what evidence and availability? | Declared human capabilities, willingness, bounded availability windows/capacity, tool support and process evidence |
| Director feasibility view | Under these assumptions, what applies, what can begin, what is blocked or unknown, and what could become available later? | A derived explanation over exact source revisions and an assumption set |

“Capability progression” describes dependency order and possible enabling paths. It is neither a schedule nor an execution plan. The studio model is reusable across projects. A scenario combines project and studio assumptions; neither model owns a manually maintained director dashboard.

The recovered [BSTW intake](../projects/bstw-demo/INTAKE.md) remains the source of game decisions and original IDs. A hypothetical physical-game scenario explores applicability; it does not convert the approved TK3 game, settle a physical ruleset or authorize new creative content.

## Assumptions are explicit model inputs

Each assumption needs a stable ID, owning model, value type, allowed values or bounds, baseline value/evidence, and source. A scenario records only its overrides and pins the source-model revisions. Unknown is a first-class value. A director can compare scenarios and inspect the changed assumptions.

Project assumptions can describe target medium, selected scope, representation, required artwork quality and constraints. Studio assumptions can describe who is available, when, their declared capabilities/willingness, access and tool/process support. A near-term viewing window is evaluation context. A wish to finish in a few months is an intended constraint; without effort and dependency evidence it does not establish that the project fits.

Conditions reference assumption IDs through a small declarative predicate vocabulary, initially equality, all-of, any-of and not. No executable expressions or free-text inference determine applicability. Unknown predicates remain unknown. False AND unknown is false; true OR unknown is true; otherwise uncertainty propagates. Not-unknown remains unknown.

Validate types, references and incompatible combinations before deriving a view. An unset assumption is not false. A conflicting assumption set is invalid, not a valid scenario with everything mysteriously blocked. Explain the conflict and retain the last valid view. An override never edits a baseline fact, changes an accepted artifact or silently adopts a scenario.

Conditions need provenance too. “Short game” must not automatically remove layers, animation or another capability unless a recorded rule explains that consequence. Suggested assumptions/rules remain proposals until explicitly selected.

## Keep applicability, feasibility and availability separate

| Dimension | Values to preserve | Meaning |
| --- | --- | --- |
| Applicability | applicable / not applicable / unknown | Does this need, profile, route or edge belong under this assumption set? |
| Technical route | viable / blocked / unverified | Do the relevant input, output, capability-quality and process conditions permit this production route? |
| Contributor support | available in selected window / available later / unavailable / unknown | Is there a capable, willing provider with evidenced or assumed capacity in that window? |
| Input readiness | available / missing / unverified | Do actual required inputs exist, or are they only scenario assumptions? |
| Fulfillment | no candidate / proposed / reviewed / selected, each with exact revision evidence | What has actually been produced, assessed or selected? |

A physical-only scenario can make a video execution route not applicable. That route is not a blocker and is excluded from applicable-work denominators. It remains inspectable with the exact condition that excluded it. Shared digital artwork may still apply, while a target-specific export route changes.

A missing required undo operation leaves an applicable drawing route unable to meet its selected production profile. An unavailable artist leaves staffing unsupported in the chosen window. Neither event makes the artwork irrelevant. An unknown alternative route prevents a claim that every possible route is blocked.

Use “no viable recorded route under these assumptions” rather than claiming universal impossibility. The model can reveal a genuine contradiction or prove that every recorded route fails, but it is not an oracle about all undiscovered technologies or people.

For one need, routes are OR alternatives. Within a route, required inputs, capability qualities, access, processes and a capable willing provider are AND conditions. Apply conditions before evaluating the remaining prerequisites. Do not leave an excluded prerequisite attached as a phantom blocker. If all fulfillment routes are excluded while the need still applies, report an applicable need with no applicable route.

## Outcomes, profiles and tools

Start with “produce compatible artwork,” not “build a tile editor.” The desired result and editable-source requirements determine which capabilities are required. Tool development is one possible enabling route; a verified existing external tool/process may supply another.

Keep these concepts distinct:

- A capability states an observable ability.
- A profile states the constraints and quality needed for a particular use.
- An implementation route identifies the people, tools, inputs and process that can supply it.
- A tool feature is evidence for one part of a route/profile.
- An asset/variant is the produced result, not proof that the studio can perform every operation.

The owner identified undo, quick color switching and layers as missing from the #146 editing experience. Record them as concrete candidate production-quality requirements, with observable acceptance, rather than saying that a basic pencil proves a usable production workflow. Undo must restore edited content; quick color switching must support repeated work without cumbersome re-entry; layer requirements include retaining independently editable content through save/reopen. Exact history depth, palette interaction, layer operations and source format still need bounded acceptance detail.

These needs are recorded owner feedback. Their applicability to a selected profile is explicit: a basic diagnostic pixel round trip can have a smaller profile; a production artwork workflow can require undo, palette and layers. Existing/imported finished artwork need not be recreated in the web editor. Do not silently make every quality mandatory for every asset or silently downgrade a production profile to fit the available tool.

Keep C01’s original tile meaning and C13–C17’s separate boundaries. A proposed general artwork capability/profile must have its own qualified identity and mappings; it must not rename C01 or turn every brush gesture into a new organizational capability. Existing qualified player/authoring identities remain distinct.

TK3’s 32×32 tile constraint is not a universal physical-card art specification. Print dimensions, resolution, editable sources and output compatibility need their own selected constraints. No physical game is complete merely because a digital-art route remains viable.

## Availability windows and progression are not scheduling

Record relative or dated availability windows with their capacity meaning. A relative window needs an explicit origin if mapped to calendar dates. Keep “declared/observed availability” separate from “assumed availability.” Hours without a window do not establish when the person can contribute.

For a selected horizon, report which routes have provider support now, later or unknown, and identify those people. Do not automatically divide a capacity budget uniformly over days or assign it to every capability. Partial window overlap does not establish available hours unless the record supplies that information. A person must remain one resource across all projects/routes.

Known future availability can explain a later opportunity without assigning a start date. Starting within a window does not prove finishing within it. Completion projections need estimates, contention, ordering and allocation evidence; no schedule optimizer is part of this milestone.

Distinguish two technical questions: can a route operate with inputs/support currently available, and is there a recorded enabling path that could establish missing support? Tool development can be one such path. Report the unmet prerequisites and candidate enabling work without treating proposed future outputs as available, auto-chaining them into a timebox, or assuming that a cyclic path bootstraps itself.

## Granularity that a small studio can maintain

Keep a stable graph underneath several levels of display: player outcome → deliverable/asset need → required capability/profile → relevant production routes → distinct blockers/quality requirements. Group the view by meaningful outcomes, while allowing drill-down without changing identities.

Refine when a detail changes applicability, introduces a distinct prerequisite, needs a different contributor/tool, or needs separate acceptance. Undo or editable layers may change a route’s viability and deserve explicit quality checks. Every pixel, gesture or arbitrary task decomposition does not need a new top-level record.

High-level capability labels are navigation aids, not completeness claims. Retain unexplored refinements, unverified support and missing acceptance detail. The director should see a precise modeling gap without needing to invent hundreds of tasks or become the graph’s manual connection manager.

## Durable logical record contract

The field names in the example are proposed; preserve these relationships during implementation.

| Record | Minimum durable information |
| --- | --- |
| Assumption definition | ID, owner, type/domain, baseline/unknown, source and whether it is fact, decision or hypothesis |
| Scenario | Exact project/studio/capability revisions, project overrides, studio overrides, viewing horizon and evidence for assumptions |
| Need/capability | Stable qualified ID, outcome, source, applicability predicate, refinement links and completeness/unknowns |
| Profile | ID/revision, capability/output context, required qualities/constraints and observable acceptance |
| Production route | Fulfilled need/profile, applicability, required inputs, tools/processes and contributor requirements |
| Dependency gate | Stable identity, all-of/any-of members, applicability and reason/source for each edge |
| Work / enabling work | Stable ID, linked need/profile, prerequisites, produced artifacts or candidate support changes, acceptance and explicit unknown effort; no automatic assignment |
| Support claim | Provider/tool/process, exact capability/profile/quality, supported/partial/missing/unverified state and evidence |
| Availability claim | Person, willingness, window, capacity meaning, capabilities and evidence/assumption provenance |
| Derived result | Source fingerprints, evaluator version, assumption IDs, relevant graph, witness routes, blockers/unknowns and excluded explanations |

Scenario assumptions, accepted facts and produced artifacts must not be blended into the same boolean. Preserve unknowns and validate stable references. Existing project schemas and saved scenarios require explicit versioned migration before adopting new fields.

## First implementation: assumption-driven feasibility

The first bounded implementation is `planning/feasibility.mjs`, linked through the same manifest and director. Its record contract, migration and limits are in [STUDIO_PLANNING.md](STUDIO_PLANNING.md). The acceptance cases below now have evaluator/browser checks; they are not a claim that every capability has been decomposed. #146 remains paused.

1. Open the existing project/studio records and expose the applicable project/studio assumptions without changing the recovered owner baseline.
2. Change a hypothetical target from digital TK3 to physical-only. Explain why video execution/GAM routes leave the active graph, retain shared artwork capability where justified, and identify the missing physical adaptation/output requirements.
3. Select a production artwork profile. Show exactly how missing undo/color/layer support changes a route from sufficient for a basic diagnostic to insufficient for production. Keep verified external routes available as alternatives; keep unverified routes unverified.
4. Withdraw a provider or move their declared/assumed availability into a later window. Change the current/later support view while retaining the technical need. Expose shared capacity and unknown effort; make no schedule.
5. Change an assumption that affects an AND/OR dependency edge. Update the dependent results, including any now-inapplicable prerequisite, and show the source condition/reason.
6. Inspect everything excluded from the active view. Unknown applicability remains visible and cannot disappear as false. A contradictory scenario yields a specific validation explanation.
7. Export/reopen the same assumption set and reproduce the same result and explanations from exact record revisions and evaluator version. Hypothetical changes create no completed assets, accepted variants or resource commitments.

Use synthetic fixtures for conditional evaluation tests and the recovered intake for continuity. Do not invent physical rules, game artwork, family staffing, deadlines or commitments. Reuse #149’s loading, identity, route and persistence machinery; document migration and actual support before reporting these new capabilities as implemented.

## Remaining refinement and ownership

The implemented slice preserves #149’s intake/review identities and adds typed target/profile conditions, independent technical/provider support, inspectable exclusions, conditional inputs/gates and one relative capacity offer per person. Quality refinement is currently mapped to C01 drawing routes. Other authoring/gameplay capabilities remain coarse; physical adaptation/output remains undefined; production-profile acceptance remains incomplete. The general artwork question explicitly retains these gaps. Multiple availability offers, dated origins, effort/allocation and cross-project resource accounting remain future work. No duration or deadline rule is inferred.

This document owns the next logical model and acceptance. [STUDIO_PLANNING.md](STUDIO_PLANNING.md) owns the currently implemented record/evaluator contract. [AUTHORING_CAPABILITIES.md](AUTHORING_CAPABILITIES.md) owns C capabilities and production alternatives. [AUTHORING_WORKFLOW.md](AUTHORING_WORKFLOW.md) owns W workflow, variants/reviews/build relationships and the paused production handoff. [PROJECT_TRACKS.md](PROJECT_TRACKS.md) records priority.

#146 remains retained WIP, explicitly paused pending this foundation. Neither its rebase/integration nor adding editor features is the next automatic action. The original intake remains recovered; this milestone does not ask the owner to repeat it.

