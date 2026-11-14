# Toolkit 2 compatibility matrix

This audit compares the viewer's decoded records with the Toolkit 3
legacy compatibility code for [issue #41](https://github.com/jmbjr/rpgtk_godot/issues/41).
Version numbers below identify **file layouts**, which can differ from
the Toolkit release that wrote them.

## Evidence and status

- **Sample** means a real Toolkit archive or editor-saved file was checked
  with the viewer. **Fixture** means a synthetic case checks the documented
  layout. **Source** means the branch was traced in the pinned code.
- **Partial** identifies a readable layout where the viewer exports a
  subset of fields, artwork, or static references. **Open** identifies a
  confirmed or suspected gap with a specific follow-up.
- The comparison uses the [3.0.4 development snapshot][304] and
  [3.1-era source snapshot][31]. Descriptions of what the converters do
  come from source inspection. Running the historical editors and
  comparing converted outputs is a separate validation step.
- The [format index](README.md) links the byte layouts, record schemas,
  and fixtures. Native Toolkit 3 format coverage belongs to the Toolkit 3
  comparison.

## Project, boards, and scripts

| Type and revision | Viewer and evidence | Toolkit 3 compatibility path | Remaining confirmation |
| --- | --- | --- | --- |
| [GAM](gam.md) text 2.0 | **Partial.** DustBall and fixture verify startup, board and character. | The 3.1 [Main File reader][main] reads the text `mainForm` profile and continues into runtime and battle settings. It has an older fallback. | Compare title and remaining settings against controlled saves. Verify the accepted text signatures independently. |
| GAM binary 2.2 | **Partial.** Demo.gam and fixture verify startup bindings, title, project path and language. | The 3.1 [reader][main] has a binary legacy branch and reads fields beyond the viewer's stopping point. | Inventory and verify remaining project configuration and any older Main File layouts. |
| GAM binary 2.9 (Toolkit 3) | **Partial source + synthetic fixture.** [Issue #80](https://github.com/jmbjr/rpgtk_godot/issues/80) and [issue #79 BSTW sample inventory](https://github.com/jmbjr/rpgtk_godot/issues/79) identify the root GAM and three startup paths; synthetic test verifies the different 4-i16 prefix and resolved edges. | The pinned [3.1 Main File reader][main] omits the old parallax i16 for minor >= 3. | BSTW GAM 2.9's complete 1,963-byte configuration tail and plugin slot table have been source-guided byte-verified; the five declared/ seven bundled DLL distinction is retained. Native BRD 2.4, TEM 2.8 and ANM 2.3 are separately decoded. Plugin interfaces, DLL execution and runtime behavior remain out of scope. |
| [BRD](brd.md) text 2.0 | **Partial.** Source and fixed-size fixture verify the 19 × 11 × 8 grid and references. | The [3.0.4 development reader][board304] reads it directly. The [3.1 editor][board31] directs old text boards through a re-save in 3.0.6 or earlier. | Verify a real text 2.0 sample and compare the upgrade output. |
| BRD text 2.1 | **Partial.** Cluetest, 59 DustBall boards and an asymmetric fixture verify dimensions, tile order and indexed links. | Same upgrade path. The [3.0.4 reader][board304] reads stored width and height before the grid. | Tile types (including empty cells), placement conditions and start coordinates are now exported and fixture-verified; compare remaining tail fields against editor output. |
| BRD binary 2.2 | **Partial.** Demo, Cluetest and fixture verify grid and indexed links. | The [3.1 reader][board31] opens the pre-vector layout and translates legacy placements and tile types for the newer editor. | Raw tile types and program/item conditions are now preserved and fixture-verified; compare actual runtime behavior separately. |
| BRD binary 2.3 | **Partial.** A historical demo board and fixtures verify the common prefix, counted thread slots and the raw coordinate byte. | The [3.1 reader][board31] uses the pre-vector branch with [version-dependent tail fields][board-tail]. | Compare coordinate interpretation with an isometric sample. |
| BRD binary 2.4 (Toolkit 3) | **Source-backed complete record decoding; runtime partial.** All 9 BSTW native boards read to EOF. Start/start2 each contain 7 placed ITM sprites, 3 scripted door interactions, player start (107,78,1), music, vectors, layer/ambient settings and 11 constants. Synthetic CI validates source fields, conditions, graph/JSON edges, raw positions and invalid tails. | [Pinned native Toolkit 3 vector-board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L486-L791) defines the complete tile, lighting, vectors, native program/sprite/image slots, backgrounds, directional links and starting position. | Pixel code 4 includes toggleable numbered item/start markers with layer filtering. Editor/runtime placement parity, conditions, collision, and rotated/isometric projection remain unverified. |
| BRD headerless fallback | **Open.** The legacy board reader documents a separate fallback. | The [3.0.4 development source][board304] has a separate version-1 route. | Establish which files were still valid Toolkit 2 input before adding a reader. |
| [PRG](prg.md) Toolkit 2 source | **Partial.** Demo, Cluetest and DustBall verify source display and static indexing. | The [RPGCode updater][prg] rewrites legacy syntax, including functions, variable typing and comments. | Audit supported legacy syntax and file-taking commands. Runtime behavior and conversion of executable code are separate. |

## Actors, items, and combat

| Type and revision | Viewer and evidence | Toolkit 3 compatibility path | Remaining confirmation |
| --- | --- | --- | --- |
| [TEM](tem.md) text 2.2, embedded and referenced walking art | **Partial.** Four DustBall characters verify the embedded branch. Both graphics layouts have synthetic fixtures. | The [3.1 character reader][tem-text] reads both paths. It extracts embedded pixels to tilesets and builds newer animation assets from the old graphics. | Battle/rest/custom frames now preserved with source references; obtain a real size-1 text sample. |
| TEM text 2.0/2.1 | **Partial, fixture.** Text 2.0 embedded and text 2.1 embedded/referenced walking art, stats, portrait and static references are verified. | The [character reader][tem-text] has an embedded path without the later size field and a 2.1 branch with smaller referenced battle graphics. | Battle/rest/custom art is now fixture-verified; obtain real 2.0/2.1 samples and compare remaining conditions/progression. |
| TEM binary 2.3 / 2.4 | **Partial.** Demo and Cluetest, with fixtures for both widths of the level-type field. | The [binary character reader][tem-bin] reads the one-byte 2.3 field and the four-byte 2.4 field, then converts old character graphics. | Battle/rest/custom graphics are now preserved and fixture-verified; compare unexported progression and character move conditions. |
| TEM binary 2.8 (Toolkit 3) | **Partial, real BSTW plus synthetic fixture.** All 8 sample characters have the 2.8 header; Bruce's portrait, South/North/East/West ANMs, idle timing and two raw vector bases are source-verified. | The [pinned native reader][tem-bin] switches at minor >= 5 to animation filenames, adds standing animations at >= 6, timing at >= 7, and vector bases at >= 8. | Render four cardinal directions via linked ANMs/TSTs; later animation semantics, movement physics and editor parity deferred. |
| [ITM](itm.md) text 2.0 | **Fixture.** Embedded walking and rest tiles, item settings and script links verified. | The [3.0.4 item converter][itm-text] defaults to embedded graphics and extracts tiles to a generated tileset. | Verify a real text 2.0 sample and the converter's output references. |
| ITM text 2.1 | **Sample and fixture.** 75 DustBall items verify embedded and absent tiles. A fixture exercises external top/bottom filenames. | The [item converter][itm-text] reads the size code and branches between embedded tiles and referenced art. | Verify a real item with referenced pairs and check any unparsed trailing fields. |
| ITM binary 2.2 / 2.3 | **Sample and fixture.** Demo items cover both numeric widths and indexed references. | The [3.1 item reader][itm-bin] branches on minor 3 for wider values and converts the legacy graphic slots. | Check remaining trailing fields and asset fidelity against converted output. |
| ITM binary 2.7 (Toolkit 3) | **BSTW sample + synthetic conformance.** All 11 sample files parse to EOF; common fields, native directional/idle/custom ANMs, two vector bases and exact program references preserved. The item inspector previews first linked TST frames and opens ANMs. | [Pinned 3.1 native item reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonItem.bas#L349-L511) replaces old 16-pair graphics with ten ANM names, eight idle names, doubles, custom slots, and vectors. | House 3×3 ANM frames link to newly decoded TBM 3.0 bitmaps and resolved TST tile references; editor/runtime interaction parity remains unverified. |
| [ENE](ene.md) text 2.0 | **Sample and fixture.** Two observed tail lengths, including a variant with animation slots. | The [3.1 enemy reader][ene] converts the legacy tile grid into newer graphics and reads animation names after four skipped sound slots. | Confirm short-tail behavior in the editor and whether the conversion preserves source sound behavior. |
| [BKG](bkg.md) text 2.0 | **Sample and fixture.** Tile grid, shade and audio slots in Demo and DustBall. | The [3.1 background reader][bkg] reads the text grid, audio slots and shades and builds a tile bitmap. | Compare converted tile geometry, shades and sound slots. |
| [SPC](spc.md) text 2.0 | **Sample and fixture.** Editor evidence verifies display of the two use flags on the Demo move. | The [3.1 special-move reader][spc] opens text fields and labels the two use slots differently from the observed Toolkit 2 editor. | Verify the two flags with controlled editor saves and retain their stored values. |
| [STE](ste.md) text 2.0 / binary 2.2 | **Sample and fixture.** Six DustBall text effects and the binary editor sample verify flags, signed amounts and script fields. | The [status-effect reader][ste] handles both encodings and reads the same field sequence. | Verify any other observed revisions before expanding the accepted set. |

## Tiles, art, and animation

| Type and revision | Viewer and evidence | Toolkit 3 compatibility path | Remaining confirmation |
| --- | --- | --- | --- |
| [TST](tst.md) version 20, detail 1 | **Sample and fixture.** RGB24, indexed positions and transparency are verified. | The [tile reader][tst] reads one-based entries and the transparent RGB sentinel. | RGB and palette details 1–6 now share native-size RGB export. |
| TST version 20, detail 2 | **Fixture.** Native 16 × 16 RGB bytes, transparency, addressing and doubled previews are verified. | The [tile reader][tst] uses 768 bytes per entry and the same RGB sentinel. | Verify a real Toolkit 2 sample. |
| TST version 20, palette details 3–6 | **Fixture.** All four indexed branches use the pinned DOS palette; dimensions, transparency, references and PDF output verified. | Reads palette indices and applies index transparency. | Obtain real Toolkit 2 samples; see [palette rules](palette.md). |
| [GPH](gph.md) text 2.0, details 1–2 | **Sample and fixture.** RGB and run expansion verified across observed and synthetic cases. | The [tile reader][gph] reads raw and compressed true-color tiles. | Obtain real samples for fixture-only variants. |
| GPH text 2.0, details 3–6 | **Fixture.** Raw/RLE, dimensions, transparency and normalized colors verified. | The [tile reader][gph] converts details 3/5 but omits palette lookup for 4/6. | Obtain real samples; [documented correction](palette.md) applies palette lookup consistently. |
| GPH version-1 fallback | **Open.** Older source path remains unimplemented. | The [tile reader][gph] has a headerless fallback. | Establish version-1 provenance and controlled fixtures. |
| [TAN](tan.md) binary 2.0 | **Sample and fixture.** Timing field and ordered tile references. | The [animated-tile reader][tan] reads the pause and counted tile names. | Confirm timing units and preview behavior independently of decoding. |
| [ANM](anm.md) text 2.0 | **Sample and fixture.** Stored count, 51 slots, colors, audio and pause. | The [animation reader][anm] reads the 51-slot text profile and a later binary profile. | Verify whether other text revisions occur in Toolkit 2 projects before extending the parser. |
| ANM binary 2.3 (Toolkit 3) | **Real BSTW and synthetic fixture.** South ANM has 51 stored slots, 2 populated `FLcharacters.tst14/15` frames, 32×32, pause 0.15. All 37 BSTW ANMs have revision 2.3 headers. | The [pinned animation reader][anm] reads maximum-index+1 filename/COLORREF/sound triples followed by binary float64 pause. | Indexed TST tile rendering and JSON graph references verified; animation playback against the original editor remains pending. |
| [FNT](fnt.md) text 2.0 | **Sample and fixture.** 256 eight-row glyphs. | The [font reader and writer][fnt] use the same glyph grid. The reader consumes version fields without gating the grid on their values. | Establish a sample before claiming additional revisions. |
| TBM binary 3.0 (Toolkit 3) | **BSTW and synthetic fixture.** Two 252-byte house TBMs have 4×4 inclusive stored records, render 3×3 tiles / 96×96 pixels, and differ only in bottom-center `default.tst48` vs `.tst49`. Source tile references, shades, transparent pixels and ANM composition are covered by CI. | The [pinned Toolkit 3 TBM reader][tbm] stores inclusive rows/columns and signed RGB shades, but native rendering uses only cells with x<width and y<height. | Editor/runtime parity and ambient-light rendering remain unverified; TBM is a Toolkit 3-only profile. |
| ISO and other later layouts | **Inventory only** where no native reader exists. | The [tile reader][tst] also describes version 30 isometric tilesets. | Obtain a verified sample and avoid projecting unverified geometry. |

## Packaging, media, and project extras

| Input | Viewer status | Compatibility boundary |
| --- | --- | --- |
| Plain ZIP and observed Toolkit installer wrapper | Demo/Cluetest plain ZIP and DustBall installer evidence. DustBall's nested ZIP contains a single executable with a ZIP payload described by a `CMP1` footer. The viewer extracts the payload as data. | Compare other package layouts separately. No claim of coverage for protected archives or other executable wrappers. |
| GIF, JPEG, WAV, MIDI, PNG/BMP, DOC | [Format index](README.md) documents decoded metadata and previews where available. | These use their own format rules. DustBall's `smash_glass.wav` declares 21,175 bytes in its RIFF size, while the extracted file contains 16,870 bytes. Track that as a media integrity case. |
| [Temporary `.___` board scratch data](temporary-board.md) | Demo's observed shape parses. DustBall's `Boards/temp.___` still fails its record validation. | Producer and lifecycle are unverified. Compare the scratch records independently of BRD compatibility. |
| Saves, auxiliary data, unknown files | Inventory only unless a documented decoder applies. | Identify a Toolkit 2 reader and an attributable sample before promoting a new format into the matrix. |

## Verification order

1. Obtain fixtures for known Toolkit 2 variants with the highest impact
   on previews and references, including an isometric binary BRD 2.3 sample and
   older palette tiles. Confirm variant provenance before changing a decoder.
2. Check the remaining fields of the layouts already supported. Prioritize
   fields that alter graph links or output, and compare the source values
   with the Toolkit 3 conversion where possible.
3. Record editor-only upgrade paths, validated unsupported inputs, and
   exclusions as the audit progresses.

The latest sample census for this audit found zero decoder errors in
Demo and two in DustBall, both listed above. Cluetest had zero decoder
errors in the preceding compatibility checks. These results describe
the tested archives. Reproduce schema and reference checks using the
[fixture commands](fixtures/README.md).

[304]: https://github.com/chrisbmatthews/rpgtoolkit/tree/08f2fe3d21828ea3519875553a2bad2aa10a7adc
[31]: https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead
[main]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonMainFile.bas#L281-L574
[board304]: https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonBoard.bas#L1016-L1198
[board31]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L434-L484
[board-tail]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBoard.bas#L1011-L1055
[prg]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/Toolkit/modules/modRpgCodeUpdate.bas
[tem-text]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L851-L1082
[tem-bin]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686
[itm-text]: https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonItem.bas#L534-L656
[itm-bin]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonItem.bas#L388-L490
[ene]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonEnemy.bas#L401-L489
[bkg]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonBackground.bas#L165-L208
[spc]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonSpecialMove.bas#L101-L126
[ste]: https://github.com/chrisbmatthews/rpgtoolkit/blob/08f2fe3d21828ea3519875553a2bad2aa10a7adc/vb/tkCommon/modules/CommonStatusEffect.bas#L100-L152
[tst]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1170-L1330
[gph]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L994-L1157
[tan]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileAnim.bas#L71-L103
[anm]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonAnimation.bas#L100-L164
[fnt]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonFont.BAS#L205-L224
[tbm]: https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileBitmap.bas#L163-L201
