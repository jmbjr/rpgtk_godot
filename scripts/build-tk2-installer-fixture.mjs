// Viewer-only fixture for Toolkit's observed CMP1 installer *container*.
// The MZ-named bytes here are an inert synthetic prefix, NOT a Windows
// executable or a usable installer. Never execute or distribute as an app.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";

const input = process.argv[2] ?? "site/tk2-legacy-game.zip";
const output = process.argv[3] ?? "dist/tk2-legacy-cmp1-test-wrapper.zip";
const base = await readFile(input);
const loadZip = bytes => JSZip.loadAsync(bytes);
const original = await openGameArchive(base, loadZip);
assert.ok(Object.keys(original.files).includes("Main/TK2LegacyLab.gam"),
  "Expected the separately built legacy game ZIP");

const prefix = Buffer.from(
  "MZ\nSYNTHETIC CMP1 CONTAINER FIXTURE - NOT AN EXECUTABLE; DO NOT RUN\n",
  "utf8",
);
const footer = Buffer.alloc(12);
footer.write("CMP1", 0, 4, "ascii");
footer.writeUInt32LE(prefix.length, 4);
footer.writeUInt32LE(base.length, 8);
const fakeExecutable = Buffer.concat([prefix, base, footer]);

const date = new Date("2000-01-01T00:00:00Z");
const opts = { createFolders: false, date };
const inner = new JSZip();
inner.file("legacy-cmp1-diagnostic.exe", fakeExecutable, opts);
const outer = new JSZip();
outer.file("setup.inf",
  "SYNTHETIC CMP1 VIEWER IMPORT TEST ONLY\r\n" +
  "The embedded .exe is an inert MZ header with a ZIP payload, not a runnable installer.\r\n",
  opts);
outer.file("zip.zip", await inner.generateAsync({ type: "nodebuffer" }), opts);
const wrapperBytes = await outer.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

// Reopen the *real* outer wrapper through the production importer, then
// compare inventories and every source file's bytes, not only filenames.
const recovered = await openGameArchive(wrapperBytes, loadZip);
const paths = zip => Object.values(zip.files).filter(f => !f.dir).map(f => f.name).sort();
assert.deepEqual(paths(recovered), paths(original), "CMP1 round-trip file inventory");
for (const path of paths(original)) {
  const expected = await original.file(path).async("uint8array");
  const actual = await recovered.file(path).async("uint8array");
  assert.deepEqual(Buffer.from(actual), Buffer.from(expected),
    path + ": CMP1 recovered bytes differ from legacy game");
}
assert.equal(recovered.file("legacy-cmp1-diagnostic.exe"), null);
assert.equal(recovered.file("zip.zip"), null);
assert.equal(recovered.file("setup.inf"), null);

// Also verify that the GitHub Actions artifact ZIP around the installer ZIP
// remains readable (the website importer unwraps a single nested ZIP).
const actionArtifact = new JSZip();
actionArtifact.file("tk2-legacy-cmp1-test-wrapper.zip", wrapperBytes, opts);
const fromArtifact = await openGameArchive(
  await actionArtifact.generateAsync({ type: "nodebuffer" }), loadZip);
assert.deepEqual(paths(fromArtifact), paths(original));

await mkdir(dirname(output), { recursive: true });
await writeFile(output, wrapperBytes);
console.log("Verified " + output + ": synthetic CMP1 installer wrapper recovered " + paths(original).length + " unchanged game files.");
