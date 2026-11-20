import assert from "node:assert/strict";
import {
  compileTk3Interaction,
  initialTk3ScriptState,
  startTk3Script,
  advanceTk3Script,
  chooseTk3Cursor,
  resumeTk3Effect,
  resumeTk3Transfer,
  languageLimits,
} from "../tk3-script-slice.mjs";

const start = (source) =>
  startTk3Script(initialTk3ScriptState(), source, "Lab/Prg/language.prg");
const done = (source) => {
  const result = start(source);
  assert.equal(result.status, "completed", result.state.diagnostic?.text);
  return result.state.variables;
};
assert.deepEqual(
  done(`a=2+3*4; b=(2+3)*4; c=2^3^2;
  d=13%5; e=8>>1; f=3|4; g=7&3; h=7\`3;
  j=-2*3; k=~1; l=!0; m=4>=4; n=4~=5;
  s="a; // { /*"+2; u=missing+"z"; v="4"==4; w="4"~=4;`),
  {
    a: 14,
    b: 20,
    c: 64,
    d: 3,
    e: 4,
    f: 7,
    g: 3,
    h: 4,
    j: -6,
    k: -2,
    l: 1,
    m: 1,
    n: 1,
    s: "a; // { /*2",
    u: "z",
    v: 1,
    w: 0,
  },
);
assert.deepEqual(
  done(`i=0; sum=0;
  for(local(j)=0; j<4; ++j) { sum+=j; }
  while(i<3) { i++; }
  until(i>=5) { ++i; }
  if(i==4) { branch=0; } elseif(i==5 && sum==6) { branch=2; } else {branch=3;}
  if("on") { numericCondition=1; } else { numericCondition=0; }
  if(!"on") { numericNot=1; }
  a[0]=7; a[1+1]=a[0]*3; a["key"][2]=9;
  old=a[0]++; now=++a[0];
`),
  {
    i: 5,
    sum: 6,
    branch: 2,
    numericcondition: 0,
    numericnot: 1,
    "a[0]": 9,
    "a[2]": 21,
    "a[key][2]": 9,
    old: 7,
    now: 9,
  },
);
assert.deepEqual(
  done(`x=8; shadow=0; result=add(3,4);
  method add(a,b) { local(x)=99; shadow=x; return a+b; }
  method add(a) { return a+1; }
  overloaded=add(9); original=x;
  method factorial(n) { if(n<=1){return 1;} return n*factorial(n-1); }
  fact=factorial(6);
`),
  { x: 8, result: 7, shadow: 99, overloaded: 10, original: 8, fact: 720 },
);
assert.deepEqual(
  done(`x=0; selected=1?++x:++x; logical=0&&++x; logicalOr=1||++x;`),
  { x: 4, selected: 1, logical: 0, logicalor: 1 },
  "Native RPN operators eagerly evaluate logical and ternary operands",
);
assert.deepEqual(
  done(`choice=2;
  switch(choice) {case(1){picked=10;} case(2){picked=20;} case(3){picked=30;} default{picked=40;}}
  switch(99) {case(2){other=2;} default:{other=9;}}
`),
  { choice: 2, picked: 20, other: 9 },
  "Native switch is an if/else chain without C fallthrough",
);
assert.deepEqual(
  done(
    'dash="-"; plus="+"; punctuation=")"+";"+"}"; words="if"+"else"; rgb=255+"-"+0+"-"+0;',
  ),
  { dash: "-", plus: "+", punctuation: ");}", words: "ifelse", rgb: "255-0-0" },
  "Operator/keyword/delimiter-shaped string tokens remain literal values",
);
let yielded = start(`result=outer(4); after=1;
  method outer(n) { local(sum)=n*2; local(sum)+=inner(n+1); return sum; }
  method inner(n) { mwin("Value="+n); wait(); return n; }
`);
assert.equal(yielded.status, "waiting");
assert.equal(yielded.state.message, "Value=5");
assert.equal(yielded.state.execution.callFrames.length, 2);
assert.equal(
  yielded.state.execution.instructions[yielded.state.execution.pc - 1].line,
  3,
);
assert.equal(yielded.state.variables.after, undefined);
const resumed = advanceTk3Script(yielded.state, "ENTER");
assert.equal(resumed.status, "completed");
assert.deepEqual(resumed.state.variables, { result: 13, after: 1 });
assert.equal(
  yielded.state.execution.waiting,
  true,
  "Resume does not mutate the previous snapshot",
);
assert.equal(advanceTk3Script(yielded.state).state.variables.result, 13);
let transfer = start(
  'value=travel(8); method travel(n){Send("next.brd", n*4, 48); return n+1;}',
);
assert.equal(transfer.status, "transfer");
assert.equal(transfer.transfer.x, 32);
assert.equal(resumeTk3Transfer(transfer.state).state.variables.value, 9);
const key = advanceTk3Script(start("key=wait();").state, "ENTER");
assert.equal(key.state.variables.key, "ENTER");
const large = done(Array(1600).fill("count+=1;").join("\n"));
assert.equal(
  large.count,
  1600,
  "Realistic source length is independent of the old 300-line limit",
);
for (const [source, match] of [
  ["while(true){}", /slice budget/],
  ["method recurse(n){return recurse(n+1);} recurse(0);", /call depth/],
  ['value="x"; while(true){value+=value;}', /String budget/],
  ["value=1/0;", /Non-finite/],
  ["for(i=0;i<10000;i++){a[i]=i;}", /budget/],
  ['a["x"=1]=2;', /assignable/],
]) {
  const result = start(source);
  assert.equal(result.status, "error", source);
  assert.match(result.state.diagnostic.text, match);
  assert.equal(result.state.execution, null);
}
const memorySource =
  'chunk="' + "z".repeat(60000) + '"; for(i=0;i<30;i++){items[i]=chunk;}';
