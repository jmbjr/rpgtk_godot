# Toolkit 3 plugin declarations and static DLL interface evidence

Specification revision **1.0** · [conventions](README.md).

## Source-defined plugin interfaces

The pinned [Toolkit 3.1 plugin loader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/plugins/plugins.cpp)
selects different Windows plugin paths **at runtime**. This viewer does
not invoke any part of either path:

1. The legacy path looks up the **`TKPlugInit`** export (required for
   old-style initialization); other optional names include
   `TKPlugVersion`, `TKPlugBegin`, `TKPlugQuery`,
   `TKPlugExecute`, `TKPlugEnd`, `TKPlugType`,
   `TKPlugMenu`, `TKPlugFight`, and input/fight notification names.
   The [pinned legacy plugin definition](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tk3menu/Tkplugin.def)
   provides an example of those exports.
2. The runtime first searches for **`DllRegisterServer`** to choose
   its COM/type-library path. It subsequently loads a type library
   and attempts to create an `IDispatch` class supporting
   `SetCallbacks`, with method names including
   `Plugin_Initialize`, `PlugType`, `RPGCode_Query`,
   `RPGCode_Execute`, `Menu` and `Fight`. These
   `IDispatch` methods **cannot be inferred from the PE exports
   table**. The native loader's use of Windows COM is separate from
   static inspection and is not emulated in the browser.

The [GAM binary 2.9 spec](gam.md#binary-29) distinguishes independent
menu/fight plugin filenames from the counted plugin-slot table.
**Nine stored slots do not imply nine declarations.** Some plugins
may be listed in script text or may be bundled without a GAM
declaration. This feature does not infer that an undeclared DLL is
unused or that a declared DLL is actually activated.

## Static PE inspection

Every archive `.dll` entry is read as *untrusted bytes only*.
The [PE inspector](../../pe-inspect.mjs) validates the DOS header,
PE/COFF signature and section bounds, reads PE32 or PE32+ metadata,
maps the export directory's RVAs through file-backed section ranges,
and records named exports and ordinals. It checks for either
**COM-registration export names** or a **legacy
`TKPlugInit` name**. Missing, truncated, unusual and invalid
files are labeled separately; no DLL is interpreted as executable
RPGCode. The parser bounds section count, export count, strings, and
file offsets. Forwarded exports are labeled, not followed.

A DLL's metadata provides **architecture**, **PE32/PE32+ kind**,
DLL COFF flag and named exported symbols. These are facts about
the static file, *not* proof that the DLL is safe, loadable in a
particular Windows environment, registered, compatible with
the engine's callbacks, or callable from a particular RPGCode script.
`DllRegisterServer` is an executable function if called by Windows
or Toolkit; this browser **never calls it**. The presence of
`DllRegisterServer` and `DllGetClassObject` is an
**interface candidate classification** only.

The [plugin audit](../../plugin-audit.mjs) cross-references the
configured GAM's nonempty menu/fight plugin fields and numbered
plugin slots with bundled DLL paths. It retains the original
declaration role, slot, filename, resolution status and target.
It reports bundled files that are **not named by these
declarations**, but does not claim they are unused. When
there is no unambiguous configured GAM, the audit reports
`declarationScope: "unavailable"` rather than guessing a
declaration source. Individual DLLs and the GAM inspector show
the metadata; connected-game JSON includes a structured
`pluginAudit` alongside the existing plugin-declaration edges.

## BSTW sample evidence

The owner-provided `BSTW_EXPO_DEMO (1).zip` has SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`
and 285 files. Its native GAM 2.9 stores nine plugin slots, only
**five nonempty**, and blank independent menu/fight plugin fields:

| Configured slot | Declared file |
| --- | --- |
| 0 | `MenuHelp.dll` |
| 1 | `brdPixelChk_v1.1.dll` |
| 3 | `xLibVision.dll` |
| 4 | `GetSaveData_v1.34.dll` |
| Other nonempty slot | `FileBrowser_v1.3.dll` |

Exactly **seven DLLs** are bundled. Two are **not named in the
GAM plugin table**: `FileBrowser_v1.31.dll` and
`miscplugin.dll`. Their presence alone does not establish
whether scripts or other mechanisms use them.

An independent **non-executing PE export-table walk** over the
seven original DLLs found that **all seven** are x86
(`IMAGE_FILE_MACHINE_I386`) PE32 files with the DLL
characteristic. Each exposes the same four named exports:
`DllCanUnloadNow`, `DllGetClassObject`,
`DllRegisterServer`, `DllUnregisterServer`.
None exports `TKPlugInit`. This strongly supports classifying
their **entrypoint shape** as COM-style, but does **not**
establish a usable COM class, type library, or the actual
plugin methods.

## Tests and limitations

[Small synthetic PE fixtures](fixtures/pe-plugin-fixtures.mjs) and
[CI tests](../../scripts/check-plugin-abi.mjs) verify COM and
legacy export sets, x86/x64 headers, malformed files, unresolved
declarations, extra bundled DLLs, and connected-game JSON.
A SHA-256-gated **optional** read-only test checks the owner ZIP
locally; the original game binaries are **never committed**.

Still unverified: per-DLL COM type-library method signatures,
actual plugin-provided RPGCode command names, callbacks and side
effects, dynamic invocation paths, 32-bit Windows registration
and host compatibility. Mapping or replacing plugin behavior
requires a separate, bounded functional specification—not
loading original binaries into this viewer.
