# DOC · compound document metadata

Specification revision **1.0** · [conventions](README.md).
The reader inspects the [Microsoft Compound File Binary container](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b)
used by the demo's EULA document.

The partial record contains `container: "CFB"`, `major`, `minor`,
`sectorSize`, `fatSectorCount`, and `miniStreamCutoff`. It accepts
little-endian CFB v3 with 512-byte sectors or v4 with 4,096-byte sectors.
When the header DIFAT covers the FAT, it follows the directory sector
chain and lists nonempty entries as `{ name, type, size }`. Names are
UTF-16LE, and sizes are byte counts. The v4 reader represents its
unsigned 64-bit size as a JSON number, so values above JavaScript's
safe-integer range can lose precision. Out-of-range sectors, loops and
invalid name lengths are errors. If more than 109 FAT sectors are
declared, the record has `directoryStatus` instead of a directory.

The inspected layer is the compound container. Document streams and
rendered content are outside this profile.
