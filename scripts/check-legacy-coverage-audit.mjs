// Exact 57-row matrix audit. Source evidence is not proof of desktop acceptance.
// Read the *actual built archives*, not only manifest declarations.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts } from "../artifacts.mjs";

const ledger = JSON.parse(await readFile(
  new URL("../docs/specs/legacy-coverage-audit.json", import.meta.url)));
const matrix = await readFile(
  new URL("../docs/specs/test-matrix.md", import.meta.url), "utf8");
const rows = matrix.split("\n").filter(line => line.startsWith("| ["));
const labels = rows.map(line => line.match(/^\| \[([^\]]+)\]/)?.[1]);
assert.equal(ledger.schemaVersion, 1);
assert.equal(ledger.records.length, 57, "All known matrix variants must have explicit audit entries");
assert.equal(labels.length, ledger.records.length);
assert.deepEqual(ledger.records.map(record => record.variant), labels,
  "Matrix additions, removals and reorderings must update the explicit audit");
const checked = new Set(["included-viewer-checked", "included-partial-metadata", "evidence-blocked"]);
const counts = Object.fromEntries([...checked].map(x => [x, 0]));
for (const record of ledger.records) {
  assert.ok(checked.has(record.status), record.variant + ": unknown coverage status");
  assert.equal(record.desktop, "pending", "Desktop opening/saving has not been tested");
  assert.ok(["legacy", "text", "package", "blocked"].includes(record.archive));
  assert.ok(Array.isArray(record.paths));
  if (record.status === "evidence-blocked") {
    assert.equal(record.archive, "blocked");
    assert.equal(record.paths.length, 0);
    assert.ok(record.blocker?.length > 30);
    assert.match(rows[ledger.records.indexOf(record)], /Evidence blocker/,
      record.variant + ": blocked matrix row must link to the evidence review");
  } else {
    assert.ok(record.paths.length > 0, record.variant + ": exact file path missing");
    assert.notEqual(record.archive, "blocked");
  }
  counts[record.status]++;
}
assert.deepEqual(counts, {
  "included-viewer-checked": 52,
  "included-partial-metadata": 3,
  "evidence-blocked": 2,
});

const args = process.argv.slice(2);
const paths = {
  legacy: args[0] ?? ledger.output.legacy,
  text: args[1] ?? ledger.output.alternateTextGam,
  wrapper: args[2] ?? ledger.output.cmp1,
};
const readArchive = async path => openGameArchive(await readFile(path),
  bytes => JSZip.loadAsync(bytes));
const archive = {
  legacy: await readArchive(paths.legacy),
  text: await readArchive(paths.text),
};
const artifacts = {};
for (const variant of ["legacy", "text"]) {
  artifacts[variant] = (await readArtifacts(archive[variant], {})).artifacts;
}
const recovered = await readArchive(paths.wrapper);
assert.ok(recovered.file("Main/TK2LegacyLab.gam"));
const projectFiles = zip => Object.values(zip.files).filter(f => !f.dir).map(f => f.name).sort();
assert.deepEqual(projectFiles(recovered), projectFiles(archive.legacy),
  "The CMP1 wrapper restores the same inventory");
const missing = [];
for (const record of ledger.records) {
  if (record.status === "evidence-blocked") continue;
  for (const path of record.paths) {
    if (record.archive === "package") {
      if (path === ledger.output.cmp1) {
        assert.ok(recovered.file("Main/TK2LegacyLab.gam"));
      } else if (path === ledger.output.legacy || path === ledger.output.alternateTextGam) {
        assert.ok((path === ledger.output.legacy ? archive.legacy : archive.text).file(
          path === ledger.output.legacy ? "Main/TK2LegacyLab.gam" : "Main/TK2TextGamLab.gam"));
      } else missing.push(record.variant + ": undocumented package " + path);
    } else {
      const item = artifacts[record.archive].get(path);
      if (!archive[record.archive].file(path) || !item) {
        missing.push(record.variant + ": missing " + path);
        continue;
      }
      // Full PNG and BMP deliberately use the browser's native image decoder,
      // hence 'media' rather than a Toolkit-specific structural decoder.
      const validStatus = ["decoded", "media"].includes(item.decodeStatus);
      if (!validStatus) missing.push(record.variant + ": " + path +
        " decodeStatus=" + item.decodeStatus);
      if (record.status === "included-partial-metadata")
        assert.equal(item.decodeStatus, "decoded", path + ": expected source metadata reader");
    }
  }
}
assert.deepEqual(missing, [], "Every claimed variant must have an actual archived asset");
const generated = {
  schemaVersion: ledger.schemaVersion,
  matrixRows: labels.length, results: counts,
  desktopAcceptance: "deferred",
  evidenceBlockers: ledger.records.filter(r => r.status === "evidence-blocked")
    .map(r => ({ variant: r.variant, reason: r.blocker })),
  completeOnKnownSourceVariants: false,
  notes: "55 of 57 matrix rows have file-backed viewer/static/archive checks. " +
    "Three included rows intentionally support metadata-only or partial interpretation. " +
    "Two rows remain blocked by missing primary specimen evidence. " +
    "No Toolkit 2 desktop or runtime compatibility is claimed.",
};
const output = args[3] ?? "dist/tk2-coverage-audit-results.json";
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(generated, null, 2) + "\n");
console.log("57-row audit passed: 52 included/checkable, 3 included/partial, "
  + "2 evidence-blocked, all desktop checks deferred. Output " + output);
