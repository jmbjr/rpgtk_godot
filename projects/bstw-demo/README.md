# Bruce demo: project and studio planning baseline

Open **director-view.html** in a browser to inspect the whole plan, compare five scenarios, expand route blockers, and change assumptions about people, tools and inputs. It is self-contained and works offline. Save scenario edits with **Download planning scenarios**; reopening the HTML starts from the bundled baseline, and **Load scenarios JSON** restores an exported scenario file.

This is the first portable planning baseline for a one-to-five-person studio. It is a draft planning aid, separate from the shipped Explorer. It contains no game artwork, private archive content, dialogue, source or DLLs.

## The game we can currently describe

The owner confirmed: **start on an island → climb a cliff → discover the bridge is out → go into town → explore clues and mysteries**. The demo needs a chosen ending, which remains open. Board count, tile count, character count, playtime, workload and sprint duration are unknown. A route region is not necessarily its own board file.

The full original intake was not available in this conversation or found in current main. This baseline must be reconciled with that intake when available. It retains **A01** as cave terrain, with the cave's place in this route unresolved. It preserves the mentioned **A02** and **A05** identities with their incomplete definitions. New candidate needs have `BSTW-` IDs; unavailable A03/A04 definitions are not invented. Cave, optional audio and other open systems remain visible even when production work is not released.

## Files and ownership

| File | Owns |
| --- | --- |
| bstw.project.json | Game outcomes, candidate asset scope, capability vocabulary, work briefs, dependency inputs, open decisions and source evidence |
| bstw.studio.json | Reusable organizational plan: people and tools as resources, processes and values; declared capabilities and unknown capacity |
| bstw.scenarios.json | Five revision-pinned what-if plans with resource/input overrides; no adopted scenario or sprint commitments |
| director-view.html | Standalone view of the bundled baseline; editable scenario assumptions and side-by-side comparison |
| planner.mjs | The small, deterministic route-readiness evaluator used by the view |
| verify-plan.mjs | Reproducible data and scenario checks; run with Node 22 or later |

The project points to a studio by stable ID, revision and relative path. A studio can support multiple projects. A scenario pins exact project and studio revisions and is valid only for those records and assumptions. To consider another studio, retain its distinct identity/revision rather than overwriting the current studio's evidence. This first viewer edits assumptions on the bundled studio; cross-studio loading is future work.

Contributor **capabilities** describe meaningful contributions such as terrain artwork, board layout and software development. Tool capabilities describe production tasks such as C01 drawing or C15 tileset assembly. Existing C/W IDs keep their meanings; new vocabulary is explicitly local to this draft. No capability for “knowing how to use every tool” is introduced. Legacy `skills` fields mirror capability IDs only for compatibility with the proposed #146 version 1 manifest.

## Five options to compare

| Scenario | Explicit assumptions | Work that could begin |
| --- | --- | --- |
| S0 — Recorded baseline | Only the recorded director role; capacity unknown; main's existing tools | None confirmed; the director's willingness/capacity still need recording |
| S1 — Artist available | Hypothetical artist, 4 hours; pencil usable; initial island brief available | An initial island tile contribution |
| S2 — Artist unavailable | Hypothetical artist declines; developer, 6 hours; source editing available | A board editor prototype **or** tileset assembly/export development; these compete for the same hours |
| S3 — Parallel work | Both hypothetical people; source editor/pencil usable; island brief available | Island artwork and tool development, with developer capacity contention disclosed |
| S4 — External route | Hypothetical native Toolkit board contributor, 4 hours; usable native setup; island layout and tileset available | Island board layout through the external route |

All invented people, hours and ready-tool/input claims in S1–S4 are **scenario assumptions**, not actual team assignments, completed work, verified tool support or promises. No scenario is ranked as best without estimates, priorities and confirmed willingness. `viewedScenarioId` records interface focus; `adoptedScenarioId` and all `scheduledWork` lists remain empty.

## How readiness works

Routes are alternatives (**OR**); the inputs, tool capabilities, process requirements and capable willing person within one route are jointly required (**AND**). Expose every blocker on every route. Missing game tiles must not block development of an editor that can use synthetic inputs.

A route is **startable** when its required inputs and tools are available and at least one appropriately capable person is willing and has positive known hours. It is **blocked** when a required condition is known to be missing/unavailable. It is **unverified** when relevant facts are unknown without a known blocker on that route. An unknown alternate route is not silently accepted.

Human capability, tool support, input readiness, effort, review and selection are separate facts. Completing one tile does not satisfy the island tileset. Startable work does not imply that it fits or finishes in a sprint. Eligible tasks sharing a person are flagged; the evaluator does not allocate that person's hours or produce a committed schedule. Source-editor access and external editor access are unverified in the baseline. Tool development outputs must be exercised before they count as new studio capability.

Dependencies are recorded as stable input IDs per route, with producer work links in `producesInputIds`. They represent necessary inputs for the bounded assignment, not exhaustive runtime reachability. Outputs are never made available automatically. This prevents optimistic same-sprint chaining or circular assumptions. Manual records may later bind an available input to exact variant revisions and acceptance evidence.

## Scale, processes and creative control

The default director view groups the route and asset/support needs. Expand to bounded work only for assignment, a distinct blocker, or separate acceptance. Keep the same underlying IDs as detail changes. The present inventory of 14 candidate asset/support records and 18 work items is neither an approved scope count nor a completion percentage; optional/open needs and studio enablement are included.

The studio's initial values are human creative control, human artwork, willingness, honest unknowns, small-team simplicity and keeping originals private. Its production process is brief → contribution → exact-revision review → explicit build selection → normal Play verification. Review/build services are still planned. The plan creates no accepted artwork, build selections or authenticated identities.

## Current implementation and compatibility

Checked November 24, 2026 against main `2c7128746f748bb0aa0459c36675a2e190a26f16`. #148's discovery requirements are merged. #146 is **open**, head `7fb36fe71cdbec87558204b36065b6927f7c243c`. Main has inspection/limited Play; tile drawing is not claimed shipped. Tool access overrides in scenarios do not change this evidence.

`bstw.project.json` passes the exact proposed #146 `readProject` structural checks with no artwork/variants supplied. It can serve as that tile workspace's project input when that implementation is available. The tile workspace reads its narrower version 1 fields and ignores the richer studio/scenario data. It does not become a director dashboard by loading this file. The standalone view supports the planning fields.

Validation passed for identity links, expected outcomes of all five scenarios, multiple blockers, alternative routes, declined/unknown resources, shared capacity, scenario isolation, revision mismatch and five-person limit. The actual inline view script passed a DOM-harness check of scenario switching, withdrawal/restoration, JSON export/import, copying and text escaping. A rendered browser walkthrough/layout check was unavailable because the execution sandbox blocks Chromium sockets. No CI/deployment, owner demo execution or original Toolkit parity is claimed.

## Next useful edits

1. Reconcile the original intake, especially A02/A05 and A01's role.
2. Record actual people, declared capabilities, willingness and available hours.
3. Confirm one initial art/layout brief and its input evidence.
4. Verify an actual production route; keep #146 and external tools' status accurate.
5. Estimate and explicitly choose a bounded set of eligible work for one timebox.

There is no need to settle every creative choice before improving the studio's tools. There is also no need to decompose the whole game to pixel-level tasks before seeing its major capability and resource gaps.
