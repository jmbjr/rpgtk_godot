// Source-guided synthetic GAM 2.9 tail, never copied from BSTW's game data.
// Distinct values make offset errors visible in continuous-integration tests.
const z = value => Buffer.from(value + "\0", "ascii");
const i16 = (...values) => { const b = Buffer.alloc(2 * values.length); values.forEach((v, i) => b.writeInt16LE(v, 2 * i)); return b; };
const i32 = (...values) => { const b = Buffer.alloc(4 * values.length); values.forEach((v, i) => b.writeInt32LE(v, 4 * i)); return b; };
const pack = (...parts) => Buffer.concat(parts);
const runtimeKeys = [
  { key: 11, program: "" }, { key: 29, program: "menuMain.prg" },
  { key: 35, program: "ENDDEMO.prg" }, { key: 43, program: "" },
];
const enemies = [
  { name: "foe.ene", skill: 4 }, { name: "", skill: 0 },
];
export const nativeMainFixture = pack(
  z("RPGTLKIT MAIN"), i16(2, 9, 713), z("REGISTER-SYNTHETIC"),
  z("Game\\BSTW\\"), z("Test main configuration"),
  i16(13, 1, 2, 17),
  z("test-english.lng"), z("menuTitle.prg"), z("start.brd"), z("bruce.tem"),
  z("runtime.prg"), i16(8, 96, 32),
  i16(runtimeKeys.length - 1), ...runtimeKeys.map(entry => pack(i16(entry.key), z(entry.program))),
  z("menu-system.dll"), z("fight-system.dll"),
  i16(1), i16(enemies.length - 1),
  ...enemies.map(entry => pack(z(entry.name), i16(entry.skill))),
  i16(6), i32(123456), i16(1), z("fight.prg"), z("gameover.prg"),
  z("button.png"), z("window.png"),
  i16(4), z("MenuHelp.dll"), z("brdPixelChk_v1.1.dll"),
  z(""), z("xLibVision.dll"), z("GetSaveData_v1.34.dll"),
  i16(1, 2), i32(8888),
  z("move.wav"), z("select.wav"), z("cancel.wav"),
  Buffer.from([1, 2, 3, 4]), z("cursor.png"), Buffer.from([9, 10]),
  i32(0x00332211), i32(854, 480), Buffer.from([1]),
  i16(7), i32(1, 0x00abcdef, 5),
  i16(101, 102, 103, 104, 105, 106, 107, 108),
);
export const nativeMainExpected = {
  projectPath: "Game\\BSTW\\", title: "Test main configuration",
  startup: "menuTitle.prg", board: "start.brd", character: "bruce.tem",
  pluginSlots: ["MenuHelp.dll", "brdPixelChk_v1.1.dll", "",
    "xLibVision.dll", "GetSaveData_v1.34.dll"],
};
