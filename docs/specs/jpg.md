# JPG/JPEG · image metadata

Specification revision **1.0** · [conventions](README.md).
See the [JPEG specification](https://www.w3.org/Graphics/JPEG/itu-t81.pdf)
for marker and segment layout. The two extensions share one decoder.

The viewer verifies SOI and scans marker segments, using big-endian
lengths, to the first recognized Start of Frame. The partial record
contains `width`, `height`, `precisionBits`, `frameMarker` (hex string),
and `components` entries with `id`, `horizontalSampling`,
`verticalSampling` and `quantizationTable`. Dimensions are pixels.
The reader checks segment and component lengths. It stops before
entropy-coded data. The browser supplies image rendering.

Evidence includes demo `mountains.jpg`.
