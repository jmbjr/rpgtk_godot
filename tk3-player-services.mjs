import { createTk3Entities, entityCommands } from "./tk3-entities.mjs";
import { createTk3TaskScheduler, taskCommands } from "./tk3-tasks.mjs";
import { resolveAsset } from "./model.mjs";
import { defaultMidiTone, generalUserGs, playMidi } from "./midi.mjs";
import {
  createTk3CanvasServices,
  canvasLimits,
} from "./tk3-canvas-services.mjs";

// Browser resources belong to one play session and survive board remounts.
export function createTk3PlayerServices(
  artifacts,
  projectRoot,
  { readBytes, midiPlayer = playMidi } = {},
) {
  const entities=createTk3Entities(artifacts);
  const tasks=createTk3TaskScheduler(artifacts,projectRoot);
  let playback = null,
    audio = null,
    audioUrl = null,
    graphicUrl = null,
    generation = 0;
  let audioStatus = "",
    audioPath = null,
    destroyed = false;
  function stopMusic() {
    generation++;
    playback?.stop();
    playback = null;
    if (audio) {
      audio.pause();
      audio.src = "";
      audio = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audioPath = null;
    audioStatus = "";
  }
  const asset = async (role, file) => {
    const found = resolveAsset(artifacts, role, file, projectRoot);
    if (found.status !== "resolved")
      throw Error(role + " asset " + file + " is " + found.status + ".");
    const value = artifacts.get(found.path);
    if (!value || value.error)
      throw Error("Media source is unavailable: " + found.path);
    const bytes = value.bytes ?? (await readBytes?.(found.path));
    if (destroyed) throw Error("Play session was closed.");
    if (!bytes)
      throw Error("Media source bytes are unavailable: " + found.path);
    return { ...value, bytes };
  };
  const graphics = createTk3CanvasServices({
    readImage: async (file) => {
      const source = await asset("Bitmap", file);
      const ext = source.path.split(".").at(-1).toLowerCase();
      const mime = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        bmp: "image/bmp",
      }[ext];
      if (!mime) throw Error("Unsupported RPGCode image: " + source.path);
      let width = source.width,
        height = source.height;
      const bytes = source.bytes;
      if (ext === "png" && bytes.length >= 24) {
        const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        width = view.getUint32(16);
        height = view.getUint32(20);
      } else if (ext === "bmp" && bytes.length >= 26) {
        const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        width = Math.abs(view.getInt32(18, true));
        height = Math.abs(view.getInt32(22, true));
      }
      if (
        !(
          width > 0 &&
          height > 0 &&
          width <= canvasLimits.dimension &&
          height <= canvasLimits.dimension
        )
      )
        throw Error(
          "Image dimensions are missing or exceed the browser canvas limit: " +
            source.path,
        );
      return createImageBitmap(new Blob([bytes], { type: mime }));
    },
  });
  return {
    graphics, tasks, entities,
    get audioStatus() {
      return audioStatus;
    },
    get audioPath() {
      return audioPath;
    },
    get graphicUrl() {
      return graphicUrl;
    },
    async apply(effect) {
      if (destroyed) throw Error("Play session was closed.");
      const { name, args } = effect;
      if(entityCommands.has(name))return entities.handle(effect);
      if(taskCommands.has(name)) return tasks.handle(effect);
      if (name === "mediastop") {
        stopMusic();
        return;
      }
      if (name === "wingraphic") {
        const image = await asset("Bitmap", String(args[0]));
        const ext = image.path.split(".").at(-1).toLowerCase();
        const mime = {
          png: "image/png",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          gif: "image/gif",
          bmp: "image/bmp",
        }[ext];
        if (!mime)
          throw Error("Unsupported message-window image: " + image.path);
        if (graphicUrl) URL.revokeObjectURL(graphicUrl);
        graphicUrl = URL.createObjectURL(
          new Blob([image.bytes], { type: mime }),
        );
        return;
      }
      if (name !== "mediaplay") return graphics.apply(effect);
      // Claim the request before the lazy archive read. Stop, replacement and
      // disposal must invalidate reads as well as synth/bank initialization.
      stopMusic();
      const current = generation;
      const source = await asset("Media", String(args[0]));
      if (current !== generation) return;
      if (!/\.(?:mid|midi|wav)$/i.test(source.path))
        throw Error("MediaPlay supports MIDI and WAV: " + source.path);
      audioPath = source.path;
      audioStatus = "Starting: " + source.path;
      if (/\.(?:mid|midi)$/i.test(source.path)) {
        audioStatus = "Loading MIDI with " + generalUserGs.name + ": " + source.path;
        const start = () => {
          if (current !== generation) return;
          playback = midiPlayer(
            Promise.resolve(source.bytes),
            defaultMidiTone,
            generalUserGs,
            () => {
              if (current === generation)
                audioStatus = "Playing MIDI: " + source.path + " · " + generalUserGs.name;
            },
            (message) => {
              if (current !== generation) return;
              if (message === "MIDI finished.") start();
              else audioStatus = message + " · " + source.path;
            },
          );
        };
        start();
      } else {
        audioUrl = URL.createObjectURL(
          new Blob([source.bytes], { type: "audio/wav" }),
        );
        audio = new Audio(audioUrl);
        audio.loop = true;
        audio.addEventListener("error", () => {
          if (current === generation)
            audioStatus = "Unable to play WAV: " + source.path;
        });
        void audio.play().then(
          () => {
            if (current === generation)
              audioStatus = "Playing WAV: " + source.path;
          },
          (error) => {
            if (current === generation)
              audioStatus = "Unable to play WAV: " + error.message;
          },
        );
      }
    },
    destroy() {
      destroyed = true;
      graphics.destroy();
      tasks.destroy();
      entities.destroy();
      stopMusic();
      if (graphicUrl) URL.revokeObjectURL(graphicUrl);
      graphicUrl = null;
    },
  };
}
