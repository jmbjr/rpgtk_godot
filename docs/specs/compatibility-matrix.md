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
| [BRD](brd.md) text 2.0 | **Partial.** Source and fixed-size fixture verify the 19 × 11 × 8 grid and references. | The [3.0.4 development reader][board304] reads it directly. The [3.1 editor][board31] directs old text boards through a re-save in 3.0.6 or earlier. | Verify a real text 2.0 sample and compare the upgrade output. |
| BRD text 2.1 | **Partial.** Cluetest, 59 DustBall boards and an asymmetric fixture verify dimensions, tile order and indexed links. | Same upgrade path. The [3.0.4 reader][board304] reads stored width and height before the grid. | Compare the unexported tile types, placement conditions, start coordinates and tail fields against converter output. |
| BRD binary 2.2 | **Partial.** Demo, Cluetest and fixture verify grid and indexed links. | The [3.1 reader][board31] opens the pre-vector layout and translates legacy placements and tile types for the newer editor. | Check fidelity of tile types and legacy conditions separately from visual placement. |
| BRD binary 2.3 | **Partial.** The viewer accepts the header and reads the same prefix as 2.2. Dedicated fixture pending. | The [3.1 reader][board31] uses the pre-vector branch with [version-dependent tail fields][board-tail]. | Verify a real 2.3 file or controlled fixture, especially the tail boundary. |
| BRD headerless fallback | **Open.** The legacy board reader documents a separate fallback. | The [3.0.4 development source][board304] has a separate version-1 route. | Establish which files were still valid Toolkit 2 input before adding a reader. |
| [PRG](prg.md) Toolkit 2 source | **Partial.** Demo, Cluetest and DustBall verify source display and static indexing. | The [RPGCode updater][prg] rewrites legacy syntax, including functions, variable typing and comments. | Audit supported legacy syntax and file-taking commands. Runtime behavior and conversion of executable code are separate. |

## Actors, items, and combat

| Type and revision | Viewer and evidence | Toolkit 3 compatibility path | Remaining confirmation |
| --- | --- | --- | --- |
| [TEM](tem.md) text 2.2, embedded and referenced walking art | **Partial.** Four DustBall characters verify the embedded branch. Both graphics layouts have synthetic fixtures. | The [3.1 character reader][tem-text] reads both paths. It extracts embedded pixels to tilesets and builds newer animation assets from the old graphics. | Obtain a real size-1 sample and verify battle, rest and custom art. |
| TEM text 2.0/2.1 | **Open.** Older branches are visible in source. | The [character reader][tem-text] has an embedded path without the later size field and a 2.1 branch with smaller referenced battle graphics. | Verify revision and size combinations with samples or controlled saves. |
| TEM binary 2.3 / 2.4 | **Partial.** Demo and Cluetest, with fixtures for both widths of the level-type field. | The [binary character reader][tem-bin] reads the one-byte 2.3 field and the four-byte 2.4 field, then converts old character graphics. | Compare unexported progression, conditions and battle/custom graphics. |
| [ITM](itm.md) text 2.0 | **Fixture.** Embedded walking and rest tiles, item settings and script links verified. | The [3.0.4 item converter][itm-text] defaults to embedded graphics and extracts tiles to a generated tileset. | Verify a real text 2.0 sample and the converter's output references. |
| ITM text 2.1 | **Sample and fixture.** 75 DustBall items verify embedded and absent tiles. A fixture exercises external top/bottom filenames. | The [item converter][itm-text] reads the size code and branches between embedded tiles and referenced art. | Verify a real item with referenced pairs and check any unparsed trailing fields. |
| ITM binary 2.2 / 2.3 | **Sample and fixture.** Demo items cover both numeric widths and indexed references. | The [3.1 item reader][itm-bin] branches on minor 3 for wider values and converts the legacy graphic slots. | Check remaining trailing fields and asset fidelity against converted output. |
| [ENE](ene.md) text 2.0 | **Sample and fixture.** Two observed tail lengths, including a variant with animation slots. | The [3.1 enemy reader][ene] converts the legacy tile grid into newer graphics and reads animation names after four skipped sound slots. | Confirm short-tail behavior in the editor and whether the conversion preserves source sound behavior. |
| [BKG](bkg.md) text 2.0 | **Sample and fixture.** Tile grid, shade and audio slots in Demo and DustBall. | The [3.1 background reader][bkg] reads the text grid, audio slots and shades and builds a tile bitmap. | Compare converted tile geometry, shades and sound slots. |
| [SPC](spc.md) text 2.0 | **Sample and fixture.** Editor evidence verifies display of the two use flags on the Demo move. | The [3.1 special-move reader][spc] opens text fields and labels the two use slots differently from the observed Toolkit 2 editor. | Verify the two flags with controlled editor saves and retain their stored values. |
| [STE](ste.md) text 2.0 / binary 2.2 | **Sample and fixture.** Six DustBall text effects and the binary editor sample verify flags, signed amounts and script fields. | The [status-effect reader][ste] handles both encodings and reads the same field sequence. | Verify any other observed revisions before expanding the accepted set. |

