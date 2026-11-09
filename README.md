# RPG Toolkit 2 · Game Explorer

A static viewer for issue #3. Run `npm ci` to prepare the optional sound-bank
player, then serve the repository root with Python 3 and open
`http://localhost:8000` in a browser.

```sh
npm ci
python3 -m http.server 8000
```

Choose the game ZIP and optionally its separate Main File. The viewer reads
both files in browser memory. It indexes RPGCode source and resolves the
startup fields of binary Main File format 2.2. Browse the archive by folder.
Programs retain the command reference and source line jumps. Tilesets,
animated tiles, characters, enemies, items, and boards have file-specific previews. Select a
reference to jump to its source file, line, or numbered tile.

The connection index covers literal references in supported RPGCode
commands, configured Main File bindings, animation frames, board tile
placements, directional links, board program and item references, and
the decoded character fields. The map displays the static tile layers and
the first frame of animated tiles. **Tilesets used** includes direct tiles
and animation frames. Other folders remain browsable.

Format sources at the reviewed Toolkit 3 revision include the
[tileset reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/tkCommon/tkGfx/CTile.cpp#L1189-L1252),
[animation reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonTileAnim.bas#L88-L100),
[character reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vb/tkCommon/modules/CommonPlayer.bas#L527-L686),
and [board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/common/board.cpp#L575-L851).

## Smoke test

With Node.js 22 or later, run the fixture checks directly.

```sh
node scripts/smoke.mjs /path/to/Demo.zip /path/to/Demo.gam
```

Then check the browser workflow.

1. Open the supplied `Demo.zip`. Confirm 51 programs and the **Demo default**
   at `Demo/Prg/start.prg`.
2. Confirm 65 calls across 28 built-ins. Select `#SetButton` and jump to lines
   83, 84 and 85. Verify the local call at 33, the inline `#Dos` at 66 and the
   commented-out MIDI example at 26.
3. Open the supplied `Demo.gam`. Confirm **Configured startup**, with
   `Demo/Boards/house1.brd` and `Demo/Chrs/frap.tem` in the project bindings.
4. Select another program and verify its own source and command graph.
5. Choose **Tiles**, then `water2.tan`. Preview it and open its first frame.
   Confirm it selects tile 33 of `water.tst` and shows the reverse link.
6. Choose **Chrs** and `tano.tem`. Follow its **Used by** link to
   `getTano.prg:10`. Open `default.tst` and confirm `house1.brd` is a consumer.
7. Open `house1.brd` from **Boards**. Toggle layers and follow **Used by**
   to the incoming warp and Main File reference. Under **Tilesets used**,
   confirm `default.tst`. Open `castle_out.brd` and look for `water.tst`
   through `water2.tan`.
8. Open `larva.ene` under **Enemy**. The composite is four by two tiles.
   Expand **Source tiles** and follow a tile to its numbered tileset entry.
   Open `kid1.itm` under **Item** and use the direction and frame controls
   or play its walk. Open `keystone.itm` to check the standalone-tile sprite.
   The two Evil Thing definitions report their missing GPH source files.
9. Open **Media** → `VIP - Title2.mid`, the track referenced by the demo
   startup program. Use **Play MIDI** and adjust **MIDI tone** while it
   plays. Use the same button to pause and resume, and **Reset MIDI to
   beginning** to rewind. The WAV inspector has matching controls. Try **Bypass EQ** to compare the unfiltered sound, then toggle
   it off to return to the chosen settings. Stop, replay, and switch to
   another file to confirm playback stops and the settings carry over.
   **Reset EQ** restores flat playback. Expand **MIDI tracks** to see each
   file track's instruments, channel, note counts and ranges. Open
   `VIP - Title1.mid` to see several instruments in one track. Expand
   **Piano roll** while it plays, turn **All instruments** off, and turn on
   the clarinet on channel 7. Try changing its color with the picker.
   Check that the playhead and note highlights follow playback, pause,
   and reset. Track and tempo data are also under **View decoded JSON**.
10. Open `temple.bkg` under **Bkrounds**. Compare the pool, pillars and
    floor shadows against the Toolkit 2 editor. Check the linked menu sounds
    and the missing battle music reference. Open **Font** → `BASE.FNT` and
    type a sample. Under **Misc**, open `explode.anm` and step to frame 2 of
    8 to find `bang.wav`. Play the animation and listen for the sound on
    frame 2. Playback stops on the last frame by default. Check **Loop**
    to repeat it. Pause or switch files to stop playback and audio.
    Under **SpcMove**, check `attackall.spc` against the editor screenshot
    and follow its program and effect animation links.
11. Repeat on the GitHub Pages deployment. Test an unreadable ZIP and a
    truncated Main File, then select valid files again to verify recovery.

The demo files are supplied separately. The graph shows static source use.
It does not evaluate RPGCode or infer reachability for other programs.

## Compare MIDI sound banks

Open `VIP - Title1.mid` under **Media** and listen for the strings, harp, and
clarinet in the first ten seconds. **GeneralUser GS 2.0.3** is selected by
default. Press **Play MIDI** to download the 32 MB bank on first play and
reuse it for the page session. You can also choose a local `.sf2` or `.dls`
file. Switch to **Built-in synth** and press **Play MIDI** to
replay the same passage. **Bypass EQ** compares the synths with flat EQ.

The optional player uses SpessaSynth on HTTPS or localhost and loads only
when you play with a sound bank. The site bundles the player and its license
notices. The MIDI and any local bank remain on your device.

The site serves an unmodified copy of [GeneralUser GS](https://www.schristiancollins.com/generaluser.php)
by S. Christian Collins, pinned to upstream commit
`684543d5e5efaef08d02be50dcda8d552478fa60`. The bank and its
[original license](vendor/generaluser-gs/LICENSE.txt) are in `vendor/generaluser-gs/`.

## Follow MIDI notes

**Piano roll** loads Magenta's SVG visualizer on demand. Each bar shows a
MIDI key hold from note-on to note-off. Toggle all parts or individual
instrument parts, and use each color picker to recolor its notes. A part
is identified by MIDI port, channel, and program. These controls affect
the display. The playhead uses the active player's clock, including
GeneralUser GS and the built-in synth.

## Refresh the command catalog

Run the generator with the reviewed feature baseline and the two REF files,
oldest first. It records source identifiers and indexes the reference
signatures when supplied. Feature assignments outside the demo’s reviewed
trace are grouped by the source event category and can be refined in the
generator.

```sh
python3 scripts/build_catalog.py path/to/RPGTK_2x_Feature_Baseline.md \
  path/to/RPGCODE.REF path/to/rpgcodeEN.ref --output catalog.json
```

The bundled ZIP reader is JSZip 3.10.1 under its MIT option.
See [license](vendor/JSZip-LICENSE.md).

## Decoded JSON records

**View decoded JSON** opens a versioned record for the selected file.
The separately supplied Main File has its own section beside the project
bindings. The panel is collapsed initially and builds JSON when opened.

Every record has `schemaVersion`, `$id`, `path`, `format`, `decode`, `data`,
and `references`. IDs use `rpgtk:/` plus the URL-encoded archive path.
A separately supplied Main File uses `rpgtk-main:/`. These IDs are stable
within a project. A consumer can use the ID as a lookup key for a record.
The optional fragment is a JSON Pointer into that record. For example,
`rpgtk:/Demo/Tiles/default.tst#/data/tiles/9` points to one-based tile 10.
The board has a tile lookup table whose entries carry these references.
A board run uses a zero-based cell offset in layer, row, column order
and refers to a zero-based index in that lookup table.

Reference records preserve the original value, evidence, resolution status,
and the source line when available. Resolved references include a target.
The coverage status distinguishes decoded data, partial interpretation,
decoder errors, media, accompanying documents, and unidentified entries.

| Format | Main fields in `data` |
| --- | --- |
| GAM | Format version, project path, title, language, startup, board, character |
| PRG | Source lines, indexed symbols and their occurrences, built-in call count |
| TST | Dimensions, tile count, transparency key, numbered tiles with base64 RGB24 pixels in column order |
| TAN | Stored speed and ordered frame references |
| TEM | Name, stats, portrait and walking frames, with additional decoded asset references |
| BRD | Dimensions, layer titles, shading, background color, tile lookup and placement runs |
| ITM | Name, description, use modes, prices, modifiers, programs, walking and rest graphics |
| ENE | Stats, graphic tile slots, AI, special moves, weaknesses, rewards, sounds and animations |
| BKG | Dimensions, column-ordered tile names, matching RGB shading, audio fields |
| SPC | Name, power, cost, raw use flags, editor-style battle and board flags, program, animation and description |
| ANM | Dimensions, stored frame count, frame slots, transparent colors, sounds and pause |
| GPH | Dimensions, encoding, compression flag and expanded column-ordered color values |
| FNT | 256 glyphs, each with eight stored row bytes |
| GIF | Logical screen size, palette sizes, frame positions and graphic-control fields |
| JPG | Frame size, sample precision, coding marker and component sampling |
| WAV | RIFF chunk table, format fields, and PCM sample count and duration |
| MID | SMF timing division, track metadata, and note counts and ranges grouped by channel, port and program |
| DOC | Compound container version, sector sizes and directory entry names and sizes |
| `___` | Observed numeric header and repeated tile-name/three-value records, with source line references |

The battle background preview applies per-tile RGB lighting. The font preview
shows all 256 glyphs in byte order and supports ASCII sample text. Animation
previews use the stored dimensions and frame delay, key out the stored
transparent color, and play each frame's assigned sound during animation
playback. Each sound also links to its own media inspector.
The special move's use flags follow the Toolkit 2 editor display verified with
`attackall.spc`. The raw flag order is also available in JSON.

All 153 archive entries and the separate GAM have structured records. Media
decoders expose container and track or frame metadata. The browser renders
images and plays WAV and MIDI audio. The MIDI preview supports Standard MIDI
File formats 0 and 1. It uses a General MIDI-style Web Audio synth, so timbres
can differ from the original Windows setup. The viewer starts with flat EQ
and provides live bass, mid, and treble controls. Settings carry over between
tracks during the current page session. The track summary uses General MIDI
program names, counts positive-velocity note-on events, and shows MIDI key
numbers for percussion. The player previews channel messages
and timing. System Exclusive messages are skipped. The DOC record describes
its compound container.
`Boards/temp.___` uses a fixture-specific text reader and is marked partial
because its producer and field semantics are unverified. Legacy engine
behavior and fields beyond the documented slices remain outside the viewer.

Media format sources include the
[GIF89a specification](https://giflib.sourceforge.net/gifstandard/GIF89a.html),
[JPEG specification](https://www.w3.org/Graphics/JPEG/itu-t81.pdf),
[RIFF/WAVE format fields](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.2088-2-202511-I%21%21PDF-E.pdf),
[Standard MIDI File field guide](https://midi.community/docs/smf/),
and [Microsoft Compound File Binary format](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b).

The MIDI preview bundles [WebAudio TinySynth](https://github.com/g200kg/webaudio-tinysynth)
1.1.4 at commit `3d75aee4b3f43cbd932265e7d60201fd5b770397` under the Apache 2.0 license.
The vendored constructor accepts the existing `internalcontext` setting so
the viewer can route the synth through its own audio graph. Both the synth
and the selected MIDI bytes run locally in the browser.
