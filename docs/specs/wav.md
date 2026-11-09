# WAV · RIFF/WAVE audio

Specification revision **1.0** · [conventions](README.md).
The [RIFF/WAVE format](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I%21%21PDF-E.pdf)
defines the container and chunk fields. This profile reads little-endian
`RIFF` / `WAVE` with at least one `fmt ` and `data` chunk.

The partial record contains `encodingTag`, `channels`, `sampleRateHz`,
`bytesPerSecond`, `blockAlign`, `bitsPerSample`, `audioBytes` and
`chunks` with `id`, payload `size`, and zero-based payload `offset`.
Chunks are in file order. Their odd-byte alignment padding is excluded
from sizes. Audio bytes are summed across data chunks.

For PCM/IEEE float (tags 1 or 3) with nonzero alignment and sample rate,
`sampleFrames = floor(audioBytes / blockAlign)` and
`durationSeconds = sampleFrames / sampleRateHz`. Otherwise both are
null. Invalid bounds or missing required chunks produce a decode error.
The browser handles playback. Evidence includes demo `bang.wav`.
