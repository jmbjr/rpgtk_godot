# Complete understandable journeys: usability Sprint 3

## Baseline recorded before interface edits

Fetched main `ff0f2fb288c05e27b1911920d0f7b9a9d79c99f6` (#138 merged).
The existing selected-asset worktree was clean; historical branches/worktrees
were inspected before creating `usability-complete-journeys`. No open PR existed.
Read CAPABILITIES, PROJECT_TRACKS, first-use, selected-asset and #2/#37/#123
with comments. No repository AGENTS.md was present.

Independently verified [main Actions 45011045812](https://github.com/jmbjr/rpgtk_godot/actions/runs/45011045812):
checks and Pages deployment succeeded. Its deploy log identifies `ff0f2fb`.
Fresh HTTP reads of index.html/app.mjs/style.css matched main byte-for-byte;
Last-Modified was November 22, 2026, 10:12 UTC.

The implementer's cloud Chrome walkthrough opened the TK2 example; followed
room.brd → lab.tst tile 3 → incoming board use; retraced browser Back/Forward;
triggered WAV playback/reset; found technical/export controls and downloaded
connected JSON. It opened the TK3 title example, ran normal Play through the
source title choice and wait, returned to the inspector, inspected a missing
Run reference, and compared direct diagnostics.

That browser initially mixed cached pre-Sprint-2 JS/CSS with refreshed HTML:
identity stayed “Selection” and old duplicate connection lists appeared.
Do not attribute the mixed-client layout to current source. Fresh-context
production/staged checks are separate evidence. The execution environment temporarily became unavailable; local edits were
reconstructed against main through GitHub, then reconciled with a preserved local
recovery copy when the environment returned. Local non-browser checks and Actions
provide executable evidence. Local Chromium cannot launch because workspace Unix
sockets are restricted; browser results are CI evidence.

## Observed friction and decisions

| Friction observed or corroborated in current source | Improvement |
| --- | --- |
| A deployment can appear old or mixed; the cached live tab and fresh HTTP bytes disagreed | Fingerprint first-party entry/chunks/styles; show the source revision. Cached HTML may still describe an older build, but its assets remain coherent. Pinned vendor/media paths remain stable. |
| Archive actions/export are above the workspace; section controls disappear during scrolling | Compact sticky selection context, bounded Back/Forward, Archive actions and an export shortcut from Technical details |
| A linked file can be hidden in a rebuilt 103-file list | Reveal selected rows within their own list without moving the document |
| Global connection filters carry into unrelated files/tiles | Start a changed file/tile unfiltered; source-line-only jumps retain the current filter |
| Relationship evidence is inserted below a long lane without focus/reveal | Focus and reveal the evidence; offer a return to the connection list |
| The audio shortcut opens a sound without a PRG caller | Prefer audio with a typed indexed PRG/source-line consumer; the public TK2 example now authors a reachable WAV call and clearly labeled, unexecuted missing/computed examples after End |
| Normal title choices are called a conversation with no Next button | Derive instructions from cursor choice/wait/running/exit state; show the authored screen before movement controls |
| Player positions/globals compete with game content | Move position/entity/global records into the existing runtime/placement evidence disclosure; retain live task source/owner controls and errors visibly |

A board shortcut uses the configured opening-board binding when previewable,
otherwise a supported typed BRD. Audio priority uses typed graph edges, not
filenames or source-pattern recognition. Existing runtime/resolver/record/export
semantics remain shared. No game-specific decision or new runtime command is added.
Simulated encounter outcomes stay explicitly labeled as compatibility tests.

Owner feedback available here is the request to reduce complexity and explain
capabilities, plus earlier confusion about apparently unchanged builds.
There is **no newcomer study or Sprint 3 owner acceptance**. Implementer
walkthrough, synthetic CI, private-ZIP execution, merge, deployment and human
acceptance are separate evidence categories.

## Verification

Required repository/format/archive/runtime/history/connection/PDF checks and the
existing Explorer, first-use and selected-asset staged suites remain enabled.
The complete-journey check records exact head/baseline, input bytes/SHA-256,
Chromium version, desktop/mobile viewports, before/after screenshots and results.
It uses normal example/open/upload/Play paths and downloaded connected JSON.
Evidence and any limitations are maintained in the review PR; human acceptance
and deployment of this change are pending.

## One short owner checklist after owner merge and deployment

1. Record the footer build. Open the art/audio example: board → numbered tile →
   Used by → Back/Forward, then sound → caller/source line → return.
2. Inspect missing/computed evidence, follow its source, find Technical details,
   and export the whole archive's connected JSON.
3. Try the title example with normal Play, then direct diagnostics. Repeat the
   navigation with keyboard and a phone; record remaining confusion and browser.


## Reproduce and interpret the evidence

Run the normal Pages workflow. After copying/building staged inputs, it runs:

```
node scripts/stage-viewer-build.mjs site
node scripts/check-staged-site.mjs site
node scripts/check-tk3-browser.mjs site
node scripts/check-first-use-browser.mjs site dist/first-use-review
node scripts/check-selected-asset-browser.mjs site dist/selected-asset-review
node scripts/check-complete-journeys-browser.mjs site dist/complete-journeys-review
```

The last suite opens both normal chooser examples at 1365×960 and 390×844,
uses actual WAV/GS MIDI controls, downloaded JSON facts, exact source/tile
links and native/in-page history, then investigates explicit missing/computed
references and exports from Technical details. Normal title/choice/wait and
direct diagnostics are compared with input scope stated. Stale unversioned
app/style routes are deliberately retained: the fingerprinted entry and chunks
must still load the current interface. The build manifest records review and
integration revisions. Existing generic player/media/title/canvas/entry/task/
movement/encounter, zero-game-specific staged auditing and PDF checks stay on.

Matched screenshots serve exact baseline HTML/CSS/app/history/player-presentation
sources against the same staged synthetic inputs. The public examples' source
fixtures have also improved; the fresh production observation records original
Pages bytes separately. Do not treat a screenshot comparison as proof that the
baseline published archive already contained the new inspection examples.

The artifact includes exact ZIPs, SHA-256, byte lengths, source/build revisions,
Chromium version, viewports, screenshots and results. A fresh browser also samples
public Pages and records asset hashes/coherence independently; it is neither
owner acceptance nor deployment of this PR. Public observation failures are
recorded separately from the required staged assertions. No private archive,
private source, native executable or DLL was supplied/run/published.
