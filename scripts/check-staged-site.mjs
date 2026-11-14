import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";

// Run against the *staged Pages site*, never the source tree. Running a
// parser check against artifacts.mjs alone does not verify that its imports
// are included in the deployed static site.
const site = resolve(process.argv[2] || "site");
async function requireFile(path) {
  const target = join(site, path);
  const details = await stat(target).catch(() => {
    throw new Error("Missing published website asset: " + path);
  });
  assert.ok(details.isFile(), "Published asset is not a file: " + path);
}
for (const path of ["index.html", "app.mjs", "catalog.json", "style.css",
  "sandbox.html", "experiments/movement-sandbox/sandbox.css",
  "vendor/jszip.min.js", "vendor/webaudio-tinysynth.js"]) {
  await requireFile(path);
}
for (const page of ["index.html", "sandbox.html"]) {
  const html = await readFile(join(site, page), "utf8");
  for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["']/g)) {
    await requireFile(src);
  }
}
// esbuild recursively resolves every static import and re-export made by
// app.mjs, exactly as a browser does before running module code. In
// particular this catches accidentally omitting native-board-tail.mjs
// while copying artifacts.mjs into the site directory.
try {
  const result = await build({
    entryPoints: [join(site, "app.mjs"),
      join(site, "experiments/movement-sandbox/sandbox.mjs")],
    bundle: true,
    outdir: join(site, "__validation_only__"),
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  assert.ok(result.outputFiles.length >= 2,
    "Both viewer and movement sandbox browser entrypoints must be staged.");
} catch (error) {
  throw new Error(
    "Published Game Explorer cannot start: a JavaScript module is missing " +
    "from the staged site or has an unresolved import. " + error.message,
    { cause: error },
  );
}
console.log("Published viewer and movement sandbox passed: both HTML entrypoint URLs and complete browser ESM dependency graphs resolve from " + site);
