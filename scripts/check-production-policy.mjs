import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = await mkdtemp(join(tmpdir(), "rpgtk-production-policy-"));
const put = async (path, value) => {
  await mkdir(join(root, path, ".."), {recursive:true});
  await writeFile(join(root, path), value);
};
const check = () => spawnSync(process.execPath, ["scripts/check-staged-site.mjs", root], {encoding:"utf8"});
try {
  await put("index.html", '<script type="module" src="./app.mjs"></script>');
  await put("experiments/movement-sandbox/sandbox.css", ".play-map { display: block; }");
  await put("app.mjs", 'export const ordinaryCheckbox = input => input.checked;');
  await put("fixtures/quest.expected.json", '{"checked":[1],"clues":13,"game":"BSTW","program":"mwininn.prg"}');
  await put("docs/evidence.md", '# BSTW provenance\nchecked[0]; clues++; updateClues("evidence");');
  await put("bstw-title-fixture.zip", new Uint8Array([1,2,3]));
  assert.equal(check().status, 0, "Fixture/evidence payloads and DOM checkbox state remain legal");
  for (const [path, value, message] of [
    ["unused.js", String.raw`const selectors = [/\bchecked\s*\[/i];`, /Game-specific production assumption/],
    ["unused.mjs", String.raw`const selectors = [/\bclues\s*\+\+/i, /\bupdateclues\s*\(/i];`, /Game-specific production assumption/],
    ["model.mjs", '// Inclusive maximum indices: in BSTW there are nine slots.', /Game-specific production assumption/],
    ["lazy.mjs", 'export const choose = () => import("./bstw-title.mjs");', /Retired production reference/],
    ["experiments/movement-sandbox/inn-contract.json", '{}', /Retired production payload/],
    ["vendor/unreferenced.js", 'export const clues = 13;', /Game-specific production assumption/],
    ["unused.css", '.play-hud::after {content:"Clues: 0 / 13"}', /Game-specific production assumption/],
    ["unused.mjs", 'import "./missing.mjs";', /Could not resolve/],
  ]) {
    await put(path, value);
    const result = check();
    assert.notEqual(result.status, 0, path);
    assert.match(result.stderr + result.stdout, message, path);
    await rm(join(root, path));
  }
} finally { await rm(root, {recursive:true,force:true}); }
console.log("Production policy passed: confirmed selectors/comment, unreferenced JS/CSS/JSON, lazy adapters and missing imports rejected; inert fixtures/evidence and generic checkbox state retained.");
