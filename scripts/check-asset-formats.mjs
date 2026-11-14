import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {detectSourceFormat, formatSpecTarget, formatSummary, mainSourceFormat, tileMode, toolkitAsset} from "../asset-format.mjs";
import {readArtifacts, buildReferences} from "../artifacts.mjs";
import {artifactRecord} from "../records.mjs";
import {fixtures} from "../docs/specs/fixtures/format-fixtures.mjs";
import {detailFixtures} from "../docs/specs/fixtures/detail-fixtures.mjs";
import JSZip from "../vendor/jszip.min.js";
const bytes = value => new TextEncoder().encode(value);
const binary = (signature, major, minor) => {
  const b=new Uint8Array(signature.length+5);b.set(bytes(signature));
  const v=new DataView(b.buffer);v.setInt16(signature.length+1,major,true);v.setInt16(signature.length+3,minor,true);return b;
};
const cases=[];
for(const [type,signature,textVersions,binaryVersions] of [
  ["gam","MAIN",[0],[2,9]], ["tem","CHAR",[0,1,2],[3,4,8]], ["brd","BOARD",[0,1],[2,3,4]],
  ["itm","ITEM",[0,1],[2,3]], ["ste","STATUSE",[0],[2]], ["tan","TILEANIM",[],[0]],
  ["ene","ENEMY",[0],[]], ["bkg","BKG",[0],[]], ["spc","SPLMOVE",[0],[]],
  ["anm","ANIM",[0],[3]], ["fnt","FONT",[0],[]],
]) {
  for(const minor of textVersions) cases.push({type,bytes:bytes(`RPGTLKIT ${signature}\r\n2\r\n${minor}\r\n`),expected:{encoding:"text",version:`2.${minor}`,supported:true}});
  for(const minor of binaryVersions) cases.push({type,bytes:binary(`RPGTLKIT ${signature}`,2,minor),expected:{encoding:"binary",version:`2.${minor}`,supported:true}});
}
for(const detail of [1,2,3,4,5,6]) {
  const tst=new Uint8Array(6);const v=new DataView(tst.buffer);v.setInt16(0,20,true);v.setInt16(4,detail,true);
  cases.push({type:"tst",bytes:tst,expected:{encoding:"binary",version:"20",detail,supported:true}},
    {type:"gph",bytes:bytes(`RPGTLKIT TILE\n2\n0\n${detail}\n0\n`),expected:{encoding:"text",version:"2.0",detail,supported:true}});
}
for(const {type,bytes,expected} of cases) {
  const actual=detectSourceFormat(type,bytes);assert.deepEqual(actual,expected,type);
  assert.ok(formatSummary({type,sourceFormat:actual}).includes(actual.version));
  assert.ok(!formatSummary({type,sourceFormat:actual}).includes("Unsupported"));
  if (actual.detail !== undefined) {
    const labels = ["32 × 32, 24-bit RGB", "16 × 16, 24-bit RGB", "32 × 32, 256-color palette",
      "16 × 16, 256-color palette", "32 × 32, 16-color palette", "16 × 16, 16-color palette"];
    assert.equal(formatSummary({type,sourceFormat:actual}), `${type.toUpperCase()} format ${actual.version}`);
    assert.deepEqual(tileMode({type,sourceFormat:actual}), {label:`Mode ${actual.detail}: ${labels[actual.detail-1]}`,palette:actual.detail>=3});
  }
}
for(const [type,data,version] of [["tem",binary("RPGTLKIT CHAR",2,9),"2.9"],["brd",bytes("RPGTLKIT BOARD\n2\n9\n"),"2.9"],
  ["tbm",binary("RPGTLKIT TILEBITMAP",3,0),"3.0"]]) {
  const f=detectSourceFormat(type,data);assert.equal(f.version,version);assert.equal(f.supported,false);
  assert.match(formatSummary({type,sourceFormat:f}),/Unsupported layout/);
  assert.equal(formatSpecTarget({type,sourceFormat:f}).anchor,"#unsupported-versions");
}
for(const type of ["tem","gam","gph","tst","iso","tbm"]) {
  for(const data of [new Uint8Array(),type === "tst" ? Uint8Array.of(20) : bytes("RPGTLKIT CHAR\0\x02")]) {
    const f=detectSourceFormat(type,data);assert.equal(f.version,null);assert.equal(f.supported,false);
    assert.match(formatSummary({type,sourceFormat:f}),/version unavailable/);
  }
}
assert.equal(detectSourceFormat("wav",bytes("RIFF")),undefined);
assert.match(formatSummary({type:"prg",sourceFormat:detectSourceFormat("prg",bytes("#Done()"))}),/No stored file-format version/);
assert.equal(formatSpecTarget({type:"___"}).anchor,"#unversioned-observed-layout");
assert.deepEqual(mainSourceFormat({major:2,minor:0}),{encoding:"text",version:"2.0",supported:true});
assert.deepEqual(mainSourceFormat({major:2,minor:2}),{encoding:"binary",version:"2.2",supported:true});
assert.deepEqual(mainSourceFormat({major:2,minor:9}),{encoding:"binary",version:"2.9",supported:true});
// Follow every generated native spec target, including stable links to renamed sections.
const targets=cases.map(({type,expected})=>formatSpecTarget({type,sourceFormat:expected}));
for(const type of ["prg","___","tem","brd","itm","gam","gph","tst","tan","ene","bkg","spc","ste","anm","fnt","tbm","iso"]) targets.push(formatSpecTarget({type}));
for(const {page,anchor} of targets) {
  const markdown=await readFile(new URL(`../docs/specs/${page}.md`,import.meta.url),"utf8");
  const headings=[...markdown.matchAll(/^## (.+)$/gm)].map(m=>"#"+m[1].toLowerCase().replace(/[^\w\- ]/g,"").replaceAll(" ","-"));
  const namedAnchors=[...markdown.matchAll(/<a name="([^"]+)"><\/a>/g)].map(m=>`#${m[1]}`);
  assert.ok([...headings, ...namedAnchors].includes(anchor),`${page}.md${anchor}`);
}
const zip=new JSZip();
for(const {path,bytes} of [...fixtures,...detailFixtures])zip.file(path,bytes);
zip.file("Chrs/unsupported.tem",binary("RPGTLKIT CHAR",2,9));
zip.file("Chrs/truncated.tem",bytes("RPGTLKIT CHAR"));
const {artifacts}=await readArtifacts(zip,{});const graph=buildReferences(artifacts);
for(const a of artifacts.values())if(toolkitAsset(a.type)) {
  assert.ok(a.sourceFormat,a.path);
  if (["decoded", "partial"].includes(a.decodeStatus) && a.type !== "___") assert.ok(a.sourceFormat.supported, a.path);
  const record=artifactRecord(a,graph);
  assert.deepEqual(record.sourceFormat,a.sourceFormat,a.path);
  assert.ok(!Object.hasOwn(record.data,"sourceFormat"));
}
const unsupported=artifactRecord(artifacts.get("Chrs/unsupported.tem"),graph);
assert.equal(unsupported.decode.status,"error");assert.equal(unsupported.sourceFormat.version,"2.9");
assert.equal(artifacts.get("Chrs/truncated.tem").sourceFormat.version,null);
console.log("Source formats passed: all supported revisions/details, unsupported and truncated headers, external GAM, unversioned source, exported metadata and spec anchors.");
