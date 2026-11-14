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
configures the project. Toolkit 2 text 2.0 and binary 2.2 stop after the
initial character; native binary **2.9** also supports the source-defined
configuration tail, returned under `configuration`. A prefix-only 2.9
synthetic file remains readable for backward test compatibility, but
any nonempty tail must parse completely and end exactly at EOF.

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
Read the language and the three startup names as zstr. **The four
screen/protection values** are retained in `configuration.screen` when
the complete native 2.9 tail is present. The reader then continues
in the order below; this is static configuration **only**, not an
executable project loader.

| Next block | Source storage and exported fields |
| --- | --- |
| Runtime | Runtime program zstr, run/menu/general keys (three i16); i16 **maximum extended key index**, followed by maximum-plus-one pairs of i16 key and zstr program. |
| Menu and battle plugins | Two independent zstr fields, `menuPlugin` and `fightPlugin`, which may be empty. They are **not** the plugin slot table. |
| Combat | Enabled i16; i16 maximum enemy index followed by enemy filename zstr and skill i16 per slot; fight type i16, chances i32, alternate-fight-program flag i16, fight program zstr, game-over program zstr. |
| Skins and plugin slots | Button and window skin zstr. Then i16 **maximum plugin index** and maximum-plus-one plugin filename zstr. Empty slots are retained. |
| Day/night and mouse | Use/type i16, length i32; three cursor-sound zstr; joystick/color-depth/game-speed/pixel-movement bytes; cursor image zstr, hotspot X/Y bytes and transparency COLORREF i32. |
| Display and navigation | Width/height i32, FPS-titlebar byte; pathfinder heuristic i16; draw-vectors/path-color/movement-control i32; eight movement-key i16 values in the current native profile. |

The complete profile is supported by the pinned
[Main File compatibility reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonMainFile.bas#L350-L470).
All counted arrays use **inclusive maximum indices**: e.g. plugin
maximum 8 means **nine stored slots**, not eight populated plugins.
The decoder imposes bounds on those arrays and rejects truncated or
unexpected trailing data.

The Main File inspector lists the stored plugin slots, visually
distinguishes declarations from additional bundled DLLs, and links
nonempty entries to archive files when they resolve. The exported
connected-game JSON distinguishes `plugin-declaration` edges from
other `project-asset` edges. Empty, missing, and ambiguous references
remain different states. Neither inspector **loads, executes,
decompiles, or asserts capabilities** of a DLL.

### Real BSTW GAM evidence

The owner-provided `BSTW_EXPO_DEMO (1).zip` is SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`,
285 files. `BSTW.gam` is **1,963 bytes** and its native tail parses
exactly to EOF.

- **Plugin slots 0–8:** five populated names:
  `MenuHelp.dll`, `brdPixelChk_v1.1.dll`, `xLibVision.dll`,
  `GetSaveData_v1.34.dll`, `FileBrowser_v1.3.dll`.
  Four additional slots are blank.
- **Seven bundled DLL files** appear under `BSTW/Plugin/`.
  The five declared names all exist. The two additional DLLs,
  `FileBrowser_v1.31.dll` and `miscplugin.dll`, are **bundled
  but not declared by those five slots**. This does not establish
  whether scripts or other mechanisms use them.
- **Runtime-key table:** 51 stored entries (max index 50).
  Only two program filenames are populated:
  `menuMain.prg` (slot 3) and `ENDDEMO.prg` (slot 4), both
  present under `BSTW/Prg/`.
- **Enemy table:** 501 stored slots (max index 500), not a claim
  that 501 enemies are configured. The eight stored movement-key i16
  values are `205, 0, 208, 0, 203, 0, 200, 0`.
- The distinct `menuPlugin` and `fightPlugin` fields are **both blank**
  in this sample, despite the nonempty general plugin slot list.

The [small synthetic fixture](fixtures/native-main-29-fixtures.mjs) and
[dedicated test](../../scripts/check-bstw-gam-config.mjs) verify
out-of-order/empty slots, field alignment, native settings, graph
references, exported JSON schemas and malformed/truncated data. The
test can additionally run on the locally supplied ZIP and compare
original SHA-256 and exact plugin inventory. No game assets, DLLs,
or executable code are committed to the repository.

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
into this repository. The board and character files are now covered by separate native
Toolkit 3 readers; this GAM section documents static project settings
only. Engine behavior, plugin interfaces, and configuration effects
inside the Toolkit runtime remain unverified.

## Unsupported versions

The revision-specific sections on this page describe only the listed, verified
reader profiles. A different or unreadable header is reported explicitly in the
inspector and is not interpreted using a nearby revision. Detected header
metadata does not establish successful decoding. See the
[compatibility matrix](compatibility-matrix.md) for gaps and source evidence.
File-format revisions, Toolkit product releases and decoded JSON schema versions
are separate identifiers.
