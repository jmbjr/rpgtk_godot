import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildScriptFixtureZip, scriptFixtureSpecs }
  from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

const folder = resolve(process.argv[2] || "site");
await mkdir(folder, { recursive: true });
for (const spec of scriptFixtureSpecs) {
  const archive = await buildScriptFixtureZip(spec);
  const bytes = await archive.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const filename = "tk3-script-" + spec.id + ".zip";
  await writeFile(resolve(folder, filename), bytes);
  console.log(filename + ": " + bytes.length + " bytes, synthetic Toolkit 3 game.");
}