const memoryError = start(memorySource);
assert.equal(memoryError.status, "error");
assert.match(memoryError.state.diagnostic.text, /memory budget/);
const longElse = compileTk3Interaction(
  "if(0){} else ".repeat(100) + "if(1){}",
  "else.prg",
);
assert.equal(longElse.ok, false);
assert.match(longElse.diagnostic.text, /nesting budget/);
const longAdd = compileTk3Interaction(
  "a=" + "1+".repeat(200) + "1;",
  "add.prg",
);
assert.equal(longAdd.ok, false);
assert.match(longAdd.diagnostic.text, /nesting budget/);
const nested = compileTk3Interaction(
  "(".repeat(100) + "1" + ")".repeat(100),
  "deep.prg",
);
assert.equal(nested.ok, false);
assert.match(nested.diagnostic.text, /nesting budget/);
const oversized = compileTk3Interaction(
  "//" + "x".repeat(languageLimits.sourceBytes),
  "large.prg",
);
assert.equal(oversized.ok, false);
assert.match(oversized.diagnostic.text, /Source byte budget/);
const unsupported = compileTk3Interaction("class Example {}", "objects.prg");
assert.equal(unsupported.ok, false);
let menu =
  start(`fontSize(18); bold(true); clear(); text(3,3,"Independent title");
  text(17,10.5,"Begin"); map=createCursorMap(); cursorMapAdd(295,180,map);
  selected=cursorMapRun(map); killCursorMap(map); mwin("Choice="+selected); wait(); end();`);
assert.equal(menu.status, "choice", menu.state.diagnostic?.text);
assert.deepEqual(
  menu.state.screen.texts.map((t) => [t.x, t.y, t.text]),
  [
    [36, 36, "Independent title"],
    [288, 171, "Begin"],
  ],
);
assert.equal(advanceTk3Script(menu.state).status, "inactive");
assert.equal(chooseTk3Cursor(menu.state, -1).status, "invalid-choice");
menu = chooseTk3Cursor(menu.state, 0);
assert.equal(menu.status, "waiting");
assert.equal(menu.state.message, "Choice=0");
assert.deepEqual(menu.state.screen.maps, {});
menu = advanceTk3Script(menu.state);
assert.equal(menu.status, "completed");
assert.equal(menu.state.screen.active, false);
let effect = start('mediaPlay("music.mid"); played=1;');
assert.equal(effect.status, "effect");
assert.equal(effect.effect.kind, "runtime-service");
assert.equal(effect.state.variables.played, undefined);
assert.equal(resumeTk3Effect(effect.state).state.variables.played, 1);
assert.equal(
  start('if(0){load("file");} reached=1;').state.variables.reached,
  1,
);
const save = start('load("file");');
assert.equal(save.status, "error");
assert.match(save.state.diagnostic.text, /save\/load/);
assert.equal(start("windows(); after=1;").status, "exited");
assert.equal(
  start("method stop(){end();} stop(); after=1;").state.variables.after,
  undefined,
);
console.log(
  "Shared RPGCode language passed: expressions, eager native operators, indexed values, loops, switch, parameter/return frames across waits/transfers, source and execution bounds, and reusable title/input effects.",
);
