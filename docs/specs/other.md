# Other archive entries

Specification revision **1.0** · [conventions](README.md).

PNG and BMP have browser image previews with `decode.status: "media"`.
The viewer hands the bytes to the browser's image decoder and does not
extract image metadata into `data`. See the [PNG specification](https://www.w3.org/TR/png-3/)
and Microsoft's [bitmap storage description](https://learn.microsoft.com/en-us/windows/win32/gdi/bitmap-storage).

Other unrecognized extensions have `decode.status: "unidentified"`.
`format` is the lowercase extension or `unknown` when there is no
extension. Their records describe archive identity and reference evidence.
The viewer does not infer an internal layout.
