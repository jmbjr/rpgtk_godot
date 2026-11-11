// Synthetic bytes and independent expected data. This file uses only Node APIs.
const fixtures = [];
const fill = (count, value) => Array(count).fill(value);
const zstr = value => Buffer.from(value + "\0", "ascii");
const binary = (...fields) => Buffer.concat(fields.map(field => typeof field === "string" ? zstr(field) : field));
const i16 = (...values) => {
  const bytes = Buffer.alloc(values.length * 2);
  values.forEach((value, index) => bytes.writeInt16LE(value, index * 2));
  return bytes;
};
const i32 = (...values) => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeInt32LE(value, index * 4));
  return bytes;
};
const header = (signature, minor) => binary(signature, i16(2, minor));
const text = (signature, ...fields) => Buffer.from([signature, 2, 0, ...fields, ""].join("\r\n"), "ascii");
const blank = count => Buffer.alloc(count);
function add(path, bytes, data, status = "decoded") {
  fixtures.push({ path, bytes, expected: { status, data: { byteLength: bytes.length, ...data } } });
}

add("main.gam", binary(header("RPGTLKIT MAIN", 2), i16(0), "", "Example", "Fixture",
  i16(0, 0, 0, 0, 0), "english.lng", "start.prg", "room.brd", "hero.tem"),
{ major: 2, minor: 2, projectPath: "Example", title: "Fixture", language: "english.lng",
  startup: "start.prg", board: "room.brd", character: "hero.tem" }, "partial");
add("legacy.gam", text("RPGTLKIT MAIN", 1, "start.prg", "", 0, 0, 27, 13, "room.brd", "hero.tem"),
  { major: 2, minor: 0, startup: "start.prg", board: "room.brd", character: "hero.tem" }, "partial");

add("Prg/start.prg", Buffer.from('* #Done()\n#Run("other.prg")'), {
  lines: ["* #Done()", '#Run("other.prg")'],
  symbols: [{ key: "builtin:run", kind: "builtin", name: "run", value: "#Run", lines: [2] }],
  builtInCalls: 1,
}, "partial");
add("Tiles/water.tan", binary(header("RPGTLKIT TILEANIM", 0), i32(8, 1), "two-tiles.tst2"), { speed: 8 });

const walking = ["South", "East", "North", "West"].flatMap(direction =>
  [1, 2, 3, 4].map(frame => ({ direction, frame, parts: ["top", "bottom"].map(part => ({
    value: "", evidence: `Walk ${direction.toLowerCase()} · frame ${frame} · ${part}`,
  })) })));
add("Chrs/hero.tem", binary(header("RPGTLKIT CHAR", 3), "Hero", blank(9), i32(10, 7, 9, 2, 3, 4, 6, 1),
  "face.gif", blank(201 * 11), blank(1 + 1 + 11 + 22 + 4 + 1 + 2 + 32)), {
  name: "Hero",
  stats: { XP: 10, HP: 7, "Max HP": 9, Defense: 2, Fight: 3, "Special power": 4, "Max special power": 6, Level: 1 },
  profile: { value: "face.gif", evidence: "Character portrait" },
  walking,
}, "partial");

const walker24 = binary(header("RPGTLKIT CHAR", 4), "Walker", blank(9), i32(20, 12, 12, 3, 5, 6, 7, 2),
  "face.gif", blank(201 * 11), blank(1 + 1 + 11 + 7), i32(1), i16(5), i32(10), i16(1, 2, 3, 4),
  "tone.wav", "", "", "", "start.prg", blank(2), "two-tiles.tst2", blank(31));
add("Chrs/walker.tem", walker24, {
  name: "Walker",
  stats: { XP: 20, HP: 12, "Max HP": 12, Defense: 3, Fight: 5, "Special power": 6, "Max special power": 7, Level: 2 },
  profile: { value: "face.gif", evidence: "Character portrait" },
  walking: [{ ...walking[0], parts: [{ ...walking[0].parts[0], value: "two-tiles.tst2" }, walking[0].parts[1]] }, ...walking.slice(1)],
}, "partial");

