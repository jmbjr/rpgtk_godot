import assert from "node:assert/strict";
import { generalUserGs } from "../midi.mjs";
import { buildTitleExecutionGame } from "../docs/specs/fixtures/tk3-browser-fixtures.mjs";
import { readArtifacts } from "../artifacts.mjs";
import { createTk3PlayerServices } from "../tk3-player-services.mjs";

const audios = [];
const previousAudio = globalThis.Audio;
globalThis.Audio = class {
  constructor(src) {
    this.src = src;
    this.paused = true;
    audios.push(this);
  }
  addEventListener() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
};
try {
  for (const id of ["harbor", "grove"]) {
    const zip = await buildTitleExecutionGame(id);
    const { artifacts } = await readArtifacts(zip, {});
    const root = id === "harbor" ? "HarborLab/" : "";
    const reads = [];
    const services = createTk3PlayerServices(artifacts, root, {
      readBytes: async (path) => {
        reads.push(path);
        return zip.file(path).async("uint8array");
      },
    });
    await services.apply({ name: "wingraphic", args: ["WINDOW.PNG"] });
    const graphic = services.graphicUrl;
    assert.ok(graphic.startsWith("blob:"));
    assert.deepEqual(reads, [root + "Bitmap/window.png"]);
    await services.apply({ name: "mediaplay", args: ["tone.wav"] });
    assert.equal(services.audioPath, root + "Media/tone.wav");
    assert.match(services.audioStatus, /Playing WAV/);
    const audio = audios.at(-1);
    assert.equal(audio.paused, false);
    assert.equal(audio.loop, true);
    await services.apply({ name: "mediastop", args: [] });
    assert.equal(audio.paused, true);
    assert.equal(audio.src, "");
    assert.equal(services.audioPath, null);
    assert.equal(services.graphicUrl, graphic);
    await assert.rejects(
      services.apply({ name: "mediaplay", args: ["missing.wav"] }),
      /missing/,
    );
    services.destroy();
    assert.equal(services.graphicUrl, null);
    await assert.rejects(
      services.apply({ name: "wingraphic", args: ["window.png"] }),
      /closed/,
    );

    let release;
    const pendingService = createTk3PlayerServices(artifacts, root, {
      readBytes: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    const pending = pendingService.apply({
      name: "wingraphic",
      args: ["window.png"],
    });
    assert.equal(typeof release, "function");
    pendingService.destroy();
    release(new Uint8Array([1]));
    await assert.rejects(pending, /closed/);
    assert.equal(
      pendingService.graphicUrl,
      null,
      "Closing a session prevents a pending read from creating a leaked resource",
    );
  }
  // Use controllable transport callbacks to test session ownership independently
  // of Web Audio. The staged Chromium suite uses the real SF2/worklet transport.
  const midi = { path: "Media/song.mid", type: "mid", bytes: new Uint8Array([1]) };
  const wave = { path: "Media/tone.wav", type: "wav", bytes: new Uint8Array([2]) };
  const tracks = new Map([[midi.path, midi], [wave.path, wave]]);
  const runs = [];
  const midiPlayer = (bytes, tone, bank, onPlaying, onFinish) => {
    assert.equal(bank, generalUserGs);
    const run = { bank, onPlaying, onFinish, stopped: false };
    runs.push(run);
    return { stop() { run.stopped = true; onFinish("MIDI stopped."); } };
  };
  const service = createTk3PlayerServices(tracks, "", { midiPlayer });
  const play = () => service.apply({ name: "mediaplay", args: ["song.mid"] });
  await play();
  assert.match(service.audioStatus, /Loading MIDI with GeneralUser GS 2.0.3/);
  runs.at(-1).onPlaying();
  assert.match(service.audioStatus, /Playing MIDI:.*GeneralUser GS 2.0.3/);
  runs.at(-1).onFinish("MIDI finished.");
  assert.equal(runs.length, 2, "Authored music loops with the same bank");
  const stale = runs.at(-1);
  await service.apply({ name: "mediastop", args: [] });
  stale.onPlaying(); stale.onFinish("MIDI finished.");
  assert.equal(runs.length, 2);
  assert.equal(service.audioStatus, "");
  await play();
  const replaced = runs.at(-1);
  await service.apply({ name: "mediaplay", args: ["tone.wav"] });
  replaced.onPlaying(); replaced.onFinish("MIDI finished.");
  assert.equal(replaced.stopped, true);
  assert.match(service.audioStatus, /Playing WAV/);
  await play();
  const failures = runs.length;
  runs.at(-1).onFinish("Unable to play MIDI. Could not download GeneralUser GS (HTTP 503).");
  assert.match(service.audioStatus, /Unable to play MIDI.*HTTP 503.*Media\/song.mid/);
  assert.equal(runs.length, failures, "Failures do not loop or silently use TinySynth");
  service.destroy();
  runs.at(-1).onPlaying(); runs.at(-1).onFinish("MIDI finished.");
  assert.equal(runs.length, failures);
  assert.equal(service.audioPath, null);

  for (const action of ["stop", "replace", "destroy"]) {
    let release;
    const lazy = new Map([[midi.path, { ...midi, bytes: undefined }], [wave.path, wave]]);
    const pending = createTk3PlayerServices(lazy, "", {
      midiPlayer,
      readBytes: () => new Promise(resolve => { release = resolve; }),
    });
    const before = runs.length;
    const read = pending.apply({ name: "mediaplay", args: ["song.mid"] });
    if (action === "destroy") pending.destroy();
    else await pending.apply({ name: action === "stop" ? "mediastop" : "mediaplay", args: ["tone.wav"] });
    release(midi.bytes);
    if (action === "destroy") await assert.rejects(read, /closed/);
    else await read;
    assert.equal(runs.length, before, action + " invalidates a pending media read");
    assert.equal(pending.audioPath, action === "replace" ? wave.path : null);
    pending.destroy();
  }

  // The shared loader retries failures and caches a Blob, never a transferable
  // ArrayBuffer: each worklet owns its own fresh buffer, including concurrent plays.
  const previousFetch = globalThis.fetch;
  let fetches = 0, releaseBank;
  globalThis.fetch = async () => {
    fetches++;
    if (fetches === 1) return { ok: false, status: 503 };
    return new Promise(resolve => { releaseBank = () => resolve(new Response(new Uint8Array([7, 8, 9]))); });
  };
  try {
    await assert.rejects(generalUserGs.arrayBuffer(), /HTTP 503/);
    const first = generalUserGs.arrayBuffer(), second = generalUserGs.arrayBuffer();
    releaseBank();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(fetches, 2);
    assert.notEqual(a, b);
    structuredClone(a, { transfer: [a] });
    assert.equal(a.byteLength, 0);
    assert.deepEqual([...new Uint8Array(b)], [7, 8, 9]);
    assert.deepEqual([...new Uint8Array(await generalUserGs.arrayBuffer())], [7, 8, 9]);
    assert.equal(fetches, 2);
  } finally { globalThis.fetch = previousFetch; }
  const map = new Map([
    ["Alpha/Main/game.gam", { path: "Alpha/Main/game.gam", type: "gam" }],
    [
      "Alpha/Media/sound.wav",
      {
        path: "Alpha/Media/sound.wav",
        type: "wav",
        bytes: new Uint8Array([1]),
      },
    ],
    [
      "Alpha/Media/SOUND.WAV",
      {
        path: "Alpha/Media/SOUND.WAV",
        type: "wav",
        bytes: new Uint8Array([1]),
      },
    ],
    ["Beta/Main/game.gam", { path: "Beta/Main/game.gam", type: "gam" }],
    [
      "Beta/Media/foreign.wav",
      {
        path: "Beta/Media/foreign.wav",
        type: "wav",
        bytes: new Uint8Array([1]),
      },
    ],
  ]);
  const rooted = createTk3PlayerServices(map, "Alpha/");
  await assert.rejects(
    rooted.apply({ name: "mediaplay", args: ["sound.wav"] }),
    /ambiguous/,
  );
  await assert.rejects(
    rooted.apply({ name: "mediaplay", args: ["foreign.wav"] }),
    /missing/,
  );
  rooted.destroy();
} finally {
  globalThis.Audio = previousAudio;
}
console.log(
  "Player services passed: project-rooted lazy media reads, ambiguity/foreign-only rejection, GS default, shared bank caching/retry and transferable ownership, loop/stop/replacement, visible failure, resource cleanup and stale-read/callback cancellation.",
);
