# Source-owned Toolkit 3 CCmap menu clue projection

[Issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92) ·
[BSTW ending audit](bstw-ending-plugin-audit.md).

**This is an explicitly bounded source projection, not execution of
the full CCmap class, nested game menus, or arbitrary RPGCode.**
No original BSTW files, art, DLLs or PRGs are in Git/CI.

## Evidence from the original, read-only archive

Original BSTW Expo Demo SHA-256:
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`.

- GAM's runtime menu-key binding points to
  `BSTW/Prg/menuMain.prg`. It includes `menus.prg`
  and invokes `MainMenu()`.
- `init.prg:798–915` declares the six `SIDEMENU`
  images, including `mmItems_inactive.png` through
  `mmSystem_inactive.png`, and the `PROFMENU` player
  window. `menuTitle.prg:109–117` sets two starting
  party members in its New branch.
- `menus.prg:1023–1219` implements the six clue cases
  using `if(checked[event]==0)`, `clues++`,
  `updateClues("...")` and `checked[event]++`.
  Cases 1–3 require `if(index~=-1)` after selecting
  a player; cases 0, 4 and 5 are immediate.
- `init.prg:46–62,68–83` provides event indices,
  `maxclues=13`, and `checked=CArray(maxclues)`.
  `CommonFunctions.prg:267–300` defines the
  completion flag in `updateClues`.
- Pinned Toolkit 3.1
  [revision 9191b919](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead)
  `common/mainfile.cpp` and `input/input.cpp`
  implement the GAM runtime key → PRG dispatch,
  reused here from the existing browser runtime.

## Implemented source-driven behavior

The separate pure [menu interpreter](../../tk3-source-menu.mjs)
starts at the **GAM-resolved entry PRG**, follows its
uniquely resolved included program, locates the invoked
method, and validates the clue-bearing switch cases. It
derives each label from source CCmap `SIDEMENU` graphics
or text and each player choice from the `PROFMENU`
party variable and source startup script. There are
no BSTW-specific string, event-index, player or script
name checks in the browser runtime.

The GAM menu-key button (Enter in BSTW) opens
responsive, keyboard-accessible, touch-friendly options.
Selecting an immediate option or a valid source-defined
party member on a gated option updates the **same**
`checked[]` / `clues` / `remainingclues` in-memory session
as the previous placed-object conversations. Repeat
visits cannot give extra clues. The terminal variable
is set from the *source helper method* only when all
clues are collected. Reset/New restores a fresh session.

Ambiguous/missing includes, unsupported labels or
enumerations, malformed clue branches and unsupported
effects are surfaced as **source-path/line diagnostics**,
never silently awarded.

## Approximations and known original edge case

This is a text/button projection of the six main
menu entries only. It does **not execute** native
CCmap bitmap/cursor behavior, `ItemScreen`,
`TacticsScreen`, `EquipScreen`, `StatusScreen`,
`OptionScreen`, System Save/Load/Title/Quit,
plugins, or nested screen side effects. Selecting
a menu entry projects only the supported source clue
branch. It does not claim to render the original UI.

The original script increments `checked[event]` for
Tactics/Equip/Status **even when player selection was
cancelled**, which can permanently lose that clue.
The browser deliberately makes Cancel non-destructive:
neither the clue nor `checked[]` is changed until a
real profile is chosen. This is a **documented browser
fidelity difference** intended to keep the small
demo finishable.

The original `menuTitle.prg` startup is still not
fully executed by the BSTW title/New adapter. The
source-owned clue projection initializes only its
bounded state. Q still resolves to the source
`ENDDEMO.prg`, which is *not yet executable* in this
slice because it requires more dialogue/class behavior.

## Tests and acceptance

[check-tk3-source-menu.mjs](../../scripts/check-tk3-source-menu.mjs)
generates **two distinct synthetic native game ZIPs**
with different roots, PRG paths, option names, event
variables, player profiles and ending flags. They
exercise the actual production ZIP → GAM → PRG →
included source method → menu choice → shared variable
path, all six one-time clues, repeat visits,
non-destructive cancel, completion flag, reset,
and unsupported-source diagnostics. Previous Harbor,
Grove, Lantern, BSTW, Toolkit and Pages checks run
alongside them.

An optional SHA-gated, **read-only local test** accepts
the original owner archive, but never runs in CI:

    node scripts/check-tk3-source-menu.mjs "/path/to/BSTW_EXPO_DEMO.zip"

**Desktop/Android test after merging:** upload BSTW →
Open BSTW title → New → talk to the seven placed
interactions → press the menu key (or its touch button)
→ select Items, Options and System → select Bruce
or Loyalis in Tactics, Equip and Status → verify exactly
one clue per first visit. Cancel one profile picker and
confirm no clue is spent; repeat choices to verify no
second clues. At **13/13** the source ending flag should
be 1. Q still produces an unsupported original
ending-script diagnostic. Finishing the original
ending is the next grouped runtime capability.

**Evidence boundary:** pinned native source and
original ZIP were inspected read-only. CI exercises
synthetic games; no native editor or manual browser
playthrough is claimed.