## Tiles, art, and animation

| Type and revision | Viewer and evidence | Toolkit 3 compatibility path | Remaining confirmation |
| --- | --- | --- | --- |
| [TST](tst.md) version 20, detail 1 | **Sample and fixture.** RGB24, indexed positions and transparency are verified. | The [tile reader][tst] reads one-based entries and the transparent RGB sentinel. | Compare palette and 16 × 16 variants before extending the tileset record. |
| TST version 20, detail 2 and palette details 3–6 | **Open.** The [tile reader][tst] branches on these details. | Direct read branches exist for smaller RGB and indexed tiles. | Obtain Toolkit 2 samples or controlled fixtures and verify the palette and transparent index. |
| [GPH](gph.md) text 2.0, details 1–2 | **Sample and fixture.** RGB and run expansion verified across observed and synthetic cases. | The [tile reader][gph] reads raw and compressed true-color tiles. | Obtain real samples for fixture-only variants. |
| GPH text 2.0, details 3–6 and version-1 fallback | **Open.** Source branches are present. | The [tile reader][gph] includes palette and older paths. | Confirm palette mapping, transparency and relevant Toolkit 2 inputs. |
| [TAN](tan.md) binary 2.0 | **Sample and fixture.** Timing field and ordered tile references. | The [animated-tile reader][tan] reads the pause and counted tile names. | Confirm timing units and preview behavior independently of decoding. |
| [ANM](anm.md) text 2.0 | **Sample and fixture.** Stored count, 51 slots, colors, audio and pause. | The [animation reader][anm] reads the 51-slot text profile and a later binary profile. | Verify whether other text revisions occur in Toolkit 2 projects before extending the parser. |
| [FNT](fnt.md) text 2.0 | **Sample and fixture.** 256 eight-row glyphs. | The [font reader and writer][fnt] use the same glyph grid. The reader consumes version fields without gating the grid on their values. | Establish a sample before claiming additional revisions. |
| TBM, ISO and later layouts | **Inventory only** for recognized archive entries without a decoder. | The [tile bitmap reader][tbm] requires a Toolkit 3 signature. The [tile reader][tst] also handles version 30 isometric tilesets. | Keep these on the Toolkit 3 track unless a verified Toolkit 2 producer or reader establishes an overlap. |

## Packaging, media, and project extras

| Input | Viewer status | Compatibility boundary |
| --- | --- | --- |
| Plain ZIP and observed Toolkit installer wrapper | Demo/Cluetest plain ZIP and DustBall installer evidence. DustBall's nested ZIP contains a single executable with a ZIP payload described by a `CMP1` footer. The viewer extracts the payload as data. | Compare other package layouts separately. No claim of coverage for protected archives or other executable wrappers. |
| GIF, JPEG, WAV, MIDI, PNG/BMP, DOC | [Format index](README.md) documents decoded metadata and previews where available. | These use their own format rules. DustBall's `smash_glass.wav` declares 21,175 bytes in its RIFF size, while the extracted file contains 16,870 bytes. Track that as a media integrity case. |
| [Temporary `.___` board scratch data](temporary-board.md) | Demo's observed shape parses. DustBall's `Boards/temp.___` still fails its record validation. | Producer and lifecycle are unverified. Compare the scratch records independently of BRD compatibility. |
| Saves, auxiliary data, unknown files | Inventory only unless a documented decoder applies. | Identify a Toolkit 2 reader and an attributable sample before promoting a new format into the matrix. |

## Verification order

1. Obtain fixtures for known Toolkit 2 variants with the highest impact
   on previews and references, including binary BRD 2.3 and older palette
   tiles. Confirm variant provenance before changing a decoder.
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
