# BSTW Expo Demo browser ending

The [source audit](bstw-ending-plugin-audit.md#shortest-source-supported-new--13-clues--ending-path)
records seven placed clues and six main-menu clues on the opening board.
The archive GAM binds Q to ENDDEMO.prg. CommonFunctions.prg sets
ENDDEMO to 1 when the last clue is awarded. ENDDEMO.prg guards its
final dialogue and calls windows(). At the pinned Toolkit revision,
[windows() posts the engine's quit message](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L675-L683).

## Browser behavior

Enter through **Compatibility → Bruce Saves the World! compatibility →
New**. Walk to the seven authored targets and use Talk. Six main-menu
options provide the remaining clues through the archive's GAM-bound
menu action. Tactics, Equipment and Status require profile confirmation.
Cancelling leaves the clue available for retry. Repeat conversations
and repeated menu selections do not add clues.

The profile accepts the unique, rooted GAM Q action for ENDDEMO.prg.
Both keyboard Q and its on-screen runtime action read ENDDEMO from the
live script session when invoked. With the flag unset, the action shows
the browser's locked-ending message. With the flag set, it displays the
literal archive dialogue in order, including recognized frozen-window
composition and newline tokens. Each page retains its source path and
line. The projection requires a recognizable ENDDEMO guard, rooted
includes and a terminal windows() inside that guard. Unsupported shapes
produce a source diagnostic. Generic play uses its ordinary RPGCode
dispatch, independently of the profile.

Advance the last page to trigger the browser equivalent of windows().
The **Demo complete** panel freezes play and offers **Back to Game
Explorer**. Reset on the play panel starts a fresh Compatibility → New
session with zero clues and an unset ending flag. This is a text and
input projection of the recognized source path. Toolkit canvas layouts,
visual effects and delays are represented by a single browser panel
with manual page advancement. The opening Loyalis interaction retains
the existing same-board reload approximation described in the
[source dialogue notes](tk3-source-dialogue.md).

## Verification

The staged Chromium test uses a generated ZIP with actual GAM, BRD and
ITM bindings. It drives all 13 clues using ordinary movement, Talk and
menu controls, tests a repeat visit, a repeated menu choice, profile
cancellation and retry, Q before the flag is set, source dialogue and
completion via both controls, and reset. The unchanged test path for
the two independent generated TK3 archives checks generic behavior and
the absence of adapter module requests.

The original BSTW_EXPO_DEMO.zip was unavailable for this implementation.
Its recorded SHA-256 is
77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300.
The existing local-only source check also validates the Q binding and
ending projection when given the checksum-matching file.

    node scripts/check-tk3-source-dialogue.mjs "/path/to/BSTW_EXPO_DEMO.zip"

That command checks source decoding and projection. Actual-ZIP browser
execution, the original Toolkit runtime, and owner acceptance of the
deployed build are separate checkpoints. Keep the private archive and
its contents local.
