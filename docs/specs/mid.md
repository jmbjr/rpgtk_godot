# MID · Standard MIDI File

Specification revision **1.0** · [conventions](README.md).
See the [Standard MIDI File field guide](https://midi.community/docs/smf/)
and [General MIDI program map](https://midi.community/docs/general-midi/).

The metadata reader accepts SMF formats 0, 1 and 2. It reads big-endian
chunk sizes, `MThd`, declared `MTrk` chunks, variable-length event deltas
and running status. Invalid lengths, truncated events, or missing
declared tracks are errors. Track ticks are absolute from that track's
start. Time division is `{ ticksPerQuarter }` or
`{ framesPerSecondCode, ticksPerFrame }`.

Decoded data contains numeric `format`, `trackCount`, `timeDivision`,
and `tracks`. Each track has one-based `number`, payload `size`,
`ticks`, total `events`, positive-velocity `noteOnEvents`,
one-based `channels`, text `names` and `instruments`, and `tempos`
with `tick` and `microsecondsPerQuarter`. Per-track `parts` group
positive-velocity notes by port, one-based channel, and one-based program,
with General MIDI `instrument`, `percussion`, `noteCount`,
`lowestNote` and `highestNote`. Pitch values are MIDI keys.
Formats 0/1 share channel programs across tracks by port. Format 2
tracks are independent. Channel 10 is labeled percussion.

The piano roll pairs note-on and note-off events, including zero-velocity
note-on as note-off. It displays key-held time. Built-in playback and the
piano roll support formats 0 and 1. The built-in synth skips SysEx.
This is a partial record, with audio playback and visualizations separate
from exported metadata. Evidence includes `VIP - Title1.mid` and
`VIP - Title2.mid`.
