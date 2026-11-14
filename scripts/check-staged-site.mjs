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
  "vendor/jszip.min.js", "vendor/webaudio-tinysynth.js"]) {
  await requireFile(path);
}
const html = await readFile(join(site, "index.html"), "utf8");
for (const [, src] of html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["']/g)) {
  await requireFile(src);
}
// esbuild recursively resolves every static import and re-export made by
// app.mjs, exactly as a browser does before running module code. In
// particular this catches accidentally omitting native-board-tail.mjs
// while copying artifacts.mjs into the site directory.
try {
  const result = await build({
    entryPoints: [join(site, "app.mjs")],
    bundle: true,
    platform: "browser",
    format: "esm",
    write: false,
    logLevel: "silent",
  });
  assert.ok(result.outputFiles.length, "No module output from published entrypoint.");
} catch (error) {
  throw new Error(
    "Published Game Explorer cannot start: a JavaScript module is missing " +
    "from the staged site or has an unresolved import. " + error.message,
    { cause: error },
  );
}
console.log("Published viewer passed: HTML script URLs and the complete browser module import graph resolve from " + site);
