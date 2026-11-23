# Understand a board's evidenced dependencies

Baseline: main `cd1ecbebcc83262eaf5784d70e8e6a718db9e30b` (#139 merged).
Fetched main after inspecting the clean prior worktree, branches and worktrees;
no repository AGENTS.md was present. Read #37/#123 and comments, capability/track
and first-use/selected-asset/complete-journey notes before implementation.
Main [Actions 45085632842](https://github.com/jmbjr/rpgtk_godot/actions/runs/45085632842)
passed check and deploy. Deployment logs identify cd1ecbe; the implementer's live
rendered walkthrough showed Build cd1ecbeb and opened the TK2 example normally.

## Observed task gap and design

The live board Connections section shows direct incoming/outgoing neighbors.
Opening one replaces the current selection. It provides useful exact evidence
but no retained board-rooted multi-hop outline. The existing selection toolbar
and evidence styling offer a coherent place for a compact investigation.

Select a BRD and choose **Investigate dependencies**. One bounded outline appears
before direct Connections, with its root board pinned. Each route shows hop,
owner, target/value, first field/source evidence and reference count. Expand or
collapse without changing the selected inspector, browser history or media.
Select Evidence to examine a single route in the adjacent evidence area. Opening
source/target/candidate uses ordinary exact inspector navigation. The toolbar's
**Board dependencies** returns focus to the retained trail. **Return to board**
is an ordinary selection stop; Back/Forward retains exact tile/line stops.
Close returns focus to the selected asset. New archives/graph rebuilds clear it.
There is no new outer accordion, graph editor or separate resolver.

The model consumes `connectionNeighbors` over the same outgoing edges used by
`artifactRecord`/connected JSON, retaining original edges and `artifactId` values.
No incoming uses or unresolved candidates become dependencies. Exact field,
owner/slot/position, source/argument/line and tile-pointer facts stay available.
Non-source owner-field actions open the owner's Technical details; the exact
recorded field remains in the pinned evidence area. Source actions focus the
exact line, including an inline owner slot when recorded. Target tile actions
retain the exact tile number. Candidate inspection does not bind or expand it.

Cycles are ancestor-path returns and stop expansion. Shared assets are repeated
file identities in the visible outline; each occurrence keeps its own route and
evidence and may expand independently. Changing visible branches can change
which occurrence is first. Neither label implies execution or necessity.

## Explicit limits

- 120 visible relationship groups, six hops, eight groups per paging action.
  Collapse branches to release view space. Hidden group counts remain visible;
  a depth/view limit points to the asset inspector's direct Connections.
- Initially 12 evidence occurrences; show more up to 60 per group. Counts show
  the remainder and direct the person to the owner's existing Connections.
- At most 12 candidates and 12 other-project candidates per evidence occurrence;
  hidden results are disclosed. No candidate is selected automatically.
- Only indexed outgoing archive fields/static references are traversed. A leaf
  means no indexed outgoing references, not no runtime dependencies. Unknown
  formats retain ordinary support explanations. This is not runtime reachability,
  a minimal required-file set, an export closure or an execution-order graph.
- Browser history records inspector selections, not every expand/collapse action.
  The trail lives in memory for the active archive; reload does not restore it.

Editing, rewriting, cross-game merging, selected-subgraph export and playable
project generation remain separate milestones. Game identity, names and source
patterns do not select behavior. No format/runtime capability is added.

## Verification and evidence boundaries

The normal Pages workflow runs the existing regressions and:

```
node scripts/check-dependency-investigation.mjs
node scripts/check-board-dependencies-browser.mjs site dist/board-dependencies-review
```

Model tests cover original shared edge identity, connected-JSON agreement, cycles,
repeated routes/tiles, unresolved leaves, collapse, pagination and 120-row/six-hop
bounds. Staged Chromium uploads independently structured TK2 historical/nested
and TK3 native/flat archives with authored source probes. Cases contain cycles,
shared audio, repeated source references, missing/ambiguous/computed values,
paged fanout and a chain beyond the hop limit. They are inspection cases, not
claims that these artificial programs run. Existing player/first-use/selected-
asset/complete-journey/media/GS/export/PDF and complete staged policy/import checks
remain enabled. Local Chromium launch is restricted; staged browser results are
CI evidence. The PR records the exact head/integration build, inputs/SHA-256,
Chromium, viewports, screenshots and final workflow results.

Matched before/after screenshots serve exact cd1ecbe presentation sources with
the same synthetic input bytes. Automated input, screenshot inspection and the
implementer's earlier production walkthrough are separate from owner/newcomer
acceptance. No private archive/assets/source/DLLs are supplied or published.
Merge and new deployment remain pending while this milestone is in review.

## One short owner checklist after merge/deployment

1. Record Build. Select a board → Investigate dependencies → expand a program
   and another hop. Check why each file belongs; compare cycle/shared labels.
2. Inspect missing/computed/candidate evidence; follow a source line or numbered
   tile. Use Back/Forward and Board dependencies to retrace the investigation.
3. Try keyboard and a phone, collapse/page branches, then listen/export as usual.
   Record archive/build/browser and any unclear label or hidden result.