const embeddedWalk = [-1, 255, ...fill(30, -1), 65280, ...fill(991, -1)];
for (const sizeType of [0, 1]) {
  const graphics = sizeType ? ["two-tiles.tst2", ...fill(119, "")] : [...embeddedWalk, ...fill(42 * 1024, -1)];
  const bytes = Buffer.from(["RPGTLKIT CHAR", 2, 2, "Old hero", ...fill(9, ""), 10, 7, 9, 2, 3, 4, 6, 1,
    "face.gif", "pulse.spc", ...fill(201 * 5 - 1, ""), "", 1, sizeType, ...graphics, ...fill(23, ""),
    "tone.wav", "", "", "", "start.prg", 0, ""].join("\r\n"), "ascii");
  const referencedWalk = [{ ...walking[0], parts: [
    { ...walking[0].parts[0], value: "two-tiles.tst2" }, walking[0].parts[1],
  ] }, ...walking.slice(1)];
  add(`Chrs/text-hero-${sizeType}.tem`, bytes, {
    name: "Old hero",
    stats: { XP: 10, HP: 7, "Max HP": 9, Defense: 2, Fight: 3, "Special power": 4, "Max special power": 6, Level: 1 },
    profile: { value: "face.gif", evidence: "Character portrait" },
    walking: sizeType ? referencedWalk : walking,
    ...(sizeType === 0 ? { embeddedWalking: [embeddedWalk, ...fill(15, fill(1024, -1))] } : {}),
  }, "partial");
}

// Older text layouts: 2.0 has no size token; 2.1 has smaller referenced battle art.
for (const [minor, sizeType] of [[0, 0], [1, 0], [1, 1]]) {
  const embedded = Array.from({ length: 16 }, (_, i) => [i + 1, ...fill(1023, -1)]);
  const walkNames = Array.from({ length: 32 }, (_, i) => i === 0 || i === 31 ? "two-tiles.tst2" : "");
  const graphics = sizeType
    ? [...walkNames, ...Array.from({ length: 32 }, (_, i) => `battle-${i}.gph`), "rest-top.gph", "rest-bottom.gph",
      ...Array.from({ length: 20 }, (_, i) => `custom-${i}.gph`)]
    : [...embedded.flat(), ...fill(27 * 1024, -1)];
  const bytes = Buffer.from(["RPGTLKIT CHAR", 2, minor, `Text 2.${minor} hero ${sizeType}`, ...fill(9, "variable!"),
    10, 7, 9, 2, 3, 4, 6, 1, "face.gif", "pulse.spc", ...fill(201 * 5 - 1, ""), "Special", 0,
    ...(minor ? [sizeType] : []), ...graphics, ...fill(10, "Accessory"), ...fill(6, 1), 1, 5, 99, 2, 3, 4, 5,
    "tone.wav", "missing-defense.wav", "tone.wav", "missing-defeat.wav", "start.prg", 1, ""].join("\r\n"), "ascii");
  const referenced = walking.map((frame, i) => ({ ...frame, parts: frame.parts.map((part, j) => ({
    ...part, value: walkNames[i * 2 + j],
  })) }));
  add(`Chrs/text-${minor}-${sizeType}.tem`, bytes, {
    name: `Text 2.${minor} hero ${sizeType}`,
    stats: { XP: 10, HP: 7, "Max HP": 9, Defense: 2, Fight: 3, "Special power": 4, "Max special power": 6, Level: 1 },
    profile: { value: "face.gif", evidence: "Character portrait" },
    walking: sizeType ? referenced : walking,
    ...(sizeType ? {} : { embeddedWalking: embedded }),
  }, "partial");
}

const boardBytes = binary(header("RPGTLKIT BOARD", 2), i16(0), "", i16(1, 1, 1), blank(8),
  i16(1), "", "two-tiles.tst2", i16(1, -30, 0, 20), blank(1),
  blank(3), i32(255), blank(4), i16(1), blank(4), blank(2), "", blank(8), "", blank(22),
  "", "Ground", blank(8), i16(-1), "", "", i16(-1));
