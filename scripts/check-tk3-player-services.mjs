import assert from "node:assert/strict";
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
  "Player services passed: project-rooted lazy media reads, ambiguity/foreign-only rejection, loop/stop, resource cleanup and close during an asynchronous read.",
);
