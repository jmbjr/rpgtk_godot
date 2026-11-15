import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";
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
