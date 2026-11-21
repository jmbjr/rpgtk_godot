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
