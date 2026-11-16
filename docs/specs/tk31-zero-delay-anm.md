# Toolkit 3.1 zero-delay ANM compatibility

Tracks [issue #92](https://github.com/jmbjr/rpgtk_godot/issues/92).

## Source evidence

At pinned Toolkit revision [9191b919](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead):
- [common/animation.cpp, tagAnimation::open()](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/animation.cpp#L65-L99) reads an ANM 2.3 double-precision frame delay as-is without rejecting zero; it also discards unused empty frames.
- [common/CAnimation.cpp, CAnimation::play()](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/CAnimation.cpp#L109-L132) can wait zero milliseconds between frames.
- [common/animation.h](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/animation.h#L55-L67) initializes the native frame delay to zero.

The browser formerly rejected all zero-delay walking ANMs even with valid frames. But simply accepting zero without translation would make its existing frame-index division invalid. This change accepts nonnegative delays and uses an **explicit browser-only one-frame 1/60-second cadence** when the native value is zero. Source zero is retained as `nativePauseSeconds` for inspection; positive source delays are unchanged. This is a display-timing approximation, not a claim of frame-exact native execution. Missing/wrong-size animation frames and negative delays remain errors.

## Independent TK3.1 demo investigation

The owner's original read-only `demo_tk310.zip` is GAM 2.9, BRD 2.4, TEM 2.8 and ANM 2.3. The independently modified `demo_tk310_start_board.zip` changes only the GAM opening board from `test.brd` to `start.brd`. Its walking animations `start_s.anm`, `start_n.anm`, `start_e.anm`, `start_w.anm` have valid 32×32 source frames in `char.tst`, but **all store frame delay 0.0**, which triggered the user's reported browser error. Specific frames are South 1/2, North 3/4, East 7/8, West 5/6.

For immediate testing before this fix merges, a **local uncommitted copy** `demo_tk310_start_board_playable.zip` changes only four ANM delay doubles from 0 to 0.15 seconds; 69 other archive entries are byte-for-byte unchanged. No original game archive, DLL or assets are placed in the repo or CI. After merging this runtime fix, the owner can instead upload the earlier `demo_tk310_start_board.zip` without changing its ANMs.

Direct board launch does **not** execute original startup RPGCode, battle/menu plugins or the full old-man interaction. The file's preview and walking are separate acceptance checkpoints from a playable independent game.

## Regression and acceptance

The source-owned synthetic scene test encodes zero delay in real ANM 2.3 binaries, then uses the production `readArtifacts → buildReferences → buildPlayableScene` pipeline. It asserts all four walking directions preserve source tile frames and source pause zero, while returning a finite nonzero browser cadence. Negative delays remain rejected. Existing BSTW, Harbor, Grove, Lantern and Pages checks run in the same CI.

Manual test: upload the local test ZIP, choose **Play opening board (direct)**, walk the player four directions and inspect the board. After merge, repeat with the GAM-only patched ZIP; the original zero-delay source animations should now be supported without altering their bytes. No manual browser/native editor execution is claimed by this PR.
