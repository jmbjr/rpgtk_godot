// Source-only fixtures; expectations describe conceptual frames before serialization.
import { fixtures } from "./format-fixtures.mjs";
const fill = (n, value) => Array(n).fill(value);
const z = value => Buffer.from(value + "\0", "ascii");
const n16 = (...values) => { const b = Buffer.alloc(values.length * 2); values.forEach((v, i) => b.writeInt16LE(v, i * 2)); return b; };
const n32 = (...values) => { const b = Buffer.alloc(values.length * 4); values.forEach((v, i) => b.writeInt32LE(v, i * 4)); return b; };
const bin = (...fields) => Buffer.concat(fields.map(v => typeof v === "string" ? z(v) : v));
const head = (name, minor) => bin(`RPGTLKIT ${name}`, n16(2, minor));
const actions = ["Attack", "Defense", "Special move", "Defeat"];
export const detailFixtures = [];
export const characterCases = [];
export const boardCases = [];
const text = fields => Buffer.from([...fields, ""].join("\r\n"));
const color = (kind, frame) => 100 + kind * 10 + frame;
const tile = value => [value, 255, ...fill(30, -1), 65280, ...fill(991, -1)];
const artName = (kind, frame, x, y) => kind === 4 && x === 0 && y === 0 ? "two-tiles.tst2" : `art-${kind}-${frame}-${x}-${y}.gph`;
for (let kind = 0; kind < 6; kind++) for (let frame = 1; frame <= (kind === 4 ? 1 : kind === 5 ? 10 : 4); frame++) {
  for (let x = 0; x < (kind === 5 ? 1 : 2); x++) for (let y = 0; y < 2; y++) {
    if (artName(kind, frame, x, y).endsWith(".gph")) detailFixtures.push({ path: `Tiles/${artName(kind, frame, x, y)}`, bytes: text(["RPGTLKIT TILE", 2, 0, 1, 1, 1024, color(kind, frame) + x * 1000 + y * 10000]) });
  }
}
for (const [binary, minor, embedded] of [[false,0,true], [false,1,true], [false,2,true], [false,1,false], [false,2,false], [true,3,false], [true,4,false]]) {
  const columns = embedded || (!binary && minor === 1) ? 1 : 2;
  const frames = actions.flatMap((kind, k) => Array.from({ length: 4 }, (_, i) => ({ kind, k, frame: i + 1 })));
  frames.push({kind:"Rest", k:4, frame:1}, ...Array.from({length:10},(_,i)=>({kind:"Custom", k:5, frame:i+1})));
  const expectedArtwork = frames.map(({kind,k,frame}) => ({ kind, frame, width: (kind === "Custom" ? 1 : columns) * 32, height: embedded ? 32 : 64,
    ...(embedded ? { pixels: tile(color(k,frame)) } : { parts: Array.from({length:kind === "Custom" ? 1 : columns},(_,x)=>[0,1].map(y=>({x,y,value:artName(k,frame,x,y),evidence:`${kind} · frame ${frame} · tile (${x}, ${y})`}))).flat() }) }));
  const values=[];
  const read = (k,f,x,y) => values.push(artName(k,f+1,x,y));
  if (embedded) {
    for(let f=1;f<=4;f++) for(let p=0;p<1024;p++) for(const k of [0,2,1,3]) values.push(tile(color(k,f))[p]);
    values.push(...tile(color(4,1)));
    for(let f=1;f<=10;f++) values.push(...tile(color(5,f)));
  } else {
    if(binary) for(let f=0;f<4;f++) for(let x=0;x<columns;x++) for(let y=0;y<2;y++) for(let k=0;k<4;k++) read(k,f,x,y);
    else for(let x=0;x<columns;x++) for(let y=0;y<2;y++) for(let f=0;f<4;f++) for(let k=0;k<4;k++) read(k,f,x,y);
    for(let x=0;x<columns;x++) for(let y=0;y<2;y++) read(4,0,x,y);
    for(let f=0;f<10;f++) for(let y=0;y<2;y++) read(5,f,0,y);
  }
  let bytes;
  if(binary) {
    const base=fixtures.find(({path})=>path===(minor===3?"Chrs/hero.tem":"Chrs/walker.tem")).bytes;
    bytes=bin(base.subarray(0,-88), ...values);
  } else bytes=text(["RPGTLKIT CHAR",2,minor,`Artwork ${minor} ${embedded}`, ...fill(9,""),10,7,9,2,3,4,6,1,"face.gif",
    ...fill(201*5,""),"",0,...(minor?[embedded?0:1]:[]),...(embedded?fill(16*1024,-1):fill(32,"")),...values,
    ...fill(23,0),"tone.wav","","","","start.prg",0]);
  const path=`Chrs/art-${binary?"binary":"text"}-${minor}-${embedded?0:1}.tem`;
  detailFixtures.push({path,bytes}); characterCases.push({path,expectedArtwork});
}
const emptyCondition = { mode:0, initialVariable:"", finalVariable:"", initialValue:"", finalValue:"", type:0 };
const programCondition = {mode:1,initialVariable:"door!",finalVariable:"done!",initialValue:"01",finalValue:"opened",type:1};
const itemCondition = {mode:1,initialVariable:"item!",finalVariable:"after!",initialValue:"true",finalValue:"0",type:0};
const conditionValues = c => [c.mode,c.initialVariable,c.finalVariable,c.initialValue,c.finalValue,c.type];
const conditionBinary = c => bin(n16(c.mode),c.initialVariable,c.finalVariable,c.initialValue,c.finalValue,n16(c.type));
const programs = [ {slot:0,program:"",position:{x:0,y:0,layer:0},graphic:"",condition:emptyCondition},
  {slot:1,program:"start.prg",position:{x:2,y:1,layer:1},graphic:"two-tiles.tst2",condition:programCondition} ];
