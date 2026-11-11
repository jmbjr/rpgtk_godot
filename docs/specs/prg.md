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

## Unversioned source

PRG is RPGCode source without a reliable file-format revision header. The inspector says “No stored file-format version”; it does not infer a Toolkit release from commands or syntax. The static indexing rules above apply.
