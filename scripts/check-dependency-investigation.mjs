import assert from "node:assert/strict";
import { createDependencyInvestigation, dependencyLimits } from "../dependency-investigation.mjs";
import { artifactId, artifactRecord } from "../records.mjs";

const assets = new Map(["root.brd", "a.prg", "b.prg", "shared.wav", "tiles.tst"].map(path => [path, { type: path.split('.').at(-1) }]));
const edge = (from, to, extra = {}) => ({ from, to, evidence: "Recorded field", value: to, status: "Resolved", ...extra });
const first = edge("root.brd", "a.prg", { position: { x: 11, y: 2, layer: 3 } });
const graph = { outgoing: new Map([
  ["root.brd", [first, edge("root.brd", "b.prg"), edge("root.brd", "tiles.tst", {tile:2}), edge("root.brd", "tiles.tst", {tile:3}),
    ...["Missing", "Ambiguous", "Dynamic", "Unindexed"].map(status => edge("root.brd", undefined, {status,value:"expression",candidates:status==='Ambiguous'?['a.prg','b.prg']:undefined}))]],
  ["a.prg", [edge("a.prg", "root.brd", {line:7}), edge("a.prg", "shared.wav", {line:2}), edge("a.prg", "shared.wav", {line:8,inlineSlot:4})]],
  ["b.prg", [edge("b.prg", "shared.wav")]],
]), incoming: new Map() };
const investigation = createDependencyInvestigation("root.brd", graph, assets);
let state = investigation.snapshot(); assert.equal(state.rows.length,8);
for (const path of ["a.prg", "b.prg"]) { investigation.toggle(state.rows.find(r=>r.path===path).id); state=investigation.snapshot(); }
assert.ok(state.rows.find(r=>r.path==='root.brd').cycle);
assert.equal(state.rows.filter(r=>r.path==='shared.wav').length,2);
assert.equal(state.rows.filter(r=>r.path==='shared.wav'&&r.shared).length,1);
assert.equal(state.rows.find(r=>r.path==='shared.wav').edges.length,2);
assert.ok(state.rows.find(r=>r.path==='tiles.tst'&&r.tile===3).shared);
assert.equal(state.rows.find(r=>r.path==='a.prg').edges[0], first, "Keep original resolver edge evidence");
const record=artifactRecord({path:'root.brd',type:'brd',decodeStatus:'decoded'},graph);
for(const row of state.rows.filter(r=>r.parent==='root')){
  if(row.path) assert.equal(row.assetId, artifactId(row.path));
  for(const e of row.edges)assert.ok(record.references.outgoing.some(r=>r.evidence===e.evidence&&r.value===e.value&&r.target?.tileIndex===e.tile));
}
assert.equal(state.rows.filter(r=>!r.path).length,4);assert.ok(state.rows.filter(r=>!r.path).every(r=>!r.expandable));
const a=state.rows.find(r=>r.path==='a.prg');investigation.toggle(a.id);assert.equal(investigation.snapshot().rows.filter(r=>r.path==='shared.wav').length,1);
assert.throws(()=>createDependencyInvestigation('a.prg',graph,assets),/board/);

// Large fanout, deep chain and repeated expansion cannot exceed the view budget.
const hugeAssets=new Map([['root.brd',{type:'brd'}]]),outgoing=new Map();
for(let i=0;i<160;i++){const p='file'+i+'.prg';hugeAssets.set(p,{type:'prg'});outgoing.set(p,[edge(p,'file'+(i+1)+'.prg')]);}
outgoing.set('root.brd',Array.from({length:160},(_,i)=>edge('root.brd','file'+i+'.prg')));
const huge=createDependencyInvestigation('root.brd',{outgoing},hugeAssets);
state=huge.snapshot();assert.equal(state.branches[0].hidden,152);
for(let i=0;i<30;i++)huge.more('root');state=huge.snapshot();assert.equal(state.rows.length,120);assert.equal(state.branches[0].hidden,40);
huge.toggle(state.rows[0].id);state=huge.snapshot();
for(let i=0;i<8;i++){const row=state.rows.find(r=>r.expandable&&!r.expanded&&r.parent!=='root');if(!row)break;huge.toggle(row.id);state=huge.snapshot();}
assert.ok(state.rows.length<=dependencyLimits.rows);assert.ok(state.rows.every(r=>r.depth<=dependencyLimits.depth));
assert.ok(state.branches.some(b=>b.depthLimited&&b.hidden));
const top=state.rows[0];huge.toggle(top.id);assert.ok(huge.snapshot().branches.every(b=>!b.depthLimited));
console.log('Board investigation passed: shared graph identities/evidence, cycles, repeated routes/tiles, unresolved leaves, collapse, paging and row/hop bounds.');
