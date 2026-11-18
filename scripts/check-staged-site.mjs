import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { build } from "esbuild";

const site = resolve(process.argv[2] || "site");
const html = await readFile(join(site, "index.html"), "utf8");
for (const [, src] of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']\.\/([^"']+)["']/g))
  await access(join(site, src));

// Walk the actual staged directory, including modules unreferenced by app.mjs.
const retired = /bstw-(?:compatibility|title|ending)|tk3-source-(?:dialogue|menu)|(?:imported-inn|inn-dialogue)\.mjs|(?:^|\/)sandbox\.(?:html|mjs)$|play-(?:compatibility|script-recovery)|Demo\/Prg\/start\.prg/i;
async function verifyPublishedFiles(folder = "") {
  for (const entry of await readdir(join(site, folder), { withFileTypes: true })) {
    const path = join(folder, entry.name);
    assert.doesNotMatch(path, retired);
    if (entry.isDirectory()) await verifyPublishedFiles(path);
    else if (/\.(?:html|mjs|css)$/.test(path) && !path.startsWith("vendor/"))
      assert.doesNotMatch(await readFile(join(site, path), "utf8"), retired, path);
  }
}
await verifyPublishedFiles();

await build({
  entryPoints: [join(site, "app.mjs")],
  bundle: true,
  outdir: join(site, "__validation_only__"),
  platform: "browser",
  format: "esm",
  write: false,
  logLevel: "silent",
});
console.log("Published viewer passed: HTML entrypoint and browser module graph resolve, and retired game-specific files and imports are absent.");
