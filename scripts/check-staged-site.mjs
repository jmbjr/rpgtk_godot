import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";
import { productionModule, verifyProductionFile } from "./production-policy.mjs";

const site = resolve(process.argv[2] || "site");
const html = await readFile(join(site, "index.html"), "utf8");
for (const [, src] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']\.\/([^"']+)["']/g))
  await access(join(site, src));

// Inspect every published path, including lazy targets and unreferenced files.
// Only third-party code and inert fixture/evidence payloads are outside policy.
const entryPoints = [];
let inspected = 0;
async function verifyPublishedFiles(folder = "") {
  for (const entry of await readdir(join(site, folder), { withFileTypes: true })) {
    const path = join(folder, entry.name).replaceAll("\\", "/");
    assert.ok(!entry.isSymbolicLink(), "Unexpected staged symlink: " + path);
    if (entry.isDirectory()) await verifyPublishedFiles(path);
    else {
      inspected++;
      const content = /\.(?:m?js|html|css|svg|json|map)$/i.test(path) ? await readFile(join(site, path), "utf8") : "";
      verifyProductionFile(path, content);
      if (productionModule(path)) entryPoints.push(join(site, path));
    }
  }
}
await verifyPublishedFiles();

await build({
  entryPoints,
  bundle: true,
  outdir: join(site, "__validation_only__"),
  platform: "browser",
  format: "esm",
  write: false,
  logLevel: "silent",
});
console.log("Published viewer passed: " + inspected + " staged files inspected, every first-party module/import resolves, and retired adapters and game-specific inspection selectors are absent.");
