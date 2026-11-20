import assert from "node:assert/strict";
import {
  compileTk3Interaction,
  initialTk3ScriptState,
  startTk3Script,
  resumeTk3Effect,
  resumeTk3Transfer,
  advanceTk3Script,
} from "../tk3-script-slice.mjs";

const path = "Lab/Prg/pixels.prg";
let result = startTk3Script(
  initialTk3ScriptState(),
  "answer=sample(7); after=1; method sample(n){local(r)=0; getPixel(n+1,2,r,local(g),colors[n]); return r+g+colors[n];}",
  path,
);
assert.equal(result.status, "effect");
assert.match(
  resumeTk3Effect(result.state).state.diagnostic.text,
  /Missing service result/,
);
assert.equal(result.effect.name, "getpixel");
assert.deepEqual(result.effect.args, [8, 2, 0, 0, 0]);
assert.equal(result.state.execution.callFrames.length, 1);
assert.equal(result.state.variables.after, undefined);
assert.equal(resumeTk3Transfer(result.state).status, "inactive");
const completed = resumeTk3Effect(result.state, {
  value: 0,
  outputs: [
    { index: 2, value: 11 },
    { index: 3, value: 23 },
    { index: 4, value: 37 },
  ],
});
assert.equal(completed.status, "completed", completed.state.diagnostic?.text);
assert.deepEqual(completed.state.variables, {
  "colors[7]": 37,
  answer: 71,
  after: 1,
});
assert.equal(
  result.state.execution.waiting,
  false,
  "The original snapshot retains its suspended call frame",
);
const invalid = resumeTk3Effect(result.state, { value: 0, outputs: [] });
assert.equal(invalid.status, "error");
assert.equal(invalid.state.diagnostic.path, path);
assert.match(invalid.state.diagnostic.text, /Incomplete service/);
for (const source of [
  "getPixel(1,2,3,g,b)",
  "getPixel(1,2,r+1,g,b)",
  "createCanvas(10,10,3)",
]) {
  const bad = compileTk3Interaction(source, path);
  assert.equal(bad.ok, false);
  assert.match(bad.diagnostic.text, /assignable/);
}
let allocation = startTk3Script(
  initialTk3ScriptState(),
  "createCanvas(10,20,handle); wait();",
  path,
);
assert.equal(allocation.effect.name, "createcanvas");
allocation = resumeTk3Effect(allocation.state, {
  value: 17,
  outputs: [{ index: 2, value: 17 }],
});
assert.equal(allocation.status, "waiting");
assert.equal(allocation.state.variables.handle, 17);
assert.equal(advanceTk3Script(allocation.state).status, "completed");
let animation = startTk3Script(
  initialTk3ScriptState(),
  "while(true){drawCanvas(1,0,0); frames+=1;}",
  path,
);
for (let i = 0; i < 20000; i++) {
  assert.equal(animation.status, "effect", animation.state.diagnostic?.text);
  animation = resumeTk3Effect(animation.state, {
    value: 0,
    outputs: [],
    presented: true,
    frameYielded: true,
  });
}
assert.equal(
  animation.state.variables.frames,
  20000,
  "Externally paced drawing continues across many real-frame boundaries",
);
let runaway = startTk3Script(
  initialTk3ScriptState(),
  "while(true){x=MouseStatus(0);}",
  path,
);
for (let i = 0; i < 50000 && runaway.status === "effect"; i++)
  runaway = resumeTk3Effect(runaway.state, { value: 0, outputs: [] });
assert.equal(runaway.status, "error");
assert.match(runaway.state.diagnostic.text, /Total instruction budget/);
assert.equal(
  startTk3Script(initialTk3ScriptState(), "while(true){}", path).status,
  "error",
);
console.log(
  "Canvas runtime passed: native RGB/out-handle references, local/indexed outputs, call continuation, malformed service results, long paced animation and bounded service-only/pure loops.",
);