const items = [{slot:0,item:"token-2.itm",position:{x:3,y:2,layer:2},condition:itemCondition,activationProgram:"start.prg",multitaskProgram:"other.prg"}];
for(const minor of [2,3]) {
  const bytes=bin(head("BOARD",minor),n16(0),"",n16(3,2,2,3,2,1,1),n16(1),"","two-tiles.tst2",
    n16(-4,0,0,0,0),Buffer.of(1), n16(-5,1,0,0,0),Buffer.of(18),n16(-3,0,0,0,0),Buffer.of(99),
    "","","",n32(0,0),n16(0),...fill(4,""),n16(0),"",Buffer.alloc(8),"",Buffer.alloc(22),"",...fill(9,""),
    n16(1),...programs.map(p=>bin(p.program,n16(p.position.x,p.position.y,p.position.layer),p.graphic,conditionBinary(p.condition))),"start.prg","",
    n16(0),items[0].item,n16(3,2,2),conditionBinary(itemCondition),"start.prg","other.prg",...(minor===3?[n32(-1),Buffer.of(0)]:[]));
  const path=`Boards/types-${minor}.brd`;
  detailFixtures.push({path,bytes}); boardCases.push({path,programs,items,start:{x:3,y:2,layer:1},saveDisabled:1,
    tileTypes:[{offset:0,length:4,value:1},{offset:4,length:5,value:18},{offset:9,length:3,value:99}]});
}
// Text grid is x/y/layer; one collision-only cell verifies normalization.
const grid=Array.from({length:2*3*8},()=>["",0,0,0,0]); grid[2*8]=["",0,0,0,2]; grid[3*8]=["two-tiles.tst2",0,0,0,1];
const emptyProgram={slot:0,program:"",position:{x:0,y:0,layer:0},graphic:"",condition:emptyCondition};
const textPrograms=Array.from({length:51},(_,slot)=>slot===1?programs[1]:{...emptyProgram,slot});
const textItems=Array.from({length:11},(_,slot)=>slot===0?items[0]:{slot,item:"",position:{x:0,y:0,layer:0},condition:emptyCondition,activationProgram:"",multitaskProgram:""});
const bytes=text(["RPGTLKIT BOARD",2,1,0,"",2,3,...grid.flat(),"","",0,0,0,...fill(4,""),0,"",0,...fill(10,""),"",...fill(8,""),
  ...textPrograms.flatMap(p=>[p.program,p.position.x,p.position.y,p.position.layer,p.graphic,...conditionValues(p.condition)]),
  ...textItems.flatMap(p=>[p.item,p.position.x,p.position.y,p.position.layer,...conditionValues(p.condition)]),3,2,1,
  ...textItems.map(p=>p.activationProgram),1,...textItems.map(p=>p.multitaskProgram)]);
detailFixtures.push({path:"Boards/types-text.brd",bytes});
boardCases.push({path:"Boards/types-text.brd",programs:textPrograms,items:textItems,start:{x:3,y:2,layer:1},saveDisabled:1,
  tileTypes:[{offset:0,length:1,value:0},{offset:1,length:1,value:1},{offset:2,length:2,value:0},{offset:4,length:1,value:2},{offset:5,length:43,value:0}]});
