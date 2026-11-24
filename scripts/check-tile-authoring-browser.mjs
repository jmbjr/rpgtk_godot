import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium } from "playwright";
import { readStandaloneTile } from "../artifacts.mjs";
import { readProject } from "../authoring-project.mjs";

const site = resolve(process.argv[2] ?? "site");
const fixture = await readFile(new URL("../docs/specs/fixtures/synthetic-tile-project.json", import.meta.url));
const baseline = JSON.parse(fixture);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = resolve(site, "." + (pathname === "/" ? "/index.html" : pathname));
  try {
    assert.ok(file.startsWith(site + sep));
    const bytes = await readFile(file);
    const types = { html: "text/html", mjs: "text/javascript", js: "text/javascript", css: "text/css" };
    res.writeHead(200, { "Content-Type": types[file.split(".").at(-1)] ?? "application/octet-stream" });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
let sourceServer;
let base;
if (process.argv.includes("--source")) {
  sourceServer = spawn("python3", ["scripts/serve-viewer.py", "--port", "0"], { stdio: ["ignore", "pipe", "inherit"] });
  base = await new Promise((ready, reject) => {
    sourceServer.stdout.once("data", bytes => ready(bytes.toString().trim()));
    sourceServer.once("error", reject);
    sourceServer.once("exit", code => reject(new Error(`Viewer server exited (${code}).`)));
  });
} else {
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  base = "http://127.0.0.1:" + server.address().port;
}
const errors = [];
let browser, page;
const contributor = {
  id: "synthetic-contributor", name: "Synthetic contributor",
  skills: ["diagnostic drawing"], tools: ["web pencil"],
};
const expected = Array(1024).fill(0);
const openBrief = () => page.getByRole("button", { name: "Open brief · Draw diagnostic pixels" }).click();
const openProject = async bytes => {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Author a project tile" }).click(),
  ]);
  await chooser.setFiles({
    name: "synthetic-project.json", mimeType: "application/json", buffer: bytes,
  });
  await page.getByText("Opened synthetic-project.json.", { exact: true }).waitFor();
};
async function freshPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base);
  return page;
}
async function save() {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save proposed variant and download project" }).click(),
  ]);
  const bytes = await readFile(await download.path());
  return { bytes, project: readProject(JSON.parse(bytes)) };
}
async function paint(x, y, color, packed) {
  await page.getByLabel("Pencil color").fill(color);
  const pencil = page.locator("#tile-pencil");
  const box = await pencil.boundingBox();
  await pencil.click({ position: { x: (x + .5) * box.width / 32, y: (y + .5) * box.height / 32 } });
  expected[x * 32 + y] = packed;
}
function checkTile(revision, pixels) {
  const tile = readStandaloneTile(new TextEncoder().encode(revision.gph));
  assert.deepEqual([tile.width, tile.height, tile.detail, tile.compressed], [32, 32, 1, false]);
  assert.deepEqual(tile.pixels, pixels);
}
async function checkPreview(pixels) {
  const rgba = await page.locator("#tile-actual").evaluate(canvas =>
    [...canvas.getContext("2d").getImageData(0, 0, 32, 32).data]);
  const expectedRgba = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const color = pixels[x * 32 + y];
      expectedRgba.push(color & 255, (color >>> 8) & 255, color >>> 16, 255);
    }
  }
  assert.deepEqual(rgba, expectedRgba);
}
function checkAssignment(variant) {
  assert.deepEqual(variant.requirement, { id: "A01", revision: 2 });
  assert.equal(variant.workItemId, "work-pixel");
  assert.equal(variant.routeId, "web-pencil");
  for (const revision of variant.revisions) {
    assert.deepEqual(revision.contributor, contributor);
    assert.equal(revision.status, "proposed");
    assert.equal(revision.source, "embedded-gph");
    assert.equal(revision.output, "embedded-gph");
  }
}
try {
  browser = await chromium.launch({ executablePath: process.env.TK3_CHROMIUM || undefined });
  page = await freshPage();
  await page.locator("#archive").setInputFiles(resolve(site, "tk2-legacy-game.zip"));
  await page.locator("#opened-archive").filter({ hasText: "tk2-legacy-game.zip" }).waitFor();
  const archiveFiles = await page.locator("#folder-list").innerText();
  await openProject(fixture);
  assert.match(await page.locator("#tile-work").innerText(), /Contributor fit unknown.*Readiness: unverified/s);
  await page.getByLabel("Contributor ID").fill(contributor.id);
  await page.getByLabel("Display name").fill(contributor.name);
  await page.getByLabel("Skills (comma-separated)").fill(contributor.skills[0]);
  await page.getByLabel("Tools (comma-separated)").fill(contributor.tools[0]);
  await page.getByRole("button", { name: "Apply contributor" }).click();
  const filter = page.getByLabel("Show suitable work only");
  await filter.check();
  assert.match(await page.locator("#tile-work-summary").innerText(), /1 shown · 1 hidden/);
  await filter.uncheck();
  assert.match(await page.locator("#tile-work").innerText(), /Undeclared skill: pattern tracing · Readiness: unverified/);
  await openBrief();
  assert.match(await page.locator("#tile-brief").innerText(), /P01 .* → A01 r2 .* → work-pixel/);
  await page.getByRole("button", { name: "Draw a new tile" }).click();
  await page.getByLabel("Variant name").fill("Diagnostic A");
  await paint(3, 19, "#ff0000", 255);
  await paint(20, 7, "#00ff00", 65280);
  await paint(31, 1, "#0000ff", 16711680);
  const first = await save();
  assert.equal(await page.locator("#folder-list").innerText(), archiveFiles);
  assert.equal(first.project.variants.length, 1);
  const initial = first.project.variants[0];
  checkAssignment(initial);
  checkTile(initial.revisions[0], expected);

  await page.context().close();
  page = await freshPage();
  await openProject(first.bytes);
  assert.equal(await page.getByLabel("Contributor ID").inputValue(), contributor.id);
  await openBrief();
  await page.getByRole("button", { name: "Open Diagnostic A revision 1" }).click();
  await checkPreview(expected);
  await paint(3, 19, "#332211", 0x112233);
  const second = await save();
  const edited = second.project.variants[0];
  assert.equal(edited.id, initial.id);
  assert.equal(edited.revisions.length, 2);
  assert.deepEqual(edited.revisions[0], initial.revisions[0]);
  assert.equal(edited.revisions[1].basedOn, initial.revisions[0].id);
  assert.notEqual(edited.revisions[1].id, initial.revisions[0].id);
  checkAssignment(edited);
  checkTile(edited.revisions[1], expected);

  await page.getByRole("button", { name: "Draw a new tile" }).click();
  await page.getByLabel("Variant name").fill("Diagnostic B");
  const third = await save();
  assert.equal(third.project.variants.length, 2);
  assert.deepEqual(third.project.variants[0], edited);
  checkAssignment(third.project.variants[1]);
  assert.notEqual(third.project.variants[1].id, edited.id);
  assert.deepEqual(third.project.projectRequirements, baseline.projectRequirements);
  assert.deepEqual(third.project.assetRequirements, baseline.assetRequirements);
  assert.deepEqual(third.project.workItems, baseline.workItems);
  assert.equal("reviews" in third.project || "buildSelections" in third.project, false);

  await page.context().close();
  page = await freshPage();
  await openProject(third.bytes);
  await openBrief();
  await page.getByRole("button", { name: "Open Diagnostic B revision 1" }).waitFor();
  await page.getByRole("button", { name: "Open Diagnostic A revision 2" }).click();
  await checkPreview(expected);
  const broken = structuredClone(third.project);
  delete broken.variants[0].revisions[0].gph;
  await page.getByLabel("Project manifest").setInputFiles({
    name: "broken.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(broken)),
  });
  await page.getByText(/Could not open project.*Missing or oversized embedded GPH/).waitFor();
  await checkPreview(expected);
  assert.deepEqual(errors, []);
  console.log("Tile authoring passed in Chromium: attribution and readiness, all 1,024 decoded pixels, fresh-session reopen, immutable revision history, parallel proposals, missing artwork and independent archive inspection.");
} finally {
  await browser?.close();
  sourceServer?.kill();
  if (server.listening) server.close();
}
