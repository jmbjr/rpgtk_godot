# Authored board lifecycle (#123)

Pinned source: Toolkit `9191b9191c9bda0998c6faae16929b3331ed2ead`.
No native executable or private diagnostic archive was available for this work.

## Board entry

- `vc/trans3/app/winmain.cpp:304–341`: GAM startup finishes before initial
  board open, player positioning, music and synchronous `enterPrg` execution.
- `vc/trans3/rpgcode/functions.cpp:481–519`: Send opens its destination,
  positions the selected player, and calls `CSprite::send` before returning.
- `vc/trans3/movement/CSprite/CSprite.cpp:1337–1368`: Send aligns/renders the
  board, deactivates standing program regions, starts music and runs the board
  entry CProgram synchronously. Repeated/return visits run it again.
- `vc/trans3/common/board.cpp:477–495,541` and `movement/CItem/CItem.cpp:92–109`:
  board/item thread creation occurs during open, before entry execution.
- `app/winmain.cpp:407–432`: Reset frees globals and all threads and repeats
  setup. The browser direct diagnostic skips GAM startup but opens the board
  with entry enabled; this diagnostic launch is a browser policy.

`tk3-board-entry.mjs` exposes the same typed, project-scoped decoded BRD entry
binding as Explorer. A nested shared-VM program retains Send's caller frames,
locals and pending expression. Entry waits/effects use the existing driver;
only after entry returns does Send's caller continue. A startup Send may enter
another board before normal startup return reopens the GAM-configured board.
Reset starts a fresh session. Rendering/mount errors remain transactional.
Missing/ambiguous or unsupported entry source leaves a visible rooted diagnostic
and a usable board. Script failure terminates that foreground chain; the browser
does not emulate native error recovery.

Browser bounds are 16 nested entry/program frames and 32 successful transfers
between explicit user inputs. An input wait/choice starts another transfer
budget; no-input transfer cycles terminate with a source diagnostic. Existing
VM source/storage/instruction limits also apply. These are browser safeguards.
Board music behavior is unchanged here; existing authored MediaPlay/GS resources
survive remounts. Automatic native board music switching is not claimed.

## Inspection and acceptance

The BRD inspector/connected JSON already preserve entry filenames, item
activation/multitask and board-thread bindings. Player diagnostics now identify
the active board entry owner and resolution, with a source-line navigation
button. Line 1 is the entry invocation boundary; yielded diagnostics retain the
actual helper and line. No new binary field/layout was invented.

Download TK3 Board entry · Harbor or Grove. Play the source title, select
Depart/Wake, finish the intro and observe entry 1. Finish entry, use E (Harbor)
or T (Grove), then advance destination entry and return entry 2. Reset restarts
the title; direct diagnostics skips startup and runs a fresh entry 1. Use
Inspect board entry source to navigate back to its PRG.

Unit checks verify nested waits, caller locals, resolver errors and transfer
bounds. Staged Chromium covers both independent archives and preserves prior
Explorer/media, GS, canvas, title and encounter regressions. CI evidence is
recorded in #123/PRs. Actual-ZIP execution, deployment, owner acceptance and native
Toolkit parity remain separate. In particular, no `man_wander.prg` trigger or
pirate behavior is inferred without the owner's diagnostic archive bytes.

## Cooperative background programs

Pinned `common/board.cpp:477–495,1555–1563` creates/frees board threads, and
`movement/CItem/CItem.cpp:92–109,138–168` uses a BRD multitask override or ITM
on-board program, runs only active items, and destroys item threads on unload.
`rpgcode/CProgram.cpp:109–208` owns the global task set, instruction quanta and
sleep clocks; its global variable heap is shared with foreground programs.
`rpgcode/functions.cpp:5527–5653` supplies Thread(file,persist[,out]),
GetThreadID([out]), KillThread, ThreadSleep(id,seconds) and ThreadWake.
Sleep zero is indefinite. `app/winmain.cpp:617` schedules tasks in the main loop;
Reset/close destroy all threads. Explicit persistent Thread calls survive board
changes; BRD/item tasks are board-owned. EraseItem pauses an item task.

