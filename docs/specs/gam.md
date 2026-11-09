# GAM · Main File

Specification revision **1.0** · [conventions](README.md). Partial reader.

## Layouts

| Variant | Fields in read order |
| --- | --- |
| Binary 2.2 | Header `RPGTLKIT MAIN`, `2`, `2`. Skip an i16 and zstr. Read project path and title as zstr. Skip five i16. Read language, startup program, opening board and initial character as zstr. |
| Text 2.0 | Line 1 is `RPGTLKIT MAIN` or `RPGTLKIT MAINFORM`. Lines 2–3 are `2`, `0`. Read startup at line 5, opening board at line 11, initial character at line 12. Line numbers are one-based. Other fields are outside this slice. |

The viewer resolves startup in `Prg`, board in `Boards`, and character in
`Chrs`, case-insensitively. When startup resolves, its project root scopes
the two other lookups. Blank and `none` values are unset. The binary
`projectPath` is metadata. A separately supplied GAM takes priority over
a uniquely decoded GAM inside the archive.

## Decoded record

`major`, `minor`, `startup`, `board`, and `character` are always present
on a successful read. `projectPath`, `title`, and `language` are available
in the binary variant. Bindings carry resolution evidence when this file
configures the project. Parsing stops after the initial character.

Evidence includes the original Demo.gam and DustBall's text main.gam.
See the pinned [binary and text compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonMainFile.bas#L300-L525).
