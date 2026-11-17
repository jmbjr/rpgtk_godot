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
with manual page advancement. The panel skips the ending's WAV cues
and screen capture. The opening Loyalis interaction retains
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

The uploaded `BSTW_EXPO_DEMO.zip` matched SHA-256
`77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300`.
The implementer verified the unmodified ZIP in local staged Chromium.
Compatibility → New opened Loyalis's 12 pages. The browser route
earned all 13 clues, including a repeat inn visit and a cancelled then
confirmed profile choice. Q stayed locked at 0 and 12 clues. After the
last clue, keyboard Q opened 19 authored ending pages, followed by
Demo complete at the source `windows()` call. Reset restored 0 clues
and locked the ending again.

On pre-fix `main` (`bfbc4e2`), **Play opening board (direct diagnostic)**
reproduced the 300-line interpreter error in `CMwin.prg` when talking to
Loyalis. The same build opened his conversation from Compatibility → New.
The local-only source check validates the Q binding and ending projection
when given the checksum-matching file.

    node scripts/check-tk3-source-dialogue.mjs "/path/to/BSTW_EXPO_DEMO.zip"

That command checks source decoding and projection. The original Toolkit
runtime and owner acceptance of the deployed build remain separate
checkpoints. Keep the private archive and its contents local.