The browser uses the existing compiler and VM, at most 32 tasks and 512
instructions per task per animation frame, with an 8ms soft scheduling budget
and round-robin fairness (one quantum may exceed the clock budget). Sources compile once; frames retain
locals, expressions and sleep continuations. Globals merge serially with the
foreground at each quantum. Board loading registers tasks before entry but
foreground execution/modal input owns the driver until it returns. Background
programs cannot draw dialogue/canvas or initiate Send/combat/exit in this slice;
such effects fault visibly in that task instead of stealing foreground UI.
Error isolation and these foreground restrictions are browser policies, not
claims of native parity. No worker, second interpreter or archive recognizer is
used. Shared source/storage bounds still apply to each task; sleep is wall-clock.

The pure `tk3-behavior-bindings.mjs` resolver feeds task activation and the
connected JSON `behaviorBindings` collection. It retains board, source owner,
slot/entity slot, role, resolution/candidates and target entry line 1. Source
trace includes configured board-thread entrypoints. Active task diagnostics
link the current helper/line and the owner back into Explorer. No binary layout
was changed. Inert decoder placeholders are cleared in runnable fixtures only.

Background Harbor/Grove use board and item counters plus a persistent task.
After title/entry, counters advance while directional input remains responsive;
Talk pauses background execution, transfers discard old board/item tasks (new
board placements may start their own inherited tasks), persistent
work survives, and reset/close dispose everything. Harbor uses a BRD override;
Grove inherits the ITM on-board program. CI separately tests faults, limits,
sleep/wake/kill, shared globals and erased-item ownership. This establishes
synthetic task behavior; private `man_wander.prg` remains unavailable.

## Authored item movement

Pinned native evidence:

- `rpgcode/functions.cpp:273–307,2115–2136,2688–2701,2734–2768`:
  current-board numeric slot or bound source/target handle; PushItem queues
  directions, ItemSpeed sets seconds per step, ItemLocation returns coordinates
  and layer through output references.
- `movement/CSprite/CSprite.cpp:658–735,868–901` and `CSprite.h:51–57,159`:
  comma-separated cardinal/diagonal directions; GAM `MF_PUSH_PIXEL=2` uses 8px
  pushes, other verified movement modes 0/1 use 32px; foreground movement waits,
  background movement continues unless `tkMV_PAUSE_THREAD=1`; queue replacement
  uses `tkMV_CLEAR_QUEUE=2`. A new movement task owner wakes the previous owner;
  ThreadWake releases a movement wait without cancelling its queue. Native
  ItemSpeed stores seconds as milliseconds.
- `movement/CSprite/CSprite.cpp` collision/render paths use the entity's current
  position/layer; the browser shares one entity record across script handles,
  movement, rendering, player collision and Talk selection/markers.

`tk3-entities.mjs` belongs to the existing player service session. Opening a board
reconstructs its slot identities/positions; reset/close/exit disposes all movement
and rejects pending foreground continuations. Flags 0–3 and bounded queues (128)
are supported; unsupported flags, handles, direction strings or GAM modes report
source diagnostics. ItemSpeed accepts >0 through 60 seconds; initial zero speed
uses 0.0625 seconds (browser policy). Diagonal direction art is used when present;
missing animation falls back to the initial authored artwork. Complete nonempty
ANM TST/TBM frames, timing and transparency use the existing decoders. Blank
reserved ANM slots are skipped. Animation sounds/standing-idle timing are deferred.

Browser collision remains swept <=4px substeps with a radius-9 circle, same-layer
supported native vectors, board bounds and current player/item positions. It does
not implement native sprite base polygons, pathfinding or all native movement
flags. A blocked path ends its queue and resumes its caller; the UI records blocked
state. Native movement speed/easing and polygon overlap parity are not claimed.
Foreground dialogue/choices/combat pause item movement and background quanta;
foreground PushItem itself allows movement while its VM continuation waits.
EraseItem hides the same entity from drawing/collision/Talk and pauses its task.
Existing browser erasure history persists across return visits until reset; native
save/reload persistence remains separate. Persistent tasks lose stale bound-item
handles after transfer; numeric handles refer to the new current board.

Living boards Harbor/Grove exercise nested versus flat projects, BRD multitask
versus ITM inheritance, E/W versus S/N queued routes, shared globals, animation,
Talk's ItemLocation outputs and range at the moved position, blocked movement,
transfer/return and reset during a foreground movement wait. B starts that
foreground wait in the Living boards fixtures. These generated archives contain
no owner assets.
Wander/native pathfinding and the private diagnostic game's actual bindings and
`man_wander.prg` are unresolved: no pirate movement or actual-ZIP acceptance is
claimed from these synthetic routes.
