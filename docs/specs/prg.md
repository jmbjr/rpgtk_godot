# PRG · RPGCode source

Specification revision **1.1** · [conventions](README.md). Partial static
index.

A PRG is text without a file header. The viewer tries UTF-8 and falls back
to Windows-1252. It splits CRLF, LF and CR into source lines without
trimming the lines. Line numbers start at one. Token offsets in the UI
index are zero-based JavaScript string offsets.

## Index rules

1. Collect names declared by line-leading `#method`, case-insensitively.
2. Scan lines whose trimmed first character is `# { } : * @`. Skip
   double-quoted spans and stop at an unquoted asterisk.
3. Group each hash-prefixed word by lowercased name and kind. Detect
   assignments first, then declarations, local method calls, catalog
   built-ins, and unknowns. Record every occurrence, including repeated
   calls on the same line.
4. For cataloged file-taking commands, index quoted literal filenames
   with an extension. A reference keeps the source line and command.
   For Run, Include, Send, ViewBrd, Load, Save, and Start, inspect the
   first argument. Preserve expressions as dynamic evidence, and mark
   literal save, load, and host-launch resources as external. Expression
   results, computed paths, and reachability remain unknown.

## Decoded record

`data.lines` preserves source text split into lines. `data.symbols` is
an ordered array of `{ key, kind, name, value, lines }` groups. `value`
preserves the first spelling. `builtInCalls` counts built-in occurrences.
The [command catalog](../../catalog.json) supplies command names and
feature IDs.

Evidence is the Toolkit 2 RPGCode help and reference catalog, with
`Demo/Prg/start.prg` as a trace fixture. This is a source index. Program
execution and a full language grammar are outside this slice.

## Project dependency trace (static)

The viewer's **Static RPGCode dependency trace** begins with the
configured GAM startup, nonempty runtime-key programs, and other main
program fields. For the configured opening board it additionally
lists native board program slots, sprite activation/multitask programs,
and associated placed-item pickup/on-board programs. Those are
**possible configured entrypoints**, not a proposed runtime sequence.

Each entrypoint recursively follows `#Include("literal.prg")` and
`#Run("literal.prg")` references already indexed by the artifact
reader. The result preserves the exact source path, directive, source
line, traversal depth and resolution status. It counts a script only
once per entrypoint, preventing shared includes and cycles from causing
repeated/unbounded traversal. A safety cap of 500 scripts protects
untrusted archives. Case-insensitive archive reference resolution
remains authoritative; the trace does not manufacture fallback paths.

Unresolved, ambiguous, dynamic and external import references
remain **targetless evidence**, not guessed imports. Static non-import
commands such as `#Send`, image/music references and run-time plugin
calls are visible through the existing artifact graph, but aren't
treated as `#Include` dependency steps. Source code is **not
executed**; conditions, variable state, dynamically composed paths,
and whether the player will ever trigger a placed item are unknown.

The trace appears under the game's Main File inspector as individual
expandable entrypoints, and under each selected PRG as an expandable
source-line-aware import tree. Connected-game JSON exports the same
structured information in `scriptTrace` with `entries`,
`steps`, `links`, `gaps` and coverage limitations. The
[synthetic trace test](../../scripts/check-script-trace.mjs) checks
shared modules, cycles, missing/dynamic imports, board/item entrypoints,
schema validation and external GAM overrides.

**Owner ZIP observation:** `BSTW_EXPO_DEMO.zip` has **40 RPGCode
program files and 59 direct `#include` statements**. All 59
include file names are present in the archive. The title startup
`menuTitle.prg` has five direct includes and reaches 13 unique
program files when following includes transitively. Its actual
execution, including conditional title-menu branches, is still
unverified.

## Unversioned source

PRG is RPGCode source without a reliable file-format revision header. The inspector says “No stored file-format version”; it does not infer a Toolkit release from commands or syntax. The static indexing rules above apply.
