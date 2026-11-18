import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import JSZip from "../vendor/jszip.min.js";
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
  const directPlay = async () => {
    await control("play-board-diagnostics").locator("summary").click();
    await click("play-direct");
  };
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

  await page.addInitScript(() => {
    window.frameAudioStarts = 0;
    const createUrl = URL.createObjectURL;
    URL.createObjectURL = function (blob) {
      if (blob.type === "application/json") window.exportedGame = blob.text();
      return createUrl.call(this, blob);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer) window.frameAudioStarts++;
      return start.apply(this, args);
    };
  });
  await page.goto(base);
  // Selecting a conflicting inspector GAM before opening the ZIP cannot
  // change which GAM owns startup, keys, board, character or game over.
  const mainFile = { name: "inspection.gam", mimeType: "application/octet-stream", buffer: nativeMainFixture };
  await archive("harbor-browser.zip", await buildBrowserGame("harbor"));
  await expectText("bindings", /HarborLab\/Prg\/harbor_start.prg/);
  await control("main-file").setInputFiles(mainFile);
  await expectText("main-status", /inspection.gam/);
  await gamPlay();
  await board(/HarborLab\/Boards\/wharf.brd/);
  await expectText("play-launch-mode", /Game startup/);
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
  await expectText("gam-startup-status", /harbor_start.prg:2.*Board diagnostics/);
  assert.equal(await control("play-direct").isVisible(), false);
  await directPlay();
  await expectText("play-launch-mode", /Direct board diagnostic/);
  await variables(/none yet/);
  await move("ArrowRight", () => board(/channel.brd/));
  await expectText("play-launch-mode", /Direct board diagnostic/);
  await click("play-reset");
  await board(/wharf.brd/);
  await expectText("play-launch-mode", /Direct board diagnostic/);
  await variables(/none yet/);
  // Replacing the archive while the direct session is active clears its state.
  await archive("fresh-grove.zip", await buildBrowserGame("grove"));
  await gamPlay();
  await board(/meadow.brd/);
  assert.equal(await page.locator("#play-compatibility, #play-script-recovery, #play-hud").count(), 0);
  assert.deepEqual(adapterRequests, []);
  await variables(/none yet/);
  await click("play-close");
  // Reload the document to clear the unrelated inspection GAM. Exports
  // below must include exactly the archive's files, including unused ones.
  await page.goto(base);
  const pathIs = path => expectText("source-path", path);
  const file = async path => {
    const folder = path.slice(0, path.lastIndexOf("/") + 1);
    await page.locator(`#folder-list button[data-folder="${folder}"]`).click();
    await page.locator(`#file-list button[title="${path}"]`).click();
    await pathIs(path);
  };
  const follow = async label => {
    const link = page.locator("#connections .edge-list button").filter({ hasText: label }).first();
    await link.evaluate(button => { button.closest("details").open = true; });
    await link.click();
  };
  const accountForArchive = async bytes => {
    const zip = await JSZip.loadAsync(bytes);
    const paths = Object.values(zip.files).filter(item => !item.dir).map(item => item.name).sort();
    await expectText("main-data", "Archive coverage · " + paths.length + " files");
    const received = page.waitForEvent("download");
    await click("export-game-json");
    assert.match((await received).suggestedFilename(), /-game\.json$/);
    const exported = JSON.parse(await page.evaluate(() => window.exportedGame));
    assert.deepEqual(Object.values(exported.artifacts).map(item => item.path).sort(), paths);
    assert.equal(exported.archive.fileCount, paths.length);
    assert.equal(Object.values(exported.coverage.decodeCounts).reduce((sum, count) => sum + count, 0), paths.length);
    return exported;
  };
  const playWave = async ({ pause = false } = {}) => {
    await page.locator("#graph audio").evaluate(audio => {
      audio.addEventListener("playing", () => { audio.dataset.played = "true"; }, { once: true });
    });
    await page.getByRole("button", { name: "Play WAV", exact: true }).click();
    await page.locator('#graph audio[data-played="true"]').waitFor({ state: "attached" });
    if (pause) {
      await page.getByRole("button", { name: "Pause WAV", exact: true }).click();
      assert.equal(await page.locator("#graph audio").evaluate(audio => audio.paused), true);
    }
    await page.getByRole("button", { name: "Reset WAV to beginning", exact: true }).click();
    assert.equal(await page.locator("#graph audio").evaluate(audio => audio.currentTime), 0);
  };
  const playMidi = async () => {
    await page.getByLabel("Playback synth").selectOption("builtin");
    await page.getByRole("button", { name: "Play MIDI", exact: true }).click();
    await page.getByRole("button", { name: "Pause MIDI", exact: true }).click();
    await expectText("graph", "MIDI paused.");
    await page.getByRole("button", { name: "Reset MIDI to beginning", exact: true }).click();
    await expectText("graph", "MIDI reset to beginning.");
  };

  const legacyBytes = await readFile(resolve(site, "tk2-legacy-game.zip"));
  await archive("tk2-legacy-game.zip", legacyBytes);
  const legacy = await accountForArchive(legacyBytes);
  const tk2 = "Game/TK2LegacyLab/";
  assert.equal(legacy.artifacts["rpgtk:/Main/TK2LegacyLab.gam"].projectRoot, tk2);
  await file("Main/TK2LegacyLab.gam");
  await follow(/Opening board.*room.brd/);
  await pathIs(tk2 + "Boards/room.brd");
  await follow(/Board tile lookup.*\.tst/);
  await page.locator('#graph .tile-grid button[aria-pressed="true"]').waitFor();
  await page.goBack();
  await pathIs(tk2 + "Boards/room.brd");
  await page.goForward();
  await page.locator('#graph .tile-grid button[aria-pressed="true"]').waitFor();
  await file(tk2 + "Bkrounds/bkg-text-20-diagnostic.bkg");
  await follow(/Music.*note.mid/);
  await playMidi();
  await page.goBack();
  await pathIs(tk2 + "Bkrounds/bkg-text-20-diagnostic.bkg");
  await follow(/Select sound.*tone.wav/);
  await playWave();

  const nativeBytes = await buildBrowserGame("harbor", { nativeEncounters: true });
  await archive("native-explorer.zip", nativeBytes);
  const native = await accountForArchive(nativeBytes);
  const tk3 = "HarborLab/";
  const boardId = "rpgtk:/" + tk3 + "Boards/wharf.brd";
  const send = native.artifacts[boardId].references.outgoing.find(ref => ref.inlineSlot === 0);
  assert.equal(send.target.$ref, "rpgtk:/" + tk3 + "Boards/channel.brd");
  assert.equal(send.line, 1);
  assert.equal(native.scriptTrace.entries.find(entry => entry.inlineSlot === 0).status, "Inline");
  const probe = tk3 + "Prg/media_probe.prg";
  const mediaEdges = native.artifacts["rpgtk:/" + probe].references.outgoing;
  assert.deepEqual(mediaEdges.map(edge => edge.status),
    ["resolved", "resolved", "dynamic", "missing", "unindexed"]);
  await file(tk3 + "Boards/channel.brd");
  await follow(/send.*line 1.*channel.brd/i);
  await pathIs(tk3 + "Boards/wharf.brd");
  await page.locator("#inline-program-0-line-1.active-line").waitFor();
  await page.goBack();
  await pathIs(tk3 + "Boards/channel.brd");
  await page.goForward();
  await page.locator("#inline-program-0-line-1.active-line").waitFor();

  await file(tk3 + "Chrs/mira.tem");
  await follow(/Walk South animation.*test_south.anm/);
  await pathIs(tk3 + "Misc/test_south.anm");
  const animation = page.getByRole("button", { name: "Play animation", exact: true });
  const beforeAudio = await page.evaluate(() => window.frameAudioStarts);
  await animation.click();
  await page.waitForFunction(count => window.frameAudioStarts > count, beforeAudio);
  assert.match(await control("graph").innerText(), /Frame 2 of 2/);
  await follow(/Frame 2 image.*test-characters.tst15/);
  await page.locator('#graph [data-tile="15"][aria-pressed="true"]').waitFor();
  await page.goBack();
  await pathIs(tk3 + "Misc/test_south.anm");
  await follow(/Frame 2 sound.*tick.wav/);
  await playWave({ pause: true });
  await follow(/wav.*line 2.*tick.wav/i);
  await pathIs(probe);
  await page.locator("#source #line-2.active-line").waitFor();
  await page.goBack();
  await pathIs(tk3 + "Media/tick.wav");
  await page.goForward();
  await page.locator("#source #line-2.active-line").waitFor();

  await file(tk3 + "Enemy/sentinel.ene");
  await expectText("graph", "ENE · Binary 2.1");
  await page.locator('#graph a[href$="/ene.md#binary-21"]').waitFor();
  await page.locator('#graph canvas[aria-label="Frame preview for test_south.anm"]').waitFor();
  await file(tk3 + "Bkrounds/field.bkg");
  await expectText("graph", "BKG · Binary 2.3");
  await page.waitForFunction(() => document.querySelector("#source img")?.naturalWidth === 16);
  await follow(/Battle background image.*field.png/);
  await pathIs(tk3 + "Bitmap/field.png");
  console.log("Explorer Chromium passed: wrapped TK2 and native TK3 inventory, project edges, exact jumps/history, MIDI, WAV, ANM frame audio and native ENE/BKG previews.");
  assert.deepEqual(errors, []);
  console.log("Staged browser passed: two independent TK3 ZIPs, inspector isolation, rooted GAM helper, keyboard and touch controls, Send continuation, both fight outcomes, launch-mode reset and archive replacement.");
} finally {
  await browser?.close();
  server.close();
}
