# GAM · Main File

Specification revision **1.1** · [conventions](README.md). Partial reader.

## Layouts

| Variant | Fields in read order |
| --- | --- |
| Binary 2.2 | Header `RPGTLKIT MAIN`, `2`, `2`. Skip registration i16 and zstr, read project path and title as zstr, then five i16 (screen type, full screen, resolution, **legacy parallax**, protection). Read language, startup, opening board and initial character as zstr. |
| Binary 2.9 | Header `RPGTLKIT MAIN`, `2`, `9`. Skip registration i16 and zstr, read project path and title as zstr, then **four** i16 (screen type, full screen, resolution, protection). Read language, startup, opening board and initial character as zstr. No parallax field. |
| Text 2.0 | Line 1 is `RPGTLKIT MAIN` or `RPGTLKIT MAINFORM`. Lines 2–3 are `2`, `0`. Read startup at line 5, opening board at line 11, initial character at line 12. Line numbers are one-based. Other fields are outside this slice. |

The viewer resolves startup in `Prg`, board in `Boards`, and character in
`Chrs`, case-insensitively. When startup resolves, its project root scopes
the two other lookups. Blank and `none` values are unset. The binary
`projectPath` is metadata and is **not used to form archive paths**.
A root GAM such as `BSTW.gam` can therefore configure files inside
`BSTW/Prg`, `BSTW/Boards` and `BSTW/Chrs`. A separately supplied
GAM takes priority over a uniquely decoded GAM inside the archive.
A resolved reference can open an archive entry even when its native
BRD or TEM format is not yet decoded.

## Decoded record

`major`, `minor`, `startup`, `board`, and `character` are always present
on a successful read. `projectPath`, `title`, and `language` are available
in the binary variant. Bindings carry resolution evidence when this file
configures the project. Parsing stops after the initial character.

Evidence includes the original Demo.gam and DustBall's text main.gam.
See the pinned [binary and text compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonMainFile.bas#L300-L525).

## Text 2.0

Line-oriented `RPGTLKIT MAIN` or `RPGTLKIT MAINFORM`, major 2, minor 0. The text row in [Layouts](#layouts) defines the startup, board and character fields. Title and remaining project settings are not exported by this profile.

## Binary 2.2

NUL-terminated `RPGTLKIT MAIN` followed by little-endian i16 major 2 and minor 2. Use the binary row in [Layouts](#layouts); it additionally preserves project path, title and language. This is a partial project-configuration reader.

## Binary 2.9

NUL-terminated `RPGTLKIT MAIN`, followed by little-endian i16 major 2,
minor 9. After the registration i16 and code zstr, read project path
and game title zstr. The four following i16 values are screen type,
extend-to-full-screen, main resolution, and disable-registration-protection.
**Unlike binary 2.2, binary 2.9 does not contain an old parallax i16.**
Read the language and the three startup names as zstr. Parsing stops
after the initial character; later Toolkit 3 GAM configuration, plugin
declarations, game mechanics and launch behavior remain outside this
reader. The four screen/protection fields are consumed to locate the
links, not exported as separately validated settings.

[The pinned 3.1 compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonMainFile.bas#L313-L344)
establishes the conditional parallax field. Owner-provided BSTW sample
evidence recorded in [issue #79](https://github.com/jmbjr/rpgtk_godot/issues/79)
identifies a root `BSTW.gam` with title `BSTW`, stored project path
`Game\\BSTW\\`, and three configured entries:

| Binding | Stored name | Archive entry |
| --- | --- | --- |
| Configured startup | `menuTitle.prg` | `BSTW/Prg/menuTitle.prg` |
| Opening board | `start.brd` | `BSTW/Boards/start.brd` |
| Initial character | `bruce.tem` | `BSTW/Chrs/bruce.tem` |

The independent [synthetic GAM 2.9 regression](../../scripts/check-bstw-gam-29.mjs)
checks this layout, archive versus separate GAM selection, connected JSON
references, header metadata and corrupt/truncated inputs. That fixture is
**not copied from the BSTW game**, and the full demo ZIP is not checked
into this repository. The board and character files still need their
native Toolkit 3 readers.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
