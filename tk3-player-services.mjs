import { resolveAsset } from "./model.mjs";
import { defaultMidiTone, playMidi } from "./midi.mjs";

// Browser resources belong to one play session and survive board remounts.
export function createTk3PlayerServices(
  artifacts,
  projectRoot,
  { readBytes } = {},
) {
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
  return {
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
      if (name !== "mediaplay")
        throw Error("Unsupported player service: " + name);
      const source = await asset("Media", String(args[0]));
      if (!/\.(?:mid|midi|wav)$/i.test(source.path))
        throw Error("MediaPlay supports MIDI and WAV: " + source.path);
      stopMusic();
      audioPath = source.path;
      audioStatus = "Starting: " + source.path;
      const current = generation;
      if (/\.(?:mid|midi)$/i.test(source.path)) {
        const start = () => {
          if (current !== generation) return;
          playback = playMidi(
            Promise.resolve(source.bytes),
            defaultMidiTone,
            null,
            () => {
              if (current === generation)
                audioStatus = "Playing MIDI: " + source.path;
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
      stopMusic();
      if (graphicUrl) URL.revokeObjectURL(graphicUrl);
      graphicUrl = null;
    },
  };
}
