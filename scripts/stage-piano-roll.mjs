import { copyFile } from "node:fs/promises";
import { build } from "esbuild";

await build({
  stdin: {
    contents: 'export { PianoRollSVGVisualizer } from "@magenta/music/esm/core/visualizer.js";',
    resolveDir: process.cwd(),
  },
  outfile: "vendor/piano-roll/magenta.mjs",
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "linked",
});

for (const [source, name] of [
  ["vendor/licenses/Magenta-LICENSE.txt", "Magenta"],
  ["node_modules/staffrender/LICENSE", "staffrender"],
  ["node_modules/node-fetch/LICENSE.md", "node-fetch"],
  ["node_modules/protobufjs/LICENSE", "protobufjs"],
  ...["aspromise", "base64", "eventemitter", "float", "inquire", "utf8", "pool"]
    .map(name => [`node_modules/@protobufjs/${name}/LICENSE`, `protobufjs-${name}`]),
]) {
  await copyFile(source, `vendor/piano-roll/${name}-LICENSE.txt`);
}