const boardData = {
  width: 1, height: 1, layers: 1, layerTitles: ["Ground", ...fill(8, "")],
  background: 255, ambient: [75, 75, 75],
  tileLookup: [{ value: "" }, { value: "two-tiles.tst2", reference: {
    value: "two-tiles.tst2", evidence: "Board tile lookup · entry 1 · 1 placed", status: "resolved",
    source: { $ref: "rpgtk:/Boards/room.brd" }, target: { $ref: "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1", tileIndex: 2 },
    placements: 1,
  } }],
  cellOrder: "zero-based offset; layer, row, column",
  runs: [{ offset: 0, length: 1, lookupIndex: 1, shade: [-30, 0, 20] }],
};
add("Boards/room.brd", boardBytes, boardData, "partial");

const board23Prefix = binary(header("RPGTLKIT BOARD", 3), boardBytes.subarray(header("RPGTLKIT BOARD", 2).length, -2),
  i16(0), "token-2.itm", i16(1, 1, 1, 0), blank(4), i16(0), "start.prg", "");
for (const [path, threads, coordinateType] of [
  ["Boards/threaded-room.brd", ["start.prg", "", "absent.prg"], 1],
  ["Boards/no-threads.brd", [], 0],
]) {
  const tileReference = boardData.tileLookup[1].reference;
  add(path, binary(board23Prefix, i32(threads.length - 1), ...threads, Buffer.of(coordinateType)), {
    ...boardData,
    tileLookup: [{ value: "" }, { value: "two-tiles.tst2", reference: {
      ...tileReference, source: { $ref: `rpgtk:/${path}` },
    } }],
    threads, coordinateType,
  }, "partial");
}



// Text boards serialize x, y, layer, unlike the normalized board record.
const textGrid = Array.from({ length: 2 * 3 * 8 }, () => ["", 0, 0, 0, 0]);
textGrid[2 * 8] = ["two-tiles.tst2", -3, 4, 5, 1]; // x=0, y=2, layer=0
textGrid[3 * 8] = ["two-tiles.tst1", 7, 0, -2, 0]; // x=1, y=0, layer=0
textGrid[3 * 8 + 1] = ["two-tiles.tst2", 0, 0, 0, 0]; // x=1, y=0, layer=1
const textBoardTail = ["face.gif", "", 255, 0, 3, ...fill(4, ""), 0, "", 0, ...fill(10, ""), "note.mid",
  "Ground", "Upper", ...fill(6, ""),
  "start.prg", 2, 3, 1, "", ...fill(6, ""), ...fill(50 * 11, ""),
  "token-2.itm", 1, 2, 2, ...fill(6, ""), ...fill(10 * 10, ""),
  1, 1, 1, "start.prg", ...fill(10, ""), 0, "other.prg", ...fill(10, "")];
const textBoard = Buffer.from(["RPGTLKIT BOARD", 2, 1, 0, "NOCODE", 2, 3, ...textGrid.flat(),
  ...textBoardTail, ""].join("\r\n"), "ascii");
const textTileRef = (tileIndex, index, placements, name = "text-room") => ({
  value: `two-tiles.tst${tileIndex}`, evidence: `Board tile lookup · entry ${index} · ${placements} placed`,
  status: "resolved", source: { $ref: `rpgtk:/Boards/${name}.brd` },
  target: { $ref: `rpgtk:/Tiles/two-tiles.tst#/data/tiles/${tileIndex - 1}`, tileIndex }, placements,
});
add("Boards/text-room.brd", textBoard, {
  width: 2, height: 3, layers: 8, layerTitles: ["", "Ground", "Upper", ...fill(6, "")],
  background: 255, ambient: [0, 0, 75],
  tileLookup: [{ value: "" }, { value: "two-tiles.tst2", reference: textTileRef(2, 1, 2) },
    { value: "two-tiles.tst1", reference: textTileRef(1, 2, 1) }],
  cellOrder: "zero-based offset; layer, row, column",
  runs: [
    { offset: 1, length: 1, lookupIndex: 2, shade: [7, 0, -2] },
    { offset: 4, length: 1, lookupIndex: 1, shade: [-3, 4, 5] },
    { offset: 7, length: 1, lookupIndex: 1, shade: [0, 0, 0] },
  ],
}, "partial");

