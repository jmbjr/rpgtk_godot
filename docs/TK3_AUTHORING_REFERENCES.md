# TK3 authoring references for the owner-led game intake

Reviewed selected authoring/scripting sections on November 22, 2026 for
[intake #142](https://github.com/jmbjr/rpgtk_godot/issues/142). These are the
original Toolkit 3 manual and RPGCode guide shipped in the upstream repository,
pinned to `9191b9191c9bda0998c6faae16929b3331ed2ead`, the source revision already
used by our compatibility work. Links open the source HTML documents.

## Where to look

| Authoring question | Original reference |
| --- | --- |
| How are projects/assets arranged, and how do I create a board/player/NPC? | [Manual index](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/index.htm), [quick-start](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page1.htm) |
| Which file selects startup, opening board/player and runtime/activation keys? | [Main File editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page3.htm) |
| How are board layers, collision and interactive objects represented? | [Board editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page4.htm), [editor overview](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page2.htm) |
| How do player graphics and movement stances fit together? | [Character editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page7.htm), [animation editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page10.htm), [tile editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page5.htm) |
| How do placed NPCs differ from inventory/equipment items? | [Item editor](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page8.htm) |
| How do ordinary programs express dialogue and game state? | [RPGCode guide](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page17.htm), [language overview](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.htm), [basics](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.1.htm) |
| How do branches, loops, helpers/includes and variables behave? | [Program flow/operators](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.2.htm), [functions/includes](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.3.htm), [scope](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.4.htm) |
| Where are error handling, reserved values and command signatures? | [Error handling](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.5.htm), [reserved values](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page18.6.htm), [function reference](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page19.htm) |
| What did the original default menu/battle systems provide? | [Default systems](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/help/page15.htm) |

The primer supplies a procedural path; the intake does not require adopting the
separate advanced object-oriented guide or the old game's class libraries.

## Findings relevant to the first game

- The quick-start establishes project, board, walking graphics, player, NPC and
  scripted interaction while explicitly putting battle attributes aside.
- A playable launch involves linked assets, not one independent file: GAM,
  opening BRD, TEM and movement ANMs plus their source graphics. The character
  guide identifies cardinal movement graphics as the basic required set.
- ANM records link to frame artwork; an asset inventory must include those
  dependencies, not only the animation file.
- ITM records cover placed NPCs and inventory/equipment objects. Their board
  activation, background programs and menu use are different requirements.
- Ordinary variables/branches/functions can describe story state. The native
  function reference documents dialogue, input, program calls, transfer, media,
  inventory and other services; documentation does not establish our browser's
  implementation of every service.
- **Default is not synonymous with plugin-free.** The Main File guide identifies
  the bundled battle system as `tk3fight.dll`; `internalMenu` is documented as
  using the menu plugin. Upstream Basic contains
  [tk3menu.dll](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/game/Basic/Plugin/tk3menu.dll) and
  [tk3fight.dll](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/build/game/Basic/Plugin/tk3fight.dll).
  Do not introduce these dependencies into a plugin-free game by assumption.
  Combat is provisionally excluded; decide actual menu/inventory/save needs
  in the owner-led intake and verify any native environment requirements.

## Keep reference semantics and implementation evidence separate

For each chosen requirement, record its manual section, source/field evidence,
current browser support, assets and acceptance result. Our
[shared RPGCode contract](specs/tk3-script-interaction.md) and
[board lifecycle contract](specs/tk3-board-lifecycle.md) describe implemented
subsets and browser policies. If a manual entry is incomplete, ambiguous or
contradicts behavior, inspect the corresponding pinned native implementation
and test it when possible; do not invent an interpretation as verified parity.

This review did not execute the original Toolkit or inspect a newly supplied
BSTW ZIP. Record original editor/runtime checks separately from source
inspection, synthetic CI, actual-ZIP browser use and owner acceptance.

The original manual retains its authors' copyright notices. This file links
and paraphrases relevant findings; it does not republish the manual. Original
private game assets and source remain outside this repository unless the owner
separately authorizes publication.
