# Toolkit 2 Test Lab

Extract the ZIP into the directory that already contains your Toolkit 2
installation's `Main` and `Game` folders. In the editor, open
`Main/TK2TestLab.gam`. Its stored project path is `Game\TK2TestLab\`.
The project uses the editor installation's standard language and skin files.

Run the game and look for the startup message. Press a key to dismiss it.
The player starts in a room with four colored corners, a solid border, and
a solid interior block. Try walking in all four directions and into the
block. You can also open the ZIP directly in the browser viewer.

The [manifest](manifest.json) lists the five generated assets. The binary
GAM 2.2, BRD 2.2, and TEM 2.3 layouts follow the supplied Demo and pinned
legacy source. The original test artwork uses TST format 20, mode 1.

```sh
node scripts/build-tk2-test-game.mjs dist/tk2-test-game.zip
```

The build reopens the ZIP with the viewer and checks its exact file list,
startup bindings, board placement, transparency, and walking references.
Desktop editor acceptance is pending. Record the Toolkit release and
whether opening, running, and walking work in [issue #63](https://github.com/jmbjr/rpgtk_godot/issues/63).

- [Main File reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/0012b9f9b2093525b4edb42893c5a669cdbb491a/vb/tkCommon/modules/CommonMainFile.bas#L277-L386)
- [Board reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/0012b9f9b2093525b4edb42893c5a669cdbb491a/vb/tkCommon/modules/CommonBoard.bas#L782-L996)
- [Character reader](https://github.com/chrisbmatthews/rpgtoolkit/blob/0012b9f9b2093525b4edb42893c5a669cdbb491a/vb/tkCommon/modules/CommonPlayer.bas#L486-L670)
