import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium } from "playwright";
import { buildBrowserGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { nativeMainFixture } from "../docs/specs/fixtures/native-main-29-fixtures.mjs";

const site = resolve(process.argv[2] ?? "site");
const types = new Map([["html", "text/html"], ["js", "text/javascript"],
  ["mjs", "text/javascript"], ["css", "text/css"], ["json", "application/json"]]);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = resolve(site, "." + (pathname === "/" ? "/index.html" : pathname));
  try {
    if (!file.startsWith(site + sep)) throw Error("Outside staged site");
    const bytes = await readFile(file);
    response.writeHead(200, { "Content-Type": types.get(file.split(".").at(-1)) ??
      "application/octet-stream" }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.TK3_CHROMIUM || undefined });
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const base = "http://127.0.0.1:" + server.address().port;
  const control = id => page.locator("#" + id);
  const click = id => control(id).click();
  const expectText = (id, hasText) => control(id).filter({ hasText }).waitFor();
  const variables = value => expectText("play-script-variables", value);
  const board = value => expectText("play-heading", value);
  const talk = () => click("play-talk");
  const gamPlay = () => click("play-gam-startup");
  const directPlay = () => click("play-bstw");
  const archive = async (name, buffer) => {
    await control("archive").setInputFiles({ name, mimeType: "application/zip", buffer });
    await expectText("archive-status", /files/);
    await control("play-launch").waitFor();
  };
  const move = async (key, arrival) => {
    await page.keyboard.down(key);
    try { await arrival(); }
    finally { await page.keyboard.up(key); }
  };
  const observeFight = async () => {
    await control("play-fight-test").waitFor();
    await page.getByRole("button", { name: "Simulate victory (test only)", exact: true }).waitFor();
    await page.getByRole("button", { name: "Simulate defeat (test only)", exact: true }).waitFor();
  };

  await page.goto(base);
  // Selecting a conflicting inspector GAM before opening the ZIP cannot
  // change which GAM owns startup, keys, board, character or game over.
  const mainFile = { name: "inspection.gam", mimeType: "application/octet-stream", buffer: nativeMainFixture };
  await control("main-file").setInputFiles(mainFile);
  await expectText("main-status", /inspection.gam/);
  await archive("harbor-browser.zip", await buildBrowserGame("harbor"));
  await gamPlay();
  await board(/HarborLab\/Boards\/wharf.brd/);
  await variables(/launched = 7.*clues = 3.*maxclues = 9/);
  await page.keyboard.press("e");
  await expectText("play-dialogue-text", /tide is rising/);
  await expectText("play-dialogue-progress", /HarborLab\/Prg\/weather_clock.prg:5/);
  await page.keyboard.press("e");
  await variables(/caller_resumed = 1/);
  await page.getByRole("button", { name: "E · station_report.prg" }).click();
  await expectText("play-dialogue-text", /tide is rising/);
  await talk();
  await variables(/caller_resumed = 2/);
  await page.keyboard.press("b");
  await expectText("play-script-diagnostic", /broken_helper.prg:3/);
  assert.doesNotMatch(await control("play-script-variables").textContent(), /untouched|wrong/);
  await talk();
  await expectText("play-dialogue-text", /Foreign archive dialogue/);
  await talk();
  await expectText("play-script-diagnostic", /missing.brd.*missing/);
  await board(/wharf.brd/);
  await move("ArrowRight", () => board(/channel.brd/));
  await variables(/caller_resumed = 2/);
  await page.keyboard.press("h");
  await board(/beacon.brd/);
  await expectText("play-status", /layer 2/);
  await observeFight();
  await click("play-fight-abort");
  await control("play-fight-test").waitFor({ state: "hidden" });
  assert.doesNotMatch(await control("play-script-variables").textContent(), /arrived|won/);
  await talk();
  await expectText("play-dialogue-text", /sentinel challenges/);
  await talk();
  await observeFight();
  await click("play-fight-defeat");
  await control("play-gameover-test").waitFor();
  await click("play-gameover-restart");
  await board(/wharf.brd/);
  await variables(/launched = 7.*clues = 3/);
  assert.doesNotMatch(await control("play-script-variables").textContent(), /tide|won/);

  // Induce a canvas failure while the next board mounts off-DOM.
  await page.evaluate(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      HTMLCanvasElement.prototype.getContext = getContext;
      return null;
    };
  });
  await move("ArrowRight", () => expectText("play-script-diagnostic", /Unable to render destination/));
  await board(/wharf.brd/);
  const prior = await control("play-status").textContent();
  // Keyboard movement remains operational on the original board.
  await page.keyboard.down("ArrowDown");
  try { await page.waitForFunction(prior => document.querySelector("#play-status").textContent !== prior, prior); }
  finally { await page.keyboard.up("ArrowDown"); }
  await click("play-reset");
  await variables(/launched = 7/);
  await click("play-close");

  await archive("grove-browser.zip", await buildBrowserGame("grove"));
  await control("main-file").setInputFiles(mainFile);
  await gamPlay();
  await board(/^Authored board · Boards\/meadow.brd$/);
  await variables(/none yet/);
  await talk();
  await board(/ridge.brd/);
  await variables(/travelled = 1/);
  await talk();
  await expectText("play-dialogue-text", /sentinel challenges/);
  await talk();
  await observeFight();
  await click("play-fight-simulate");
  await expectText("play-dialogue-text", /Sentinel defeated/);
  await talk();
  await variables(/won = 1/);
  assert.equal(await control("play-talk").isDisabled(), true);
  await click("play-reset");
  await board(/meadow.brd/);
  await variables(/none yet/);
  await talk();
  await board(/ridge.brd/);
  await talk();
  await talk();
  await click("play-fight-defeat");
  await board(/meadow.brd/);
  await expectText("play-dialogue-text", /Recover on the meadow/);
  await talk();
  await variables(/travelled = 1.*recovered = 1/);
  assert.doesNotMatch(await control("play-script-variables").textContent(), /won/);
  await click("play-close");

  await archive("blocked-browser.zip", await buildBrowserGame("harbor", { blockStartup: true }));
  await gamPlay();
  await expectText("gam-startup-status", /harbor_start.prg:2/);
  await directPlay();
  await variables(/none yet/);
  await move("ArrowRight", () => board(/channel.brd/));
  await click("play-reset");
  await board(/wharf.brd/);
  await variables(/none yet/);
  assert.deepEqual(errors, []);
  console.log("Staged browser passed: two independent TK3 ZIPs, inspector isolation, rooted GAM helper, keyboard and touch controls, Send continuation, both fight outcomes and launch-mode reset.");
} finally {
  await browser?.close();
  server.close();
}
