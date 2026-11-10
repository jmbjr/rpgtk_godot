import { copyFile } from "node:fs/promises";
import { build } from "esbuild";

await build({
  stdin: { contents: 'export { jsPDF } from "jspdf";', resolveDir: process.cwd() },
  outfile: "vendor/jspdf/jspdf.mjs",
  bundle: true,
  format: "esm",
  minify: true,
  legalComments: "linked",
  // Only the vector and raw image APIs are used.
  external: ["html2canvas", "dompurify", "canvg"],
});
await copyFile("node_modules/jspdf/LICENSE", "vendor/jspdf/LICENSE.txt");
