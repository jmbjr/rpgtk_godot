import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";
import { buildStartupExecutionGame, buildTitleExecutionGame, buildCanvasExecutionGame, buildBoardEntryGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { buildStartupLabZip }
  from "../docs/specs/fixtures/tk3-startup-fixture.mjs";

const folder = resolve(process.argv[2] || "site");
await mkdir(folder, { recursive: true });
for (const spec of scriptFixtureSpecs) {
  const archive = await buildScriptFixtureZip(spec);
  const bytes = await archive.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = "tk3-script-" + spec.id + ".zip";
  await writeFile(resolve(folder, filename), bytes);
  console.log(filename + ": " + bytes.length + " bytes, synthetic Toolkit 3 game.");
}

const startup = await buildStartupLabZip();
const startupBytes = await startup.generateAsync({ type: "uint8array", compression: "DEFLATE" });
await writeFile(resolve(folder, "tk3-script-startup.zip"), startupBytes);
console.log("tk3-script-startup.zip: " + startupBytes.length +
  " bytes, synthetic GAM startup + conditional lantern game.");


for (const id of ["harbor", "grove"]) {
  const zip = await buildStartupExecutionGame(id);
  const filename = "tk3-startup-" + id + ".zip";
  await writeFile(resolve(folder, filename),
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  console.log(filename + ": generic GAM startup, included helper and Talk session.");
}

for (const id of ["harbor", "grove"]) {
  const zip = await buildTitleExecutionGame(id);
  const filename = "tk3-title-" + id + ".zip";
  await writeFile(resolve(folder, filename),
    await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }));
  console.log(filename + ": generic RPGCode title, cursor map, included library and New Game.");
}

for (const id of ["harbor", "grove"]) {
  const zip = await buildCanvasExecutionGame(id);
  const filename = "tk3-canvas-" + id + ".zip";
  await writeFile(resolve(folder, filename),
    await zip.generateAsync({type:"uint8array",compression:"DEFLATE"}));
  console.log(filename + ": native-style canvas, image/pixel services and live input.");
}

for(const id of ["harbor","grove"]) {
  const zip=await buildBoardEntryGame(id);
  await writeFile(resolve(folder,"tk3-entry-"+id+".zip"),await zip.generateAsync({type:"uint8array",compression:"DEFLATE"}));
}
