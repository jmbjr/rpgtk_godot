# GIF · image metadata

Specification revision **1.0** · [conventions](README.md).
The [GIF89a specification](https://giflib.sourceforge.net/gifstandard/GIF89a.html)
defines the file layout. The viewer accepts GIF87a and GIF89a.

The partial record reads the logical screen dimensions and global
palette entry count. Each image descriptor produces a frame with
`x`, `y`, `width`, `height`, `interlaced` and `localColors`. The most
recent applicable graphic-control extension adds
`delayCentiseconds`, `disposalMethod` and `transparentIndex` (null
when the transparency flag is clear). Coordinates are pixel offsets
from the logical screen's top left. Missing palettes have count zero.
LZW image data and extension payloads remain with the browser decoder.

Decoded data contains `signature`, `width`, `height`, `globalColors`,
and `frames`. Invalid descriptors, truncated sub-blocks and missing
trailers produce decode errors. Evidence includes the demo's
`title.gif` and explosion GIFs.
