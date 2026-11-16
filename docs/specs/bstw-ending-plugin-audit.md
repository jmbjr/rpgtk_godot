# BSTW Expo Demo — full-path source audit and plugin scope decision

Status: **read-only original archive inspection + pinned engine source inspection**,
not a successful native or browser playthrough. Issue [#92](https://github.com/jmbjr/rpgtk_godot/issues/92).
Plugin inventory baseline: merged [PR #91](https://github.com/jmbjr/rpgtk_godot/pull/91).

## Exact evidence and scope

Owner's unmodified `BSTW_EXPO_DEMO.zip`, SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`.
The ZIP contains 40 `BSTW/Prg/*.prg` entries, seven
`BSTW/Plugin/*.dll` entries and a GAM 2.9.
Each DLL was inspected as **data only**; no COM server was loaded,
registered or executed. Original game source/assets are not in Git/CI.

Pinned Toolkit 3.1 engine:
[9191b9191c9bda0998c6faae16929b3331ed2ead](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).
The engine
[opens ITM programs with BRD override precedence](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CItem/CItem.cpp#L82-L94)
and
[executes the resolved activation PRG](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/movement/CSprite/CSprite.cpp#L1410-L1530).

All source line numbers below refer to **the owner's PRG files**,
1-based. They are static facts about the archive, not a claim that
the original engine or browser executed them.

## Shortest source-supported New → 13 clues → ending path

1. The GAM configures `menuTitle.prg`, `start.brd` and `bruce.tem`.
   `menuTitle.prg:13–19` includes `CArray`, `CCmap`,
   `CommonFunctions`, `menus` and `init`, then calls `InitVar()`.
   `init.prg:26–62` defines the event indices; `init.prg:68–83`
   sets `clues=0`, `maxclues=13`, `ENDDEMO=0`, and
   `checked=CArray(maxclues)`. The title New selection in
   `menuTitle.prg:100–120` configures Bruce/Loyalis and calls
   `initCmaps()` before `end()`. Native
   [setUpGame()](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/app/winmain.cpp#L293-L341)
   executes the configured startup before the GAM opening board.
   The browser's existing BSTW **title/New adapter deliberately skips**
   all of those RPGCode side effects and goes straight to the board.
2. `start.brd` is 20×15×2 with seven placed ITMs on layer 1.
   **Board-program overrides**: inn door at (207,349), slot 3,
   `mwininn.prg`; ugly-house door (512,414), slot 4,
   `mwinuglyhouse.prg`; small-house door (495,223), slot 5,
   `mwinsmallhouse.prg`. **ITM-inherited programs**:
   Lami (82,200), slot 0, `lami.itm` →
   `mwinLami.prg`; Rusty (432,228), slot 1,
   `rusty.itm` → `mwinRusty.prg`; Jim (590,55),
   slot 2, `jim.itm` → `mwinJim.prg`;
   Loyalis (115,115), slot 6, `loyalis.itm` →
   `mwinStartBoardLoad.prg`. The BRD activation strings for the
   latter four are **empty**; the filenames are inside the ITMs.
   The condition `bruceloyalis` on the Loyalis placement also
   matters to activation/loading; this slice does not execute it.
3. `mwinStartBoardLoad.prg:4–48` presents the opening dialogue,
   assigns `bruceloyalis=1` at line 46 and closes the message
   window. Lines **49–56** obtain Bruce's location, use
   `Send("start.brd",x,y,layer)` and award **one clue** via
   `clues++ / updateClues(...)`.
4. Three first conversations award one clue apiece:
   `mwinLami.prg:90–91`, `mwinRusty.prg:71–72` and
   `mwinJim.prg:73–74`. Three first door conversations
   award one apiece: `mwininn.prg:42–43`,
   `mwinuglyhouse.prg:57–58`,
   `mwinsmallhouse.prg:38–39`. The programs use
   `getTickCount()`, `ItemTalkThreshold=500`,
   `checked[event]` and class-based `theMwin->...` calls.
   Later conversations follow different branches and normally
   should not award another clue.
5. The `MainMenu()` switch in `menus.prg:1023–1220`
   supplies **six remaining first-time clues**:
   items **1054–1062**, tactics **1073–1090**,
   equipment **1099–1116**, status **1124–1141**,
   options **1147–1155**, and system **1161–1164**.
   Tactics/equipment/status require a non-cancelled profile
   selection before awarding the clue. `checked[event]` prevents
   duplicate awards. Save/Load is presented as unimplemented
   in the demo and is not necessary to reach the end.
6. Total = 1 opening + 3 villagers + 3 doors + 6 menus = **13**.
   `CommonFunctions.prg:267–300` implements `updateClues`:
   if `maxclues - clues == 0`, line **299** sets
   `ENDDEMO = 1`, and lines 292–298 tell the player to press Q.
   The **GAM itself** binds the `q` runtime key to
   `ENDDEMO.prg` (literal GAM bytes: `q\\0ENDDEMO.prg\\0`).
7. `ENDDEMO.prg:3–89` checks `ENDDEMO == 1`,
   displays the final wizard/Bruce/Loyalis dialogue through
   `TxtBox` and `theMwin`, and invokes native
   `windows()` at **line 89**. No extra board or DLC is
   required in the source-supported ending route.

There is **no required script-initiated board transition to a
second adventure map**. `Send` is used by the Loyalis opening
sequence to reload the same opening board. The `start2.brd`
file and various test scripts exist, but no static evidence
places them on the shortest win path.

## Seven bundled DLLs: declarations, static metadata, and script calls

PR #91 established nine stored GAM slots, **five populated**:
`MenuHelp.dll`, `brdPixelChk_v1.1.dll`, `xLibVision.dll`,
`GetSaveData_v1.34.dll`, `FileBrowser_v1.3.dll`. Independent
GAM menu/fight plugin fields are blank. Two bundled DLLs,
`FileBrowser_v1.31.dll` and `miscplugin.dll`, are not declared
by GAM slots. **None** of these facts proves a DLL was actually
instantiated during the original game's execution.

Nonexecuting PE inspection confirms **all seven** are x86/PE32
Windows VB6-style COM entrypoint candidates. All export
`DllCanUnloadNow`, `DllGetClassObject`,
`DllRegisterServer` and `DllUnregisterServer`, and none
exports `TKPlugInit`. **Additional read-only resource
inspection in this audit** confirms each has an embedded
`TYPELIB` resource starting with `MSFT` (3,076–3,480
bytes), an `_IID_CLS...` resource (20 bytes), and a
`VERSION` resource. The type libraries expose COM/VB6
interface names such as `Plugin_Initialize`,
`Plugin_Terminate`, `SetCallbacks` and
`RPGCode_Query/Execute`; the **actual RPGCode command
names** were identified independently from strings in the
binaries. Presence of a resource is not proof of successful
registration, callable signatures or correct behavior.

| Bundled DLL | GAM | Non-executing evidence for candidate RPGCode methods | Exact BSTW PRG use | Relevance to required ending |
| --- | --- | --- | --- | --- |
| `MenuHelp.dll` | declared | `GetSMInfo`, `CurrentStatus`, `GetSpecialMoveFile`, `GetMousePos` names and argument-error strings | No live call to these names in the 40 PRGs | **No required call found** |
| `brdPixelChk_v1.1.dll` | declared | `brdpixelchk` | `playerloc.prg:1,7` debugging calls | Diagnostic/test script; **not on traced ending route** |
| `xLibVision.dll` | declared | `CreateVision`, `VisionAddEvent`, `VisionEnableEvents` and removal/enable methods; detailed argument-error strings | `testvision.prg:12,17,21,24`; `visiontest.prg:5–7` | Optional standalone tests, **not on route** |
| `GetSaveData_v1.34.dll` | declared | `GetSaveData`/`GetSaveValue` and `getgarbage` string evidence | `CommonFunctions.prg:164` and `CSav.prg:173` | Save/diagnostic helpers, **not required for demo** |
| `FileBrowser_v1.3.dll` | declared | `filelist`, `getfilename`, `filebrowser` | `menus.prg:771` `FileList("SavFileF","Misc","sav")`; `CSav.prg:246` `GetFilename(m_bkg)` | Save/load UI only; **not needed to win** |
| `FileBrowser_v1.31.dll` | undeclared | Similar `filelist` / `getfilename` strings | No source call specifies this version | No evidence that this version is loaded |
| `miscplugin.dll` | undeclared | `getboardbkg`, `getboardred/green/blue`, `savetobitmap`, `getitemfilename`, `getimagewidth/height`, `getitembyindex`, `getcanvaswidth/height` | No live call to those exact names in 40 PRGs | No evidenced ending dependency |

**Do not confuse** `GetSaveData` mentioned in comments
(`SaveIt.prg:8,14`) with a live method invocation.
Likewise, a DLL's method name in a binary does not establish
that the Toolkit runtime loaded it or the path through which it
would be reached. The `getTickCount()` timing call and
`windows()` ending call are **native Toolkit RPGCode builtins**
at the pinned revision, not evidence of a BSTW DLL method.

## Plugin command contracts and limits

**Required DLL call count for the traced ending: zero
based on live static call sites.** Therefore, no plugin call
contract is justified as a required implementation task yet.
The following are useful *optional* investigative leads, not
verified replacement specifications:

- `FileList("SavFileF","Misc","sav")` in `menus.prg:771`:
  three string literals, result assigned to `NumFiles`;
  the DLL's diagnostic says the function accepts two or
  three elements, including literal types. How file paths,
  list-result variables, cancel cases and sorting work is
  **not established**. Resolve with FileBrowser VB6 source
  or original-editor behavior.
- `GetSaveData(SavFile,VarStr[,OutFile])` in
  `CommonFunctions.prg:164` and `CSav.prg:173`:
  two/three string-like parameters, results used as counts.
  Binary diagnostic mentions `GetSaveValue` names and
  save-file sections. Whether all parameters, errors and
  results match is **unverified** without matching plugin
  source or a VB6/Toolkit test.
- `brdpixelchk([filename])` in `playerloc.prg:1,7`:
  optional filename is suggested by the call sites, but
  **numeric return shape, coordinate policy and side effects**
  are unknown. Use matching plugin source before emulating.
- `CreateVision(item,width,height,distance,range,obstructable)`,
  `VisionAddEvent(visionId,event,handler)`,
  `VisionEnableEvents(visionId)` in the two vision test PRGs:
  the binary exposes parameter count/type and event-type
  diagnostics but does not establish sight/collision physics,
  event timing or the callback handler contract. Note that
  `testvision.prg:3,12` passes a string for `item`, whereas
  the DLL's embedded error describes a **number**. Resolve
  with matching xLibVision source/editor test, not guessing.
- `MenuHelp.dll` and `miscplugin.dll`: signatures, returns
  and side effects of individual candidate commands remain
  unknown; **no reachable calls require implementing them**.

If matching plugin source is supplied later, audit it as
an independent source revision against **the exact DLL version**,
and promote only demonstrated input/output/side-effect contracts
into reusable runtime command adapters. Keep the DLL bytes
read-only and never commit them.

## Browser checkpoint and remaining capability groups

**Verified by existing repository CI before this audit:**
BSTW title snapshot/New adapter, imported start board with
Bruce walking, authored three doors, and a paraphrased inn
dialogue awarding one clue. The browser currently **does not
execute** the actual `menuTitle.prg`, `mwininn.prg` or
`ENDDEMO.prg` scripts; it does not expose six clue-awarding
menus, the Q ending binding, or full `CMwin` rendering.

**New bounded capability in this PR:** the production
`BRD → ITM → PRG` mapper now implements native
`CItem::open` precedence: an explicitly named BRD program
wins; if and **only if** the BRD program field is empty, use
the source ITM's `Pickup program`. Ambiguous or missing
programs remain ineligible; no DLL is needed. This makes
Lami, Rusty, Jim and Loyalis **locatable as program-linked
Talk targets**. Their original scripts are still unsupported
by the narrow interpreter and should produce exact
path/line diagnostics rather than fabricated conversations.
A distinct synthetic Grove ZIP variant proves this mapping.

**Capabilities still needed to play all 13 clues to the end:**
1. **Startup + runtime session:** source `InitVar`/`CArray`
   arrays, New branch initialization, native setup order,
   registered Q runtime program, and first-board entry/ITM
   conditional loading.
2. **Source dialogue execution:** `#include`, method/class
   construction and calls (`CMwin`/`CText`/`SCanvas`),
   `getTickCount`/strict cooldown, comparisons, arrays and
   increments, user-defined `updateClues` and shared state;
   navigation/continuation under wait/close. This applies
   to seven source-authored placed interactions.
3. **Main menu/navigation:** `CCmap` window construction,
   cursor/selection, six first-time menu clue branches,
   profile selection where required. Save/Load branches
   need not be implemented for the ending.
4. **Ending dispatch:** native GAM runtime Q →
   `ENDDEMO.prg`, conditional `ENDDEMO == 1`,
   `TxtBox`/`CMwin` dialogue and safe browser exit
   semantics for `windows()`.

These are **multiple interacting systems**, not a missing
one-line plugin command. Recommend a grouped next PR for
**runtime session + source dialogue for all seven item
interactions (including clue state)**, followed by main-menu
clues and Q ending, with separate original-ZIP acceptance
checkpoints. Do not replace source classes or player state
with BSTW-specific magic strings and do not claim emulator
parity until each behavior is tested.

### Verification boundary

- Original ZIP/dll evidence: read-only SHA-verified local
  binary/source inspection, including COM resources. No
  original executable, plugin or game asset executed.
- CI: different synthetic game uses the production
  `openGameArchive → readArtifacts → buildReferences →
  buildPlayableScene → startPlacedTk3Script` path to test
  ITM inheritance, explicit board override and missing/
  ambiguous references. Existing BSTW/Harbor/Grove/Lantern
  and Pages checks remain mandatory.
- A SHA-gated optional local test in
  [check-itm-activation-fallback.mjs](../../scripts/check-itm-activation-fallback.mjs)
  validates all **seven original** links using the actual
  production JavaScript path **only when run in a checkout
  with the original ZIP**.
- **No original full production-JS/BROWSER run was performed
  by this audit** unless explicitly reported separately.
  GitHub Actions must never see the original ZIP.