const fixedGrid = Array.from({ length: 19 * 11 * 8 }, () => ["", 0, 0, 0, 0]);
fixedGrid[0] = ["two-tiles.tst1", 3, 4, 5, 0];
fixedGrid[8] = ["two-tiles.tst1", 0, 0, 0, 0]; // x=0, y=1, layer=0
fixedGrid[16 + 7] = ["two-tiles.tst2", -7, 0, 1, 0]; // x=0, y=2, layer=7
const fixedBoard = text("RPGTLKIT BOARD", 0, "NOCODE", ...fixedGrid.flat(), ...textBoardTail);
add("Boards/fixed-room.brd", fixedBoard, {
  width: 19, height: 11, layers: 8, layerTitles: ["", "Ground", "Upper", ...fill(6, "")],
  background: 255, ambient: [0, 0, 75],
  tileLookup: [{ value: "" }, { value: "two-tiles.tst1", reference: textTileRef(1, 1, 2, "fixed-room") },
    { value: "two-tiles.tst2", reference: textTileRef(2, 2, 1, "fixed-room") }],
  cellOrder: "zero-based offset; layer, row, column",
  runs: [
    { offset: 0, length: 1, lookupIndex: 1, shade: [3, 4, 5] },
    { offset: 19, length: 1, lookupIndex: 1, shade: [0, 0, 0] },
    { offset: 1501, length: 1, lookupIndex: 2, shade: [-7, 0, 1] },
  ],
}, "partial");

for (const version of [2, 3]) {
  const n = version === 2 ? i16 : i32;
  add(`Item/token-${version}.itm`, binary(header("RPGTLKIT ITEM", version), "Token", "Example",
    Buffer.from([0, 1, 0, 0, 0]), blank(51), n(12, 6), blank(1 + 8), "", n(2, 0, 0, -1),
    "", "", n(5, 0), "start.prg", n(0, 0), "", "", "", "", blank(1), blank(32), "", "two-tiles.tst2"), {
    version, name: "Token", description: "Example", modes: { equip: false, menu: true, board: false, battle: false },
    usableBy: 0, characters: fill(51, ""), buyPrice: 12, sellPrice: 6, keyItem: false, armorSlots: fill(8, 0),
    accessory: "", modifiers: { hp: 2, defense: 0, fight: 0, specialPower: -1 },
    programs: { "Equip program": "", "Remove program": "", "Menu-use program": "start.prg", "Battle-use program": "",
      "On-board program": "", "Pickup program": "" },
    animation: "", menu: { hp: 5, specialPower: 0 }, battle: { hp: 0, specialPower: 0 }, sizeType: 0,
    walking: fill(16, ["", ""]), rest: ["", "two-tiles.tst2"],
  });
}

