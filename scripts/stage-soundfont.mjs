import { copyFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";

const output = "vendor/soundfont";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["node_modules/spessasynth_lib/dist/index.js"],
  outfile: `${output}/spessasynth.mjs`,
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "linked",
});
const worklet = "spessasynth_processor.min.js";
await copyFile(`node_modules/spessasynth_lib/dist/${worklet}`, `${output}/${worklet}`);
for (const [name, license] of [
  ["spessasynth_lib", "LICENSE"],
  ["spessasynth_core", "LICENSE"],
  ["fflate", "LICENSE"],
  ["stb-vorbis", "LICENSE"],
]) {
  await copyFile(`node_modules/${name}/${license}`, `${output}/${name}-LICENSE.txt`);
}
