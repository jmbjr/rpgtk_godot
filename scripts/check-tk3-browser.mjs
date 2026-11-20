import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import JSZip from "../vendor/jszip.min.js";
import { chromium } from "playwright";
import { buildBrowserGame, buildStartupExecutionGame, buildTitleExecutionGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
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
let checkpoint = "generic player and startup";
const watchdog = setTimeout(() => {
  console.error("Staged browser suite timed out at: " + checkpoint);
  process.exit(1);
}, 120000);
watchdog.unref();
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
    window.midiContexts = [];
    window.midiWorklets = [];
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      constructor(...args) { super(...args); window.midiContexts.push(this); }
    };
    const Worklet = window.AudioWorkletNode;
    window.AudioWorkletNode = class extends Worklet {
      constructor(context, ...args) {
        super(context, ...args);
        const analyser = context.createAnalyser();
        const mute = context.createGain(); mute.gain.value = 0;
        this.connect(analyser); analyser.connect(mute); mute.connect(context.destination);
        window.midiWorklets.push({ node: this, analyser });
      }
    };
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
  for (const id of ["harbor", "grove"]) {
    const harbor = id === "harbor";
    const zip = await buildStartupExecutionGame(id);
    const root = harbor ? "HarborLab/" : "";
    const startup = root + "Prg/" + (harbor ? "harbor_start.prg" : "morning.prg");
    const opening = harbor ? /wharf.brd/ : /meadow.brd/;
    const destination = harbor ? "channel.brd" : "ridge.brd";
    const helperMessage = harbor ? /tide is rising/ : /orchard opens at dawn/;
    const helperLocation = harbor ? /weather_clock.prg:5/ : /orchard.prg:4/;
    const input = harbor ? () => page.keyboard.press("e") : talk;
    const load = async () => archive("startup-" + id + ".zip", await zip.generateAsync({ type: "nodebuffer" }));
    await archive("tk3-startup-" + id + ".zip",
      await readFile(resolve(site, "tk3-startup-" + id + ".zip")));
    await gamPlay();
    await board(opening);
    await expectText("gam-startup-status", /GAM startup started/);
    await expectText("play-dialogue-text", helperMessage);
    await expectText("play-dialogue-progress", helperLocation);
    await variables(/startup_runs = 1/);
    assert.doesNotMatch(await control("play-script-variables").textContent(), /startup_ready|startup_returned|wrong/);
    const standing = await control("play-status").textContent();
    await page.getByRole("button", { name: "Move south" }).tap();
    assert.equal(await control("play-status").textContent(), standing);
    await click("play-reset");
    await expectText("play-dialogue-text", helperMessage);
    await variables(/startup_runs = 1/);
    await input();
    await variables(/startup_ready = 1.*startup_returned = 1/);
    await board(opening);
    await talk();
    await expectText("play-dialogue-text", /Startup prepared this object/);
    await input();
    await variables(/talked = 1/);
    if (harbor) {
      await page.getByRole("button", { name: "E · station_report.prg" }).tap();
      await expectText("play-dialogue-progress", helperLocation);
      await input();
      await variables(/caller_resumed = 2/);
    }
    await click("play-close");
    await directPlay();
    await variables(/none yet/);
    await talk();
    await expectText("play-dialogue-text", /Startup was skipped/);
    await input();
    await click("play-reset");
    await variables(/none yet/);
    await click("play-close");

    const source = await zip.file(startup).async("string");
    zip.file(startup, 'Send("' + destination + '", 19, 27, 1)\n' + source);
    await load();
    await gamPlay();
    await board(new RegExp(destination.replace(".", "\\.")));
    await expectText("play-dialogue-text", helperMessage);
    await input();
    await board(opening);
    await variables(/startup_ready = 1.*startup_returned = 1/);
    await click("play-close");

    zip.file(startup, 'startup_started = 1\nSend("missing.brd",19,27,1)\n' + source);
    await load();
    await gamPlay();
    await expectText("play-script-diagnostic", /missing.brd.*missing/);
    await board(opening);
    await variables(/startup_started = 1/);
    const at = await control("play-status").textContent();
    await page.getByRole("button", { name: "Move south" }).tap();
    assert.notEqual(await control("play-status").textContent(), at);
    await click("play-close");

    zip.file(startup, 'mwin("Ready to travel.")\nwait()\nSend("' + destination + '",19,27,1)\n' + source);
    await load();
    await gamPlay();
    await expectText("play-dialogue-text", /Ready to travel/);
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (...args) {
        HTMLCanvasElement.prototype.getContext = original;
        return null;
      };
    });
    await input();
    await expectText("play-script-diagnostic", /Unable to render destination/);
    await board(opening);
    const afterFailure = await control("play-status").textContent();
    await page.getByRole("button", { name: "Move south" }).tap();
    assert.notEqual(await control("play-status").textContent(), afterFailure);
    await click("play-close");

    zip.file(root + "Prg/win.prg", "startup_won = 1");
    zip.file(startup, 'fightEnemy("sentinel.ene","field.bkg")\n' + source);
    await load();
    await gamPlay();
    await observeFight();
    await click("play-fight-simulate");
    await expectText("play-dialogue-text", helperMessage);
    await input();
    await variables(/startup_won = 1.*startup_returned = 1/);
    await click("play-reset");
    await observeFight();
    if (harbor) {
      await click("play-fight-defeat");
      await control("play-gameover-test").waitFor();
      await click("play-gameover-restart");
      await observeFight();
      assert.doesNotMatch(await control("play-script-variables").textContent(), /startup_won|startup_returned/);
    } else {
      await click("play-fight-defeat");
      await expectText("play-dialogue-text", /Recover on the meadow/);
      await input();
      await board(opening);
      await variables(/recovered = 1/);
      assert.doesNotMatch(await control("play-script-variables").textContent(), /startup_won|startup_returned/);
      await click("play-reset");
      await observeFight();
    }
    await click("play-fight-abort");
    const afterCancel = await control("play-status").textContent();
    await page.getByRole("button", { name: "Move south" }).tap();
    assert.notEqual(await control("play-status").textContent(), afterCancel);
    await click("play-close");

    for (const failing of ['fightEnemy("missing.ene","field.bkg")', 'eraseItem("source")']) {
      zip.file(startup, failing);
      await load();
      await gamPlay();
      await control("play-script-diagnostic").waitFor();
      const beforeMove = await control("play-status").textContent();
      await page.getByRole("button", { name: "Move south" }).tap();
      assert.notEqual(await control("play-status").textContent(), beforeMove);
      await click("play-close");
    }

    zip.file(startup, source);
    const helper = root + "Prg/" + (harbor ? "weather_clock.prg" : "orchard.prg");
    const method = harbor ? "ReportTide" : "GreetDay";
    zip.file(helper, "method " + method + "()\n{\nunsupportedCommand(18)\n}");
    await load();
    await gamPlay();
    await expectText("gam-startup-status", /Startup blocked: .*\.prg:3:.*unsupportedcommand/);
    assert.equal(await control("play-stage").isVisible(), false);
  }
  console.log("Shared startup Chromium passed: nested and flat GAM helpers, keyboard/touch wait and caller continuation, Talk state, transfer/return, recoverable failures, encounters, reset and direct mode.");

  // Exercise the real hosted bank and worklet through staged production imports.
  // Each reload clears the module cache; route gates make cancellation observable.
  const bankRoute = "**/vendor/generaluser-gs/GeneralUser-GS.sf2";
  const midiZip = await buildTitleExecutionGame("harbor");
  const longerNote = Buffer.from(await midiZip.file("HarborLab/Media/note.mid").async("uint8array"));
  longerNote[13] = 12; // Four seconds: enough to observe remount continuity before looping.
  midiZip.file("HarborLab/Media/note.mid", longerNote);
  midiZip.file("HarborLab/Prg/station_report.prg", "mediaStop(); stopped=1;");
  const startupPath = "HarborLab/Prg/harbor_start.prg";
  const originalStartup = await midiZip.file(startupPath).async("string");
  const loadMidi = async (source = originalStartup) => {
    midiZip.file(startupPath, source);
    await archive("gs-session.zip", await midiZip.generateAsync({type:"nodebuffer"}));
    await gamPlay();
    await expectText("play-screen-text", "Harbor departure");
  };
  const closedContexts = () => page.waitForFunction(() =>
    window.midiContexts.every(context => context.state === "closed"));
  const gsPlaying = () => control("play-audio-status").filter({
    hasText: /Playing MIDI:.*GeneralUser GS 2.0.3/,
  }).waitFor({timeout:20000});
  const sampledAudio = () => page.waitForFunction(() => window.midiWorklets.some(({analyser}) => {
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    return samples.some(sample => Math.abs(sample) > 0.0001);
  }), null, {timeout:20000});

  for (const action of ["stop", "replace", "close", "reset"]) {
    checkpoint = "GS pending bank: " + action;
    console.log(checkpoint);
    await page.reload();
    let releaseBank;
    let requests = 0, bankRequested;
    const requested = new Promise(resolve => { bankRequested = resolve; });
    const gate = new Promise(resolve => { releaseBank = resolve; });
    await page.route(bankRoute, async route => { requests++; bankRequested(); await gate; await route.continue(); });
    await loadMidi(["stop", "replace"].includes(action) ? originalStartup.replace('case(0) { result=Prepare',
      'case(0) { ' + (action === "stop" ? 'mediaStop(); ' : 'mediaPlay("tone.wav"); ') + 'result=Prepare') : originalStartup);
    await expectText("play-audio-status", /Loading MIDI with GeneralUser GS/);
    await requested; // Stop/replacement must happen during an actual pending fetch.
    if (["stop", "replace"].includes(action))
      await control("play-script-choices").getByRole("button", {name:"Depart",exact:true}).click();
    await page.waitForFunction(() => window.midiContexts.length === 1);
    if (action === "close") await click("play-close");
    if (action === "reset") {
      await click("play-reset");
      await expectText("play-screen-text", "Harbor departure");
      await page.waitForFunction(() => window.midiContexts.length === 2 && window.midiContexts[0].state === "closed");
    } else await closedContexts();
    releaseBank();
    if (action === "reset") {
      await gsPlaying(); await sampledAudio();
      assert.equal(await page.evaluate(() => window.midiWorklets.length), 1,
        "Only the new reset session starts a worklet after the shared download");
      assert.equal(requests, 1, "Reset coalesces the pending bank download");
      await click("play-close"); await closedContexts();
    } else {
      // Await the same cached bank promise to prove the delayed load settled.
      await page.evaluate(async () => { const {generalUserGs} = await import("./midi.mjs"); await generalUserGs.arrayBuffer(); });
      assert.equal(await page.evaluate(() => window.midiWorklets.length), 0,
        action + " prevents stale worklet creation");
      if (action === "replace") await expectText("play-audio-status", /Playing WAV:/);
      if (["stop", "replace"].includes(action)) await click("play-close");
    }
    await page.unroute(bankRoute);
  }

  checkpoint = "GS bank failure and retry"; console.log(checkpoint);
  await page.reload();
  let bankRequests = 0;
  await page.route(bankRoute, async route => {
    bankRequests++;
    if (bankRequests === 1) await route.fulfill({status:503,body:"Unavailable"});
    else await route.continue();
  });
  await loadMidi();
  await expectText("play-audio-status", /Unable to play MIDI.*HTTP 503.*note.mid/);
  await closedContexts();
  assert.equal(await page.evaluate(() => window.midiWorklets.length), 0);
  await click("play-reset"); await gsPlaying(); await sampledAudio();
  assert.equal(bankRequests, 2, "A new play retries the failed bank download");
  checkpoint = "GS board remount continuity"; console.log(checkpoint);
  const contextCount = await page.evaluate(() => window.midiContexts.length);
  // Send and normal startup completion both remount the board with these services.
  await click("play-close"); await closedContexts();
  await loadMidi(originalStartup.replace('startup_returned=1; end();',
    'Send("channel.brd",19,27); startup_returned=1; end();'));
  await gsPlaying();
  await control("play-script-choices").getByRole("button", {name:"Depart",exact:true}).click();
  await expectText("play-dialogue-text", /Harbor ready/);
  await page.keyboard.press("Enter");
  await expectText("play-feedback", /GAM startup completed/);
  await gsPlaying();
  assert.equal(await page.evaluate(() => window.midiContexts.length), contextCount + 1,
    "Board transfers and startup completion retain their audio context");
  assert.equal(bankRequests, 2, "Cached bank bytes are reused across sessions");
  // The short synthetic MIDI must finish and restart through the GS transport.
  checkpoint = "GS authored loop"; console.log(checkpoint);
  const loops = await page.evaluate(() => window.midiWorklets.length);
  await page.waitForFunction(count => window.midiWorklets.length > count, loops, {timeout:20000});
  await gsPlaying();
  assert.equal(await page.evaluate(() => window.midiContexts.filter(c => c.state !== "closed").length), 1);
  await page.keyboard.press("e"); await variables(/stopped = 1/);
  await closedContexts();
  assert.equal(await control("play-audio-status").isVisible(), false);
  await click("play-reset"); await gsPlaying();
  await control("play-script-choices").getByRole("button", {name:"Leave",exact:true}).click();
  await expectText("play-feedback", /windows\(\) exited/); await closedContexts();
  await click("play-close");
  await page.unroute(bankRoute);
  await page.reload();
  checkpoint = "GS worklet failure"; console.log(checkpoint);
  const processorRoute = "**/vendor/soundfont/spessasynth_processor.min.js";
  await page.route(processorRoute, route => route.fulfill({status:503,body:"Unavailable"}));
  await loadMidi();
  await expectText("play-audio-status", /Unable to play MIDI.*note.mid/);
  await closedContexts();
  assert.equal(await page.evaluate(() => window.midiWorklets.length), 0);
  await click("play-close");
  await page.unroute(processorRoute);
  await page.reload();
  checkpoint = "existing title, canvas and Explorer regressions";
  console.log("GS gameplay Chromium passed: real SF2/worklet sampled output, loading/failure/retry, loop, board continuity, cached bank, mediaStop and reset/close/exit cancellation.");

  for (const id of ["harbor", "grove"]) {
    const harbor = id === "harbor";
    const title = harbor ? "Harbor departure" : "Orchard morning";
    const begin = harbor ? "Depart" : "Wake";
    const leave = harbor ? "Leave" : "Exit orchard";
    const zipBytes = await readFile(resolve(site, "tk3-title-" + id + ".zip"));
    await archive("renamed-title-" + id + ".zip", zipBytes);
    await gamPlay();
    const menu = control("play-script-choices");
    await menu.getByRole("button", {name:begin,exact:true}).waitFor();
    await expectText("play-screen-text", title);
    await expectText("play-audio-status", harbor ? /Playing MIDI:.*GeneralUser GS 2.0.3/ : /Playing WAV:/);
    assert.equal(await control("play-map-frame").isVisible(), false);
    await variables(/startup_runs = 1/);
    const position = await control("play-status").innerText();
    await page.keyboard.press("ArrowDown");
    if (harbor) {
      await page.keyboard.press("Enter");
      await expectText("play-script-diagnostic", /save\/load is not implemented/);
      await click("play-reset");
      await menu.getByRole("button", {name:begin,exact:true}).waitFor();
    } else {
      await page.keyboard.press("ArrowUp");
    }
    assert.equal(await control("play-status").innerText(), position, "Title navigation cannot move the board actor");
    if (harbor) await page.keyboard.press("Enter");
    else await menu.getByRole("button", {name:begin,exact:true}).tap();
    await expectText("play-dialogue-text", harbor ? "Harbor ready" : "Orchard ready");
    await expectText("play-dialogue-progress", harbor ? /departure.prg:355/ : /greeting.prg:355/);
    await variables(/startup_checksum = 350/);
    await click("play-reset");
    await menu.getByRole("button", {name:begin,exact:true}).waitFor();
    await variables(/startup_runs = 1/);
    assert.doesNotMatch(await control("play-script-variables").innerText(), /startup_checksum/);
    await menu.getByRole("button", {name:begin,exact:true}).tap();
    await expectText("play-dialogue-text", /ready/);
    await page.keyboard.press("Enter");
    await expectText("play-feedback", /GAM startup completed/);
    assert.equal(await control("play-script-screen").isVisible(), false);
    await variables(new RegExp("result = " + (harbor ? 6 : 10)));
    await variables(/startup_ready = 1/);
    assert.doesNotMatch(await control("play-script-variables").innerText(), /wrong/);
    await talk();
    await expectText("play-dialogue-text", "Startup prepared this object.");
    await talk();
    await control("play-dialogue").waitFor({state:"hidden"});
    const beforeMove = (await control("play-status").innerText()).match(/\((\d+), (\d+), layer/);
    const moved = () => page.waitForFunction(y => {
      const point = document.querySelector("#play-status").textContent.match(/\((\d+), (\d+), layer/);
      return Number(point[2]) > y + 1;
    }, Number(beforeMove[2]));
    if (harbor) {
      await move("ArrowDown", moved);
    } else {
      // Hold real touch input until a frame observes movement; a completed
      // tap alone is not a reliable animation checkpoint on fast runners.
      const padButton = page.getByRole("button", {name:"Move south",exact:true});
      await padButton.scrollIntoViewIfNeeded();
      const bounds = await padButton.boundingBox();
      const touch = await page.context().newCDPSession(page);
      try {
        await touch.send("Input.dispatchTouchEvent", {type:"touchStart", touchPoints:[{
          x:bounds.x+bounds.width/2, y:bounds.y+bounds.height/2,
        }]});
        await moved();
      } finally {
        await touch.send("Input.dispatchTouchEvent", {type:"touchEnd", touchPoints:[]});
        await touch.detach();
      }
    }
    await click("play-reset");
    await menu.getByRole("button", {name:leave,exact:true}).tap();
    await expectText("play-feedback", /windows\(\) exited/);
    assert.ok(await control("play-talk").isDisabled());
    await click("play-reset");
    await menu.getByRole("button", {name:begin,exact:true}).waitFor();
    await click("play-close");
    await control("play-launch").waitFor();
    await directPlay();
    assert.equal(await control("play-script-screen").isVisible(), false);
    await talk();
    await expectText("play-dialogue-text", "Startup was skipped.");
    await click("play-close");
  }
  console.log("Generic title Chromium passed: two independent archives, original text and cursor choices, MIDI/WAV, keyboard/touch New Game, 350-line helper execution, caller return, Talk state, reset, exit, explicit save diagnostic and direct diagnostics.");
  for (const id of ["harbor", "grove"]) {
    const harbor = id === "harbor";
    const title = harbor ? "Harbor scope" : "Grove palette";
    const begin = harbor ? "Depart" : "Wake";
    const bytes = await readFile(resolve(site, "tk3-canvas-" + id + ".zip"));
    await archive("renamed-canvas-" + id + ".zip", bytes);
    const openScope = async () => {
      await control("play-script-choices").getByRole("button", {name:begin,exact:true}).click();
      await expectText("play-dialogue-text", /ready/);
      await talk();
      if (harbor) {
        await expectText("play-feedback", /GAM startup completed/);
        await page.keyboard.press("e");
      }
      await expectText("play-screen-text", title);
    };
    await gamPlay(); await openScope();
    assert.equal(await control("play-talk").isDisabled(),true);
    assert.equal(await control("play-runtime-actions").getByRole("button").first().isDisabled(),true);
    const display = control("play-script-screen").locator("canvas");
    await display.scrollIntoViewIfNeeded();
    const bounds = await display.boundingBox();
    const point = (x,y) => ({x:bounds.x+x*bounds.width/640,y:bounds.y+y*bounds.height/480});
    let p = point(20,20); await page.mouse.move(p.x,p.y);
    await variables(/sample = "255-0-0"/);
    p = point(100,100); await page.mouse.move(p.x,p.y);
    await variables(/sample = "34-56-78"/);
    await page.mouse.down(); await expectText("play-screen-text", /Pressed/);
    await page.mouse.up(); await expectText("play-screen-text", /Released/);
    await page.mouse.down({button:"right"}); await expectText("play-screen-text", /Secondary/);
    await page.mouse.up({button:"right"});
    await page.keyboard.down("a"); await page.keyboard.down("b");
    await variables(/chord = 1/);
    await page.keyboard.up("a"); await page.keyboard.up("b");
    await variables(/chord = 0/);
    const pixels = await display.evaluate(canvas => {
      const context = canvas.getContext("2d");
      return [[214,108],[200,100],[600,400]].map(([x,y]) => [...context.getImageData(x,y,1,1).data]);
    });
    assert.deepEqual(pixels,[[8,16,24,255],[255,70,70,255],[8,16,24,255]],"Color-key transparency and scaled image blits use real canvas pixels");
    if (!harbor) {
      const touch=await page.context().newCDPSession(page);
      p=point(25,25);
      try {
        await touch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[p]});
        await expectText("play-screen-text",/Pressed/);
        await variables(/sample = "255-0-0"/);
      } finally {
        await touch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]}); await touch.detach();
      }
      assert.doesNotMatch(await control("play-script-variables").innerText(),/caller_done/);
    }
    await click("play-script-escape");
    await expectText("play-dialogue-text", title+" closed");
    await variables(/canvas_done = 1/);
    await talk();
    await variables(/caller_done = 1/);
    assert.equal(await control("play-script-screen").isVisible(),false);
    await click("play-reset"); await openScope();
    await click("play-close");
    await control("play-launch").waitFor();
    await gamPlay(); await openScope();
    await click("play-reset");
    await control("play-script-choices").getByRole("button",{name:begin,exact:true}).waitFor();
    await variables(/startup_runs = 1/);
    assert.doesNotMatch(await control("play-script-variables").innerText(),/frames|canvas_done/);
    await click("play-close");
    if (harbor) {
      const zip=await JSZip.loadAsync(bytes);
      const helper="HarborLab/Prg/scope.prg";
      zip.file(helper,(await zip.file(helper).async("string")).replace('setImage("chart.png"','setImage("foreign-only.png"'));
      await archive("foreign-canvas.zip",await zip.generateAsync({type:"nodebuffer"}));
      await gamPlay();
      await control("play-script-choices").getByRole("button",{name:begin,exact:true}).click();
      await talk(); await page.keyboard.press("e");
      await expectText("play-script-diagnostic",/HarborLab\/Prg\/scope.prg:9:.*missing/);
      assert.equal(await control("play-talk").isDisabled(),false);
      await click("play-close");
    }
  }
  const canvasAudit = await page.evaluate(async () => {
    const {createTk3CanvasServices}=await import("./tk3-canvas-services.mjs");
    let release;
    const services=createTk3CanvasServices({readImage:()=>new Promise(resolve=>{release=resolve;})});
    const view=document.createElement("canvas");view.width=view.height=8;
    services.setSurface(view,view);services.sync({programId:1,paintEpoch:0,cleared:true,texts:[]});
    const call=(name,args,style)=>services.apply({name,args,style});
    const a=(await call("createcanvas",[2,2])).value;
    await call("fillrect",[0,0,2,2,a],{color:[9,27,81]});
    await call("drawcanvas",[a,0,0,8,8]);
    const read=await call("getpixel",[7,7,0,0,0]);
    const failures=[];
    for(const [name,args] of [["getpixel",[-1,0,0,0,0]],["killcanvas",[999]],
      ["createcanvas",[0,2]],["createcanvas",[4096,4096]]]) {
      try{await call(name,args);}catch(error){failures.push(error.message);}
    }
    while(services.stats.canvases<64)await call("createcanvas",[1,1]);
    try{await call("createcanvas",[1,1]);}catch(error){failures.push(error.message);}
    const pending=call("setimage",["pending.png",0,0,1,1]);
    let closed=false;services.destroy();release({width:1,height:1,close(){closed=true;}});
    let rejected=false;try{await pending;}catch{rejected=true;}
    const stats=services.stats;
    const next=createTk3CanvasServices({readImage:()=>{throw Error("unused");}});
    const fresh=document.createElement("canvas");fresh.width=fresh.height=8;next.setSurface(fresh,fresh);
    const frame=next.apply({name:"fillrect",args:[0,0,1,1],style:{color:[0,0,0]}});
    next.destroy();let frameCancelled=false;try{await frame;}catch{frameCancelled=true;}
    return {read,failures,closed,rejected,stats,frameCancelled};
  });
  assert.deepEqual(canvasAudit.read.outputs.map(out=>out.value),[9,27,81]);
  assert.equal(canvasAudit.failures.length,5);
  assert.deepEqual(canvasAudit.stats,{canvases:0,images:0,pixels:0,pendingFrames:0});
  assert.ok(canvasAudit.closed && canvasAudit.rejected && canvasAudit.frameCancelled);
  console.log("Canvas Chromium passed: shared startup/key/helper continuations, image/RGB/color-key pixels, live pointer and chord input, touch, Escape, reset/close, rooted failures, resource bounds and pending work cancellation.");
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
} catch (error) {
  console.error("Staged browser failure at " + checkpoint, error);
  throw error;
} finally {
  await browser?.close();
  server.close(() => clearTimeout(watchdog));
}
