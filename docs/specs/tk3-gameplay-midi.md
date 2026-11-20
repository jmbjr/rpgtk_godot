# Gameplay MIDI with GeneralUser GS

Part of #123. `mediaPlay` now uses the existing SoundFont/worklet transport
with GeneralUser GS 2.0.3 by default. This applies to every shared RPGCode
entrypoint, including GAM startup; no archive identity or source pattern
selects a synthesizer. WAV playback retains browser audio.

## Ownership and failure behavior

`midi.mjs` exports the same bank descriptor to the inspector and player.
Its page-lifetime promise coalesces downloads and retains an immutable Blob.
Each playback receives a fresh ArrayBuffer because the worklet transfers
ownership of that buffer. A failed HTTP download clears the promise so a
subsequent play can retry. Inspector local-bank and built-in choices remain
inspector settings; gameplay always uses the GS default.

The player status names the bank while loading and playing. Download,
AudioWorklet and playback errors remain visible beside the source asset path.
Failures do not silently choose TinySynth or enter a retry loop. Playback is
asynchronous: a pending bank does not block source execution or Reset/Close.
HTTPS or localhost and browser Web Audio/AudioWorklet support are required.

Music repeats through the existing playback completion callback until source
`mediaStop`, replacement media, reset, close or `windows()` exit. Board Send
and startup-to-board remounts retain the same session services and audio.
A generation is claimed **before** reading media bytes, preventing a stopped
or replaced pending read from starting playback later. The existing MIDI
transport stops its context and checks cancellation after bank/worklet loading
and synth readiness. Shared download bytes may finish caching after a session
ends; they cannot start that session's audio.

## Verification boundaries

- `check-tk3-player-services.mjs`: shared bank default, loop and failure callbacks,
  MIDI-to-WAV replacement, cancellation during lazy ZIP reads, disposal, HTTP
  retry, concurrent download reuse and fresh transferable buffer ownership.
- `check-tk3-browser.mjs`: staged production imports, real hosted SF2 and
  AudioWorklet, nonzero sampled output, delayed-bank stop/replacement/reset/close,
  failed download and retry, injected worklet initialization failure, loop, board continuity,
  source `mediaStop`, and exit cleanup. Existing independent Harbor/Grove title,
  canvas, generic player and connected Explorer/media checks remain enabled.
- Local non-browser workflow checks pass. The local Chromium launch is blocked
  by this workspace's socket restrictions; staged-browser verification runs in
  the PR's GitHub Actions job. Its result is recorded in the PR.
- The owner archive `demo_tk310_start_board_playable(1).zip`, SHA-256
  `367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f`,
  is unavailable in this implementation workspace. This change does not claim
  a new actual-ZIP run, subjective listening acceptance, or native Toolkit parity.
  Previous actual-ZIP canvas/title evidence remains in the earlier reports.
- PR checks stage a browser build; they do not deploy Pages. The owner merges
  and accepts the subsequent deployed build.

## Deployed-browser acceptance

1. Upload that TK3 ZIP and choose Play game. Confirm the original title and
   music, with `GeneralUser GS 2.0.3` in the audio status. Listen for the quality
   improvement over the previous built-in synth.
2. Choose New Game, advance the intro and confirm music continues on the board.
   Exercise M and Escape, then G and Reset as the existing canvas regression.
3. Reset and Close during the first bank load; closing must remain silent after
   loading finishes. Reset may play only its fresh title session. Reopen and
   choose the source exit; audio must stop.

## Next handoff

No pre-existing local branch, uncommitted implementation or open PR was found
beyond merged #130 at `738a4383`. This checkpoint addresses the requested gameplay
GS default and its media lifecycle race. Further #123 runtime growth still needs
an authored requirement and observable test. Classes/objects, native plugins,
native combat, save/load and board-entry execution remain unresolved separate
capabilities. The supplied G program still has an unconditional loop exited with
Reset. M/G native input-registration provenance remains the documented evidence
gap in `tk3-canvas-input.md`. Deployed TK3 ZIP listening and owner acceptance
remain the next verification steps; no additional runtime feature is claimed.