const embeddedItemTile = [-1, 255, ...fill(30, -1), 65280, ...fill(991, -1)];
for (const [version, sizeType] of [[0, 0], [1, 0], [1, 1]]) {
  const graphics = sizeType
    ? ["", "two-tiles.tst2", ...fill(30, ""), "", "two-tiles.tst1"]
    : [-2, ...embeddedItemTile, ...fill(14, -2), ...embeddedItemTile];
  const bytes = Buffer.from(["RPGTLKIT ITEM", 2, version, "Relic", 1, 0, 1, 0, 1, ...fill(6, 0),
    "Charm", 4, -3, 2, 1, "start.prg", "", 2, 3, "", 4, 5, "", "", "",
    ...(version === 1 ? [sizeType] : []), ...graphics, 1, "Hero", ...fill(49, ""), 20, 10, 1, "Old relic", "effect.anm", ""].join("\r\n"), "ascii");
  const path = version === 0 ? "Item/text-20-item.itm" : `Item/text-item-${sizeType}.itm`;
  add(path, bytes, {
    version, name: "Relic", description: "Old relic", modes: { equip: true, menu: false, board: true, battle: false },
    usableBy: 1, characters: ["", "Hero", ...fill(49, "")], buyPrice: 20, sellPrice: 10, keyItem: true,
    armorSlots: [0, 1, ...fill(6, 0)], accessory: "Charm", modifiers: { hp: 4, defense: -3, fight: 2, specialPower: 1 },
    programs: { "Equip program": "start.prg", "Remove program": "", "Menu-use program": "", "Battle-use program": "",
      "On-board program": "", "Pickup program": "" },
    animation: "effect.anm", menu: { hp: 2, specialPower: 3 }, battle: { hp: 4, specialPower: 5 }, sizeType,
    walking: sizeType ? [["", "two-tiles.tst2"], ...fill(15, ["", ""])] : fill(16, ["", ""]),
    rest: ["", sizeType ? "two-tiles.tst1" : ""],
    ...(sizeType === 0 ? { embeddedGraphics: { walking: [null, embeddedItemTile, ...fill(14, null)], rest: embeddedItemTile } } : {}),
  });
}

const enemyFields = ["Foe", 10, 3, 2, 1, 1, 0, 0, 1, 1, "two-tiles.tst2", ...fill(132, ""),
  ...fill(202, ""), 0, 0, "", 4, 2, "", "", "", "", "", ""];
const enemyData = {
  name: "Foe", stats: { HP: 10, "Special power": 3, Fight: 2, Defense: 1 }, canFlee: true, sneakChance: 0, sneakUp: 0,
  width: 1, height: 1, tileStride: 7, tiles: ["two-tiles.tst2", ...fill(132, "")], specialMoves: fill(101, ""),
  weaknesses: fill(101, ""), ai: 0, usesScript: false, script: "", xp: 4, gold: 2,
  programs: { "Victory program": "", "Escape program": "" },
  sounds: { "Attack sound": "", "Defense sound": "", "Special move sound": "", "Defeat sound": "" },
};
add("Enemy/foe.ene", text("RPGTLKIT ENEMY", ...enemyFields), { ...enemyData, animations: {} });
add("Enemy/animated.ene", text("RPGTLKIT ENEMY", ...enemyFields, "effect.anm", "", "", ""), {
  ...enemyData, animations: { Attack: "effect.anm", Defense: "", "Special move": "", Defeat: "" },
});
add("Bkrounds/room.bkg", text("RPGTLKIT BKG", "two-tiles.tst2", ...fill(208, ""), "note.mid", "", "", "", "", "",
  -30, 0, 20, ...fill(208 * 3, 0)), {
  width: 19, height: 11, order: "column-major", tiles: ["two-tiles.tst2", ...fill(208, "")],
  audio: { Music: "note.mid", "Select sound": "", "Choose sound": "", "Ready sound": "", "Invalid action sound": "" },
  shading: [[-30, 0, 20], ...fill(208, [0, 0, 0])],
});
add("SpcMove/pulse.spc", text("RPGTLKIT SPLMOVE", "Pulse", 12, 6, "start.prg", 2, 0, 1, "slow.ste", "effect.anm", "Example"), {
  name: "Pulse", fightPower: 12, cost: 6, program: "start.prg", targetSpecialPower: 2, battle: true, board: false,
  storedUseFlags: [0, 1], assets: { "Status effect": "slow.ste", Animation: "effect.anm" }, description: "Example",
});
add("StatusE/slow.ste", binary(header("RPGTLKIT STATUSE", 2), "Slow", i16(0, 0, 1, 0, 1, -4, 0, 0, 1), "start.prg"), {
  version: 2, name: "Slow", rounds: 0, speed: false, slow: true, disable: false, removeHp: true, hpAmount: -4,
  removeSmp: false, smpAmount: 0, runProgram: true, program: "start.prg",
});
add("StatusE/text-ste.ste", text("RPGTLKIT STATUSE", "Old effect", 3, 1, 0, 1, 1, -50, 1, 7, 0, "start.prg"), {
  version: 0, name: "Old effect", rounds: 3, speed: true, slow: false, disable: true, removeHp: true, hpAmount: -50,
  removeSmp: true, smpAmount: 7, runProgram: false, program: "start.prg",
});
add("Misc/effect.anm", text("RPGTLKIT ANIM", 16, 32, 0, "face.gif", 255, "tone.wav",
  ...fill(50, ["", 0, ""]).flat(), 0.25), {
  width: 16, height: 32, storedFrameCount: 0,
  frames: [{ image: "face.gif", transparentColor: 255, sound: "tone.wav" }, ...fill(50, { image: "", transparentColor: 0, sound: "" })],
  pauseSeconds: 0.25,
});
add("Font/one.fnt", text("RPGTLKIT FONT", 128, ...fill(2047, 0)), {
  width: 8, height: 8, glyphs: [[128, ...fill(7, 0)], ...fill(255, fill(8, 0))],
});
add("Boards/temp.___", Buffer.from("1\n2\n3\n4\n5\ntwo-tiles.tst2\n-2\n0\n1\n"), {
  layout: "Observed text records; producer and field meanings unverified", header: [1, 2, 3, 4, 5],
  records: [{ tileName: "two-tiles.tst2", values: [-2, 0, 1] }],
}, "partial");

