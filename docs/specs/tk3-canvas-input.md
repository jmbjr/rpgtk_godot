# Shared RPGCode canvas and input services

Part of [#123](https://github.com/jmbjr/rpgtk_godot/issues/123), following
[the shared language/title checkpoint](tk3-script-interaction.md).
Startup, Talk, board programs, game keys and encounter continuations use the
same compiler, VM and browser services. No archive identity, program filename,
text pattern or title recognizer chooses a graphics implementation.

## Evidence and coverage

Canvas signatures and the direction of output parameters were inspected at
Toolkit revision `9191b9191c9bda0998c6faae16929b3331ed2ead`:

| Implemented surface | Pinned primary evidence |
| --- | --- |
| `text(x,y,str[,canvas])`, `pixelText(x,y,str[,canvas])`, `clear([canvas])` | [functions.cpp 522–670](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L522) |
| `setPixel(x,y[,canvas])`, `fillRect(x1,y1,x2,y2[,canvas])` | [functions.cpp 1689–1793](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L1689) |
| `setImage(file,x,y,width,height[,canvas])` | [functions.cpp 4578–4610](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L4578) |
| `getPixel(x,y,&r,&g,&b[,canvas])` | [functions.cpp 4893–4935](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L4893) |
| `setImageTransparent(file,x,y,width,height,r,g,b[,canvas])` | [functions.cpp 4980–5011](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L4980) |
| `createCanvas(width,height[,&canvas])`, `killCanvas(canvas)`, `drawCanvas(canvas,x,y[,width,height[,destination]])` | [functions.cpp 5800–5940](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L5800) |

**Input evidence boundary:** the supplied TK3 test scripts use `MouseStatus(0)`
for X, `1` for Y, `2` for left button and `3` for right button; they test
`KeyDown("ESC")`, and another supplied program tests simultaneous keys.
Those command registrations were **not located** in the pinned C++ registrar
or the inspected pinned legacy VB `rpgcode.bas`. This release provides an
explicit browser compatibility contract for those observed calls: held-key
polling, one/two-key AND, logical-screen pointer coordinates and button flags.
Native registration/version provenance and original executable parity for
these two command names remain unverified. They are not evidence of a DLL
implementation, and no DLL was executed.

## One service/continuation contract

The compiler emits references for native output-argument positions. The VM
suspends the expression and call frames, then resumes with the service's return
value and RGB/handle outputs. Explicit locals and indexed destinations work;
this does not implement general by-reference user-method parameters. Missing
or malformed service results produce the actual source path/line diagnostic.

[Player services](../../tk3-player-services.mjs) resolve image assets with the
shared typed project resolver and read bytes lazily from the active ZIP.
[Canvas services](../../tk3-canvas-services.mjs) own one RPGCode screen,
numbered offscreen canvases, decoded images and live input. Text, bitmap blits
and pixel reads operate on the same backing pixels. Existing pure-text VM
records synchronize incrementally, preserving draw order around image blits.
Accessibility text records describe the drawn source text; they do not select
branches or modify source variables.

A screen draw yields a real animation frame before its caller resumes. This
lets browser input, close and reset run during source drawing loops. A real
presented frame resets the VM's continuation instruction counter; responsive
animation has no total lifetime instruction cap. Pure non-yielding loops still
fault at the slice budget. Service-only polling loops retain the 250,000-step
continuation budget. Unit tests exceed that many instructions through paced
frames and separately prove that polling without frames is bounded.

Handles/images survive board transfers within a play session. Source
`killCanvas` releases a handle; image caches last until reset/close. Reset,
exit and close release all surfaces, cached images, listeners and scheduled
frames. A pending image decode cannot repopulate a destroyed session. A failed
service ends its active script and leaves the board and diagnostics available.

## Browser policies and limits

- At most 64 offscreen handles, 64 decoded image cache entries, 32 scaled
  color-key cache entries, and 16,777,216 pixels across backing surfaces and
  decoded images. Dimensions must be 1–4096. Image dimensions are checked
  before browser decode, then checked again after decode. Accessibility metadata
  retains the 2,048 most recent text positions per canvas; pixels remain intact.
- PNG/JPEG/GIF/BMP inputs use browser image decoding; animated inputs use the
  browser's decoded bitmap frame. There is no new TBM/TST drawing command.
- Coordinates truncate toward zero, images stretch with nearest-neighbor
  sampling, and rectangles use lower-inclusive/upper-exclusive endpoints.
  Color keys are applied after scaling, matching the pinned intermediate
  canvas order. Out-of-bounds `getPixel` and invalid handles are explicit
  browser diagnostics, not assertions about native error/fallback behavior.
- Before a new program, the browser snapshots its complete board rendering
  into the logical GAM display dimensions. This is a browser approximation;
  native viewport/camera behavior is not claimed. Existing font metrics and
  dialogue-layout approximations remain.
- Pointer coordinates scale from the responsive display into source pixels
  and clamp to its extent. Touch supplies primary-button state. Left/right
  desktop buttons and key chords are supported; blur/visibility changes clear
  held input. **Send Escape** supplies a one-shot ESC to a polling source
  program. It does not force a program to stop. Reset/close can interrupt it.

## Verification and acceptance

`check-tk3-canvas.mjs` covers output references and helper returns, invalid
outputs, a long framed continuation, and bounded polling/pure loops.
`check-tk3-browser.mjs` runs two independently structured synthetic archives:
Harbor opens the scope through its game key; Grove runs its differently
structured drawing loop during startup. Both use native-style image, canvas
and pixel commands. Browser checks assert actual framebuffer pixels,
color-key transparency, local helper outputs, live pointer/chord/touch input,
Escape and caller return, reset/close, project-rooted failures, resource bounds
and cancellation during pending decode/frame work. Prior title, generic player
and connected Explorer/media checks continue to run.

The unchanged local `demo_tk310_start_board_playable(1).zip`, SHA-256
`367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f`, is the
private acceptance input. In staged Chromium:

1. Play → original title/MIDI → New Game → intro → configured board.
2. M / `MouseInfo.prg` displays the original image, live coordinates and RGB,
   click state, and the source-authored lower-left color-key highlight.
   Physical Escape or **Send Escape** returns to the board.
3. G / `test_getPixel.prg` samples the displayed pixels and draws its canvas.
   This source has an unconditional loop; Reset returns to the title.
4. Old-man Talk, authored Send, explicitly simulated pirate victory/removal,
   defeat and fresh startup restart remain regression checkpoints.

Private ZIPs, images, source and DLLs stay local. Only synthetic fixtures are
published. No native Toolkit executable, plugin, save/load or native combat
was run. The owner performs deployed acceptance after merging.
