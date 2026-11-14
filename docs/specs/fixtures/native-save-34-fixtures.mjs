// Deliberately synthetic SAV 3.4. Not based on BSTW source bytes.
const z = v => Buffer.from(v + "\0", "ascii");
const i16 = (...v) => { const b = Buffer.alloc(v.length * 2); v.forEach((n,i) => b.writeInt16LE(n,i*2)); return b; };
const i32 = (...v) => { const b = Buffer.alloc(v.length * 4); v.forEach((n,i) => b.writeInt32LE(n,i*4)); return b; };
const f64 = (...v) => { const b = Buffer.alloc(v.length * 8); v.forEach((n,i) => b.writeDoubleLE(n,i*8)); return b; };
const pack = (...v) => Buffer.concat(v);

export function nativeSave34({ activeThread = false, shortTail = false } = {}) {
  const players = [
    { name: "Astra", file: "hero.tem" }, { name: "Beck", file: "ally.tem" },
  ];
  const equipment = [];
  for (let slot = 1; slot <= 16; slot++) for (let i=0; i<players.length; i++) {
    equipment.push(z(slot === 4 && i === 0 ? "Game\\Test\\Item\\hat.itm" : ""),
      z(slot === 4 && i === 0 ? "Lucky Hat" : ""));
  }
  const record = pack(
    z("RPGTLKIT SAVE"), i16(3,4),
    i32(2), z("a!"), f64(101.25), z("sceneCounter"), f64(-4.5),
    i32(1), z("object[0]"), f64(81),
    i32(2), z("player$"), z("Astra"), z("note$"), z("Visit Inn"),
    i32(1), z("alias"), z("player$"),
    i32(players.length), ...players.flatMap(p => [z(p.name), z(p.file)]),
    i16(2), z("bugs.itm"), z("Bugs"), i32(4), z(""), z(""), i32(0),
    ...equipment,
    i32(11,12,13,14, 21,22,23,24),
    i32(0, 1, 2468, 0x00112233),
    z("Game\\Test\\Bitmap\\mwin.png"),
    i32(1,0x00445566),z("Courier New"),i32(18,1,0,1,372,9),
    z("Main\\Test.gam"),z("start.brd"),
    f64(144.5,288.25),i32(1,1, -1,2,3,4),
    f64(12.5,23.75),i32(2,0, 7,-8,9,10),
    i32(77,19, 88,20),
    ...Array.from({length:26},(_,i)=>i===0?[z("retired.tem"),z("Former")]:[z(""),z("")]).flat(),
    z("menu.png"),z("fight.png"),i32(75),z("alternate.tem"),
    i32(2),z(""),
    z("door.itm"),z("openDoor.prg"),z(""),z("switch"),z("01"),z("end"),z("1"),
    i16(1,-1),f64(321.5,102.25),i32(2,1,-1,3,4,5),
    i32(0),z(activeThread ? "active.prg" : ""),i32(0,1),f64(1.5),
  );
  if (activeThread) return pack(record, Buffer.from([0xfa,0xce,0x11,0x22,0x33,0x44]));
  return pack(record, f64(0),i32(2),i32(100),z("carray"),i32(200),z(""),i32(300),z("scanvas"),
    i32(-7), ...(shortTail ? [Buffer.from([0x90])] : []));
}
export const nativeSaveFixture = nativeSave34();
export const nativeSaveWithThread = nativeSave34({ activeThread: true });
