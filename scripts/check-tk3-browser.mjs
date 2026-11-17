import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { chromium } from "playwright";
import JSZip from "../vendor/jszip.min.js";
import { buildBrowserGame, buildBstwBrowserGame, bstwPlacedRoute } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
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
  const page = await browser.newPage({ hasTouch: true });
  page.setDefaultTimeout(5000);
  const errors = [];
  const adapterRequests = [];
  page.on("request", request => {
    if (/\/(?:bstw-(?:compatibility|title)|tk3-source-(?:dialogue|menu)|imported-inn|inn-dialogue)\./.test(request.url()))
      adapterRequests.push(request.url());
  });
  page.on("pageerror", error => errors.push(error.message));
  const base = "http://127.0.0.1:" + server.address().port;
  const control = id => page.locator("#" + id);
  const click = id => control(id).click();
  const expectText = (id, hasText) => control(id).filter({ hasText }).waitFor();
  const variables = value => expectText("play-script-variables", value);
  const board = value => expectText("play-heading", value);
  const talk = () => click("play-talk");
  const gamPlay = () => click("play-gam-startup");
  const directPlay = () => click("play-direct");
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
  await page.getByRole("button", { name: "E · station_report.prg" }).tap();
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
  const positioned = await control("play-status").textContent();
  await page.getByRole("button", { name: "Move south" }).tap();
  assert.notEqual(await control("play-status").textContent(), positioned);
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
  await page.keyboard.press("t");
  await board(/meadow.brd/);
  await expectText("play-dialogue-text", /Return to the ridge/);
  await talk();
  await board(/ridge.brd/);
  assert.equal(await control("play-talk").isDisabled(), true);
  await variables(/won = 1/);
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
  const noAdapter = async () => {
    assert.equal(await page.locator("#play-hud, #play-inn, #bstw-title-stage, #play-source-menu, #bstw-ending").count(), 0);
    assert.deepEqual(adapterRequests, []);
  };
  await noAdapter();
  await click("play-close");
  await archive("eligible-bstw.zip", await buildBstwBrowserGame());
  await gamPlay();
  await expectText("gam-startup-status", /Startup blocked: BSTW\/Prg\/menuTitle.prg:1/);
  await noAdapter();
  await directPlay();
  await board(/BSTW\/Boards\/start.brd/);
  await noAdapter();
  await talk();
  await expectText("play-script-diagnostic", /CMwin.prg/);
  await page.keyboard.press("q");
  await expectText("play-script-diagnostic", /CMwin.prg/);
  await noAdapter();
  await click("play-close");
  await page.locator("#play-compatibility summary").click();
  await page.getByRole("button", { name: "Bruce Saves the World! compatibility" }).waitFor();
  assert.deepEqual(adapterRequests, []);
  await page.locator("#play-compatibility summary").click();
  const optIn = async () => {
    await page.locator("#play-compatibility summary").click();
    await page.getByRole("button", { name: "Bruce Saves the World! compatibility" }).click();
    await control("bstw-title-stage").waitFor();
    await control("bstw-title-image").waitFor();
    await click("bstw-title-new");
    await board(/BSTW\/Boards\/start.brd/);
  };
  const qButton = page.getByRole("button", { name: /^Q · ENDDEMO\.prg$/i });
  const endWithKey = () => page.keyboard.press("q");
  const endWithButton = () => qButton.tap();
  const clues = count => expectText("play-hud", "Clues: " + count + " / 13");
  const locked = async activate => {
    await activate();
    await expectText("play-feedback", /ending is locked/i);
    await control("bstw-ending").waitFor({ state: "hidden" });
    assert.doesNotMatch(await control("bstw-message").textContent(), /Synthetic ending/);
  };
  const walkTo = async x => {
    await move("ArrowRight", () => page.waitForFunction(destination => {
      const at = document.querySelector("#play-status").textContent.match(/\((\d+),/);
      return Number(at?.[1]) >= destination - 3;
    }, x));
  };
  const loyalis = bstwPlacedRoute.find(target => target.slot === 6);
  const choose = label => control("play-source-menu").getByRole("button", { name: label }).click();
  const openMenu = async () => {
    await page.keyboard.press("m");
    await control("play-source-menu").waitFor();
  };
  const menuClue = async label => {
    await choose(label);
    if (await control("play-source-menu-profiles").isVisible()) await choose("Bruce");
  };
  const placedClues = async (start, repeatInn = false) => {
    let count = start;
    for (const target of bstwPlacedRoute) {
      if (target.slot !== 3) await walkTo(target.x);
      await talk();
      await expectText("bstw-message", target.slot === 6 ? /Opening visit with Loyalis/ :
        "First visit to the " + target.label);
      await talk();
      await clues(++count);
      if (target.slot === 3 && repeatInn) {
        await expectText("play-hud", /Inn visits: 1/);
        await talk();
        await expectText("play-feedback", /Wait .* ms to talk again/);
        await page.waitForTimeout(510);
        await talk();
        await expectText("bstw-message", /Repeat visit to the inn/i);
        await talk();
        await expectText("play-hud", /Clues: 1 \/ 13 · Inn visits: 2/);
        // An unclaimed GAM action executes two ordinary sends from the
        // opening board. The same adapter instance and live variables survive.
        await page.keyboard.press("t");
        await variables(/unrelated = 1/);
        await board(/BSTW\/Boards\/start.brd/);
        await expectText("play-hud", /Clues: 1 \/ 13 · Inn visits: 2/);
      }
    }
  };
  const finish = async activate => {
    await variables(/enddemo = 1/);
    await activate();
    await expectText("bstw-message", /Synthetic ending: the station is restored/);
    await expectText("bstw-progress", /ENDDEMO.prg:8.*1 \/ 3/);
    await talk();
    await expectText("bstw-message", /The archive records your work\.\s+Thank you, traveler\./);
    await talk();
    await expectText("bstw-message", /Synthetic finale complete/);
    assert.equal(await control("bstw-ending").isVisible(), false);
    await talk();
    await expectText("bstw-ending", /Demo complete/);
    await expectText("bstw-ending-source", /ENDDEMO.prg:16.*windows\(\)/);
    assert.equal(await qButton.isDisabled(), true);
    assert.equal(await control("play-talk").isDisabled(), true);
  };

  await optIn();
  assert.ok(adapterRequests.some(url => url.endsWith("/bstw-compatibility.mjs")));
  await clues(0);
  await locked(endWithKey);
  await locked(endWithButton);
  await placedClues(0, true);
  await openMenu();
  await choose(/^Tactics/);
  await control("play-source-menu-profiles").waitFor();
  await click("play-source-menu-close");
  await expectText("play-source-menu-note", /cancelled/i);
  await clues(7);
  await menuClue(/^Tactics/);
  await clues(8);
  await menuClue(/^Tactics/);
  await clues(8);
  for (const name of [/^Items/, /^Equipment/, /^Status/, /^Options/]) await menuClue(name);
  await clues(12);
  await click("play-source-menu-close");
  await locked(endWithKey);
  await openMenu();
  await menuClue(/^System/);
  await clues(13);
  await variables(/unrelated = 1/);
  await click("play-source-menu-close");
  await finish(endWithKey);

  // Fresh reset discards the completion and flag. Finishing with a placed
  // clue last also drives the same authored gate through the live store.
  await click("play-reset");
  await expectText("play-hud", /Clues: 0 \/ 13 · Inn visits: 0/);
  await variables(/enddemo = 0/);
  assert.doesNotMatch(await control("play-script-variables").textContent(), /unrelated/);
  await locked(endWithButton);
  await openMenu();
  for (const label of [/^Items/, /^Tactics/, /^Equipment/, /^Status/, /^Options/, /^System/])
    await menuClue(label);
  await clues(6);
  await click("play-source-menu-close");
  await placedClues(6);
  await clues(13);
  await finish(endWithButton);
  await click("bstw-ending-close");
  assert.equal(await control("play-hud").count(), 0);
  await control("play-launch").waitFor();

  const rejectedDialogue = await JSZip.loadAsync(await buildBstwBrowserGame());
  const openingPath = "BSTW/Prg/mwinStartBoardLoad.prg";
  const openingSource = await rejectedDialogue.file(openingPath).async("string");
  rejectedDialogue.file(openingPath, openingSource + "\nunsupportedOpeningAction()");
  const helperPath = "BSTW/Prg/CMwin.prg";
  const helperSource = await rejectedDialogue.file(helperPath).async("string");
  rejectedDialogue.file(helperPath, helperSource + "\n" + "// Synthetic helper comment\n".repeat(300));
  await archive("eligible-bstw-rejected-dialogue.zip", await rejectedDialogue.generateAsync({ type: "nodebuffer" }));
  await directPlay();
  await walkTo(loyalis.x);
  await talk();
  await expectText("play-script-diagnostic", /CMwin\.prg:301: Program exceeds the 300-line subset limit/);
  await click("play-close");
  await optIn();
  await walkTo(loyalis.x);
  await talk();
  await expectText("play-feedback", openingPath + ":" + (openingSource.split("\n").length + 1) +
    ": Unsupported legacy dialogue statement: unsupportedOpeningAction()");
  assert.equal(await control("play-script-diagnostic").isVisible(), false);
  await clues(0);
  await click("play-close");

  await archive("eligible-fallback.zip", await buildBstwBrowserGame({ fallback: true, endingKey: 118 }));
  await optIn();
  await talk();
  await expectText("bstw-message", /ask at the inn/);
  for (let i = 0; i < 4; i++) await talk();
  await expectText("play-hud", /Clues: 1 \/ 13 · Inn visits: 1/);
  assert.equal(await qButton.count(), 0);
  await page.getByRole("button", { name: "V · ENDDEMO.prg" }).tap();
  await expectText("play-script-diagnostic", /CMwin.prg/);
  assert.equal(await control("bstw-ending").isVisible(), false);
  // Loading a different archive while playing drops the compatibility mode
  // and all its DOM, as a user can do from the persistent archive input.
  await archive("fresh-grove.zip", await buildBrowserGame("grove"));
  await gamPlay();
  await board(/meadow.brd/);
  assert.equal(await control("play-hud").count(), 0);
  await variables(/none yet/);
  assert.deepEqual(errors, []);
  console.log("Staged browser passed: two independent TK3 ZIPs, inspector isolation, rooted GAM helper, keyboard and touch controls, Send continuation, both fight outcomes, launch-mode reset, and explicit BSTW New, 13 clues, both Q controls, source dialogue, browser completion, and reset.");
} finally {
  await browser?.close();
  server.close();
}
