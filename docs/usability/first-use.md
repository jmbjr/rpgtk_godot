# First useful result: usability milestone 1

Baseline: main `7265632fd80b12add39725e2fd94e2054f94c58f` (#136).
The implementer inspected the rendered Pages landing page before editing. It
identified itself as a Toolkit 2 source viewer, presented 17 equally prominent
regression downloads, and mixed archive input, optional GAM/URL inputs and
native Toolkit instructions. A new visitor had to infer the result of each lab.

## Material design decisions

- Keep the existing static site, visual language and generic archive/runtime
  paths. Product identity now covers Toolkit 2/3 artwork, audio, source links and
  partial TK3 execution. Godot conversion is not presented as a current feature.
- Use one primary archive picker. URL import and separate inspection GAM remain
  under a descriptive disclosure; no extraction/native installation is required
  to explore in the browser. Native setup instructions remain with downloads.
- Offer three observable experiences: art/audio/connections, source title/choices,
  and a moving character/Talk. The chooser fetches an existing generated ZIP and
  calls the same loader as local/URL import. It does not substitute a program or
  interpret game identity. All 17 existing downloads remain individually available.
- After import, offer artwork, audio, connections and normal Play. Representative
  starting assets are selected by decoded type/status from the imported inventory;
  there is no filename, game title, quest or slot recognition. Missing task inputs
  disable only that shortcut with an explanation; the full inventory remains.
- Normal Play follows the embedded GAM. Direct diagnostics is secondary and
  explicitly bypasses startup in a fresh session, still running board entry.
  Blocked startup/scene evidence remains visible and configuration/trace/export
  details remain available in descriptive task-adjacent disclosures.
- Use native controls/disclosures and visible focus, with focus on the ready
  archive heading after import and on the inspector/connection heading after a
  task action. Preserve shared selection history, source links, playback and
  exports. The misleading “Capability graph” heading becomes “RPGCode command
  reference”; its data and command-reference behavior are unchanged.
- Failed replacement imports preserve the last imported archive/context and
  provide recovery text. Obsolete requests cannot replace a newer import.

## Verification and review evidence

Run the normal repository workflow plus:

```
git fetch --no-tags --depth=1 origin 7265632fd80b12add39725e2fd94e2054f94c58f
node scripts/check-first-use-browser.mjs site dist/first-use-review
```

The new staged browser check serves the exact baseline HTML/CSS/app and the
changed staged site with the same shared modules/fixtures. It captures matched
1365×960 before/after landing/import views and 390×844 mobile views; the complete
`first-use-review` Actions artifact includes PNGs and `results.json` with exact
head, baseline, Chromium version, fixture byte lengths/SHA-256 and observations.
The PR records required Actions results and the screenshot review.

Acceptance opens each chooser experience through the UI; previews original tile
pixels; plays/resets WAV; opens a direct neighbor, reads its field evidence and
follows it into the inspector; verifies Back/Forward and connected JSON export;
distinguishes normal title/startup from direct board entry; exercises keyboard
focus/native disclosures, touch and page-wide overflow at 390px. A failed fetch
and subsequent local import verify recovery. Existing media/GS/title/canvas/
entry/task/movement/encounter, source navigation and production-policy tests stay
enabled. These are automated synthetic checks, not a human usability study.

## Owner checklist after merge and deployment

1. Describe the product from the landing page, then use Open example with
   “Explore artwork, audio & connections · Toolkit 2.”
2. Try Browse artwork, Listen to audio and Follow connections. Read a relationship's
   evidence, open it in the inspector, then use browser Back.
3. Open the source-title or moving-character example. Compare normal Play with
   Board diagnostics; confirm the difference is clear before choosing either.
4. Try the same opening flow on a phone and using Tab/Enter. Confirm that URL/GAM
   import, all test downloads, configuration evidence and JSON export are findable
   when needed. Record any confusing labels with the exact build/input/browser.

No private archive was used or published. PR CI, main deployment and owner
acceptance remain separate evidence. This sprint does not redesign every asset
inspector, expand the graph, or add runtime/format capabilities. Those remain
in the tracks documented in `docs/PROJECT_TRACKS.md` and issues #2/#123/#37.
