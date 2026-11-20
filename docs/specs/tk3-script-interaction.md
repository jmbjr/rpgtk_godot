# Shared Toolkit 3 RPGCode runtime

[Roadmap #123](https://github.com/jmbjr/rpgtk_godot/issues/123).
GAM startup, item Talk, inline/file-backed BRD programs, GAM keys and
encounter continuations use one compiler and runtime. Direct board diagnostics
changes whether startup runs. Game identities and script names do not select
alternate execution paths.

## Pinned source evidence

The implementation was checked against Toolkit 3.1 revision
[`9191b9191c9bda0998c6faae16929b3331ed2ead`](https://github.com/chrisbmatthews/rpgtoolkit/tree/9191b9191c9bda0998c6faae16929b3331ed2ead).
These are source inspections; native editor/runtime acceptance was not performed.

| Behavior | Primary source at that revision |
| --- | --- |
| Tokens, operator precedence, free methods, for, return and switch | [lex.txt](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/lex.txt), [yacc.txt](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/yacc.txt) |
| Local-over-global resolution, by-value parameters, call/return, indexed names and eager operators | [CProgram.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CProgram.cpp#L332) |
| Text position `(x-1)*fontSize`, font/style, clear, window graphic, media and cursor-map functions | [functions.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/functions.cpp#L522) |
| Cursor points, zero-based results, wrapping arrows, Enter/Space | [CCursorMap.cpp](https://github.com/chrisbmatthews/rpgtoolkit/blob/9191b9191c9bda0998c6faae16929b3331ed2ead/vc/trans3/rpgcode/CCursorMap.cpp#L43) |

## Implemented language

[Compiler](../../tk3-language.mjs) and [runtime](../../tk3-script-slice.mjs)
use tokens and bounded bytecode, without JavaScript eval. Physical source paths
and lines remain attached to instructions, including included helpers.

- Case-insensitive names, numeric and quoted string literals, native `#`
  prefixes, semicolon/newline separators, same-line braces, inline/block
  comments, and `_` line continuation.
- Arithmetic and bitwise operators, comparisons (`==`, `~=`), logical
  operators, ternary expressions, compound assignments and prefix/postfix
  increment/decrement. `^` is exponentiation, left-associative as in yacc;
  backtick is XOR. Native RPN logical and ternary operands evaluate eagerly.
  Branches use numeric conversion. `+` adds numeric operands or joins literals.
  Unset values read as numeric zero or an empty literal according to context.
- `if/elseif/else`, `while`, `until`, `for`, and block-style `switch/case/default`.
  Switch chooses the first matching case without C-style fallthrough;
  default must be last in this supported grammar.
- Project-rooted explicit includes, forward-declared free methods, overloads
  by arity, scalar by-value parameters, local/global scalar references,
  return values, recursive calls and indexed scalar names. Includes remain
  declaration-only. Ordinary undeclared variables use the shared global heap;
  method parameters and explicit locals belong to their current call frame.
- Call frames and partially evaluated expressions survive dialogue input,
  cursor selection, Send and encounter effects. Reset creates a fresh session.

The compiler validates syntax, method availability and supported argument counts
before execution. `dirSav` and `load` are recognized but produce a source-linked
unsupported-save diagnostic **if reached**. They never pretend to load a game.
Other unknown commands or unsupported syntax are compile diagnostics. Runtime
faults preserve globals already assigned and release the active script.

## Browser services

The common player effect handler supports `mwin`, `wait`, `mwinCls`, `Send`,
`fightEnemy` and `eraseItem`, plus these title services:

- `fontSize`, `bold`, `clear`, `text`, `pixelText`, `colorRGB` draw an RPGCode
  surface. Positive decoded GAM display dimensions are used, with a 640×480
  fallback and a 4096-pixel bound per dimension. Text uses browser Arial and
  Toolkit positions; font metrics and the drawn cursor are approximations.
- `createCursorMap`, `cursorMapAdd`, `cursorMapRun`, `killCursorMap` preserve
  source points and zero-based selection. Arrows wrap; Enter/Space confirms.
  Accessible touch buttons use nearby source-drawn text as their labels.
  The runtime supplies the selected index to the suspended expression.
- `winGraphic` supplies the archive image behind the browser dialogue panel.
  `menuGraphic` and `fightMenuGraphic` retain native menu configuration.
  `spriteTranslucency` retains its setting/getter; native sprite-overlap
  rendering and native menu/fight plugins remain outside this slice.
- `mediaPlay` loops project-resolved MIDI or WAV using the existing MIDI
  synthesizer or browser audio; `mediaStop` stops it. Read failures and browser
  playback errors remain visible. Assets are read lazily from the active ZIP.
  Resources survive board remounts and are disposed on reset, exit or close.
- `end`/`done` end the current program, including its method frames.
  `windows` exits the browser play session; Reset can start it again.

These services run for any supported source program. Title wording, choices,
branches and state changes come from archive RPGCode. No game-specific
recognizer or parallel title interpreter is involved.

## Bounds and remaining scope

The old 300-line limit is removed. Separate bounds are 1 MiB of aggregate source,
100,000 tokens/instructions, 32 source files, 64 nesting/call levels, 8,192 stored
values/operand slots, 65,536 characters per string and 1 MiB of accounted session
characters. A run is limited to 20,000 instructions between yields and 250,000
instructions across its continuation between real presented graphics frames. Diagnostics identify the actual source.
A non-yielding loop faults instead of blocking the UI indefinitely.

Classes, script-defined objects, by-reference parameters/returns, implicit
library calls, native threads, native error recovery, save/load, plugins,
canvas/image APIs beyond the documented slice, party management and board-entry execution remain
unsupported. Finite-number checks and bounds are browser policies. This is a
larger generic subset, not full native Toolkit equivalence.

## Verification and owner acceptance

`check-tk3-language.mjs` exercises expressions, indexed values, loops, switch,
recursive/overloaded methods, eager operator effects, local/global scope,
continuations and separate resource bounds. `check-tk3-player-services.mjs`
checks rooted lazy media lookup and disposal, including an in-flight close.
Existing generic runtime and Explorer/media checks remain in CI.

The generated **TK3 Title · Harbor** and **TK3 Title · Grove** downloads have
independent project layouts, control flow, names, text and sound. Each calls a
350-line included helper, pauses, returns its result, and exposes startup state
to Talk. Staged Chromium tests keyboard/touch choices, source text, MIDI/WAV,
reset during dialogue, New Game, Talk, movement, explicit unsupported save,
exit and direct diagnostics. The title source is synthetic and public.

The unchanged local owner ZIP `demo_tk310_start_board_playable(1).zip`, SHA-256
`367302f4819b3bfde8e434d22561d61e03cd83f92a38cb18a3dd7aa27a55dc3f`, passed
**Play → original source-drawn title with MIDI → New Game → intro wait →
GAM-configured board** in staged Chromium. Old-man Talk, authored Send,
explicit simulated pirate victory/removal, defeat and fresh startup restart
also passed. Selecting Load gives a source diagnostic. No native battle,
plugins or saved game were executed. The private ZIP/assets/source stayed local.
The owner performs deployed acceptance after merging.

[Historical first-slice report](tk3-script-interaction-history.md) preserves the
original source audits, Send coordinate evidence and earlier fixture checkpoints.
The current Talk selector still uses an inclusive 46-pixel same-layer range;
that range and the browser's 9-pixel collision circle are browser policies,
not native activation geometry.


## Canvas and live-input extension

[Canvas/input coverage and evidence](tk3-canvas-input.md) adds offscreen handles,
image/color-key blits, pixel/RGB outputs and live pointer/key polling to these
same services. Drawing a screen frame yields real browser time and resets the
continuation instruction counter; pure loops and non-presenting service loops
remain bounded. The supplied TK3 M/G programs are local checkpoints. Input
command registration at the pinned native revision remains an explicit evidence
gap; the document separates that from source-verified canvas signatures.