add("Bitmap/face.gif", Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), {
  signature: "GIF89a", width: 1, height: 1, globalColors: 2, frames: [
    { x: 0, y: 0, width: 1, height: 1, interlaced: false, localColors: 0,
      delayCentiseconds: 0, disposalMethod: 0, transparentIndex: 0 },
  ],
}, "partial");
for (const extension of ["jpg", "jpeg"]) {
  add(`Bitmap/header.${extension}`, Buffer.from("ffd8ffc0000b080002000301011100ffd9", "hex"), {
    width: 3, height: 2, precisionBits: 8, frameMarker: "0xc0",
    components: [{ id: 1, horizontalSampling: 1, verticalSampling: 1, quantizationTable: 0 }],
  }, "partial");
}
add("Media/tone.wav", Buffer.from("524946462600000057415645666d74201000000001000100401f0000401f00000100080064617461020000008080", "hex"), {
  encodingTag: 1, channels: 1, sampleRateHz: 8000, bytesPerSecond: 8000, blockAlign: 1, bitsPerSample: 8,
  audioBytes: 2, sampleFrames: 2, durationSeconds: 0.00025,
  chunks: [{ id: "fmt ", size: 16, offset: 20 }, { id: "data", size: 2, offset: 44 }],
}, "partial");
add("Media/note.mid", Buffer.from("4d546864000000060000000100604d54726b0000000f00c04700903c6460803c0000ff2f00", "hex"), {
  format: 0, trackCount: 1, timeDivision: { ticksPerQuarter: 96 },
  tracks: [{ number: 1, size: 15, ticks: 96, events: 4, noteOnEvents: 1, channels: [1], names: [], instruments: [], tempos: [],
    parts: [{ port: 0, channel: 1, program: 72, percussion: false, instrument: "Clarinet", noteCount: 1, lowestNote: 60, highestNote: 60 }] }],
}, "partial");
const cfb = blank(512);
Buffer.from("d0cf11e0a1b11ae1", "hex").copy(cfb);
for (const [offset, value] of [[24, 62], [26, 3], [28, 0xfffe], [30, 9]]) cfb.writeUInt16LE(value, offset);
cfb.writeUInt32LE(0xfffffffe, 48);
cfb.writeUInt32LE(4096, 56);
add("Media/empty.doc", cfb, {
  container: "CFB", major: 3, minor: 62, sectorSize: 512, fatSectorCount: 0, miniStreamCutoff: 4096, directory: [],
}, "partial");

export { fixtures };
