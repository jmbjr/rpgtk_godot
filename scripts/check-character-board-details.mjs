import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv from "ajv/dist/2020.js";
import JSZip from "../vendor/jszip.min.js";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { artifactRecord } from "../records.mjs";
import { characterArtworkSprite } from "../sprites.mjs";
import { fixtures } from "../docs/specs/fixtures/format-fixtures.mjs";
import { detailFixtures, characterCases, boardCases } from "../docs/specs/fixtures/detail-fixtures.mjs";
const zip = new JSZip();
for (const {path,bytes} of [...fixtures,...detailFixtures]) zip.file(path,bytes);
zip.file("Tiles/two-tiles.tst",await readFile(new URL("../docs/specs/fixtures/two-tiles.tst",import.meta.url)));
// A known missing quadrant, plus truncated embedded/referenced artwork and condition tails.
zip.remove("Tiles/art-0-1-0-0.gph");
for (const {path,bytes} of detailFixtures) {
  if (/\.(tem|brd)$/.test(path)) zip.file(`broken/${path}`,bytes.subarray(0,-10));
}
const {artifacts}=await readArtifacts(zip,{});
const graph=buildReferences(artifacts);
const ajv=new Ajv({strictTypes:false});
ajv.addSchema(JSON.parse(await readFile(new URL("../docs/specs/tile-record.schema.json",import.meta.url))),"tile-record.schema.json");
const validate=ajv.compile(JSON.parse(await readFile(new URL("../docs/specs/artifact-record.schema.json",import.meta.url))));
const recordFor=path=>{
  const record=JSON.parse(JSON.stringify(artifactRecord(artifacts.get(path),graph)));
  assert.ok(validate(record),`${path}: ${JSON.stringify(validate.errors)}`);
  return record;
};
for (const {path,expectedArtwork} of characterCases) {
  const record=recordFor(path);
  assert.equal(record.decode.status,"partial",path);
  assert.deepEqual(record.data.artwork,expectedArtwork,path);
  for(const frame of record.data.artwork) {
    const sprite=characterArtworkSprite(artifacts.get(path),frame,artifacts,graph);
    assert.equal(sprite.width,frame.width); assert.equal(sprite.height,frame.height);
    const pixel=(x,y)=>[...sprite.pixels.subarray((y*sprite.width+x)*4,(y*sprite.width+x+1)*4)];
    if(frame.pixels) {
      const color=frame.pixels[0];
      assert.deepEqual(pixel(0,0),[color&255,0,0,255]);
      assert.deepEqual(pixel(1,0),[0,255,0,255]);
      assert.deepEqual(pixel(0,1),[255,0,0,255]);
      assert.deepEqual(pixel(1,1),[0,0,0,0]);
    } else for(const part of frame.parts) {
      const edge=record.references.outgoing.find(edge=>edge.evidence===part.evidence);
      assert.ok(edge,part.evidence);
      if(part.value==="art-0-1-0-0.gph") {
        assert.equal(edge.status,"missing"); assert.equal(sprite.missing.length,1); assert.deepEqual(pixel(0,0),[0,0,0,0]);
      } else if (part.value === "two-tiles.tst2") {
        assert.deepEqual(edge.target, { $ref: "rpgtk:/Tiles/two-tiles.tst#/data/tiles/1", tileIndex: 2 });
        assert.deepEqual(pixel(0,0), [0,0,0,255]);
        assert.deepEqual(pixel(0,1), [0,0,255,255]);
      } else {
        assert.equal(edge.target.$ref,`rpgtk:/Tiles/${part.value}`);
        const k=["Attack","Defense","Special move","Defeat","Rest","Custom"].indexOf(frame.kind);
        const color=100+k*10+frame.frame+part.x*1000+part.y*10000;
        assert.deepEqual(pixel(part.x*32,part.y*32),[color&255,(color>>>8)&255,color>>>16,255]);
      }
    }
  }
  assert.equal(artifacts.get(`broken/${path}`).decodeStatus,"error",path);
}
for(const {path,...expected} of boardCases) {
  const record=recordFor(path);
  assert.equal(record.decode.status,"partial",path);
  for(const [key,value] of Object.entries(expected)) assert.deepEqual(record.data[key],value,`${path}: ${key}`);
  const cells=record.data.width*record.data.height*record.data.layers;
  assert.equal(record.data.tileTypes.reduce((n,run)=>n+run.length,0),cells);
  for(let i=0,offset=0;i<record.data.tileTypes.length;i++) {
    const run=record.data.tileTypes[i];assert.equal(run.offset,offset);offset+=run.length;
  }
  assert.equal(record.references.outgoing.find(e=>e.evidence.startsWith("Board program")).target.$ref,"rpgtk:/Prg/start.prg");
  assert.equal(record.references.outgoing.find(e=>e.evidence.startsWith("Item activation program")).target.$ref,"rpgtk:/Prg/start.prg");
  assert.equal(record.references.outgoing.find(e=>e.evidence.startsWith("Item multitask program")).status,"missing");
  assert.equal(artifacts.get(`broken/${path}`).decodeStatus,"error",path);
  const invalid=structuredClone(record);invalid.data.programs[0].condition.initialValue=1;
  assert.equal(validate(invalid),false); // Preserve lexical "01" and expressions, not coerced values.
}
// Every previously supported board layout retains an exhaustive type grid and all slots.
for(const fixture of fixtures.filter(f=>f.path.endsWith(".brd"))) {
  const record=recordFor(fixture.path);
  assert.equal(record.data.tileTypes.reduce((n,run)=>n+run.length,0),record.data.width*record.data.height*record.data.layers);
}
console.log("Character/board details passed: seven TEM layouts, interleaved actions, quadrants, missing art, raw conditions, invisible tile types, RLE spans, and malformed inputs.");
