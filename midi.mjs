import { readMidiWithMessages } from "./media.mjs";

export function midiTimeline(bytes) {
  const events = [];
  const midi = readMidiWithMessages(bytes, (tick, status, args) => {
    events.push({ tick, message: [status, ...args] });
  });
  if (midi.format === 2) throw new Error("Format 2 MIDI contains independent sequences.");
  const { ticksPerQuarter, framesPerSecondCode, ticksPerFrame } = midi.timeDivision;
  if (!ticksPerQuarter && (!ticksPerFrame || ![24, 25, 29, 30].includes(framesPerSecondCode))) {
    throw new Error("Invalid MIDI timecode division.");
  }
  const tempos = ticksPerQuarter ?
    midi.tracks.flatMap(track => track.tempos).sort((a, b) => a.tick - b.tick) : [];
  const framesPerSecond = framesPerSecondCode === 29 ? 30000 / 1001 : framesPerSecondCode;
  let secondsPerTick = ticksPerQuarter ? 0.5 / ticksPerQuarter : 1 / (framesPerSecond * ticksPerFrame);
  let previousTick = 0;
  let previousSeconds = 0;
  let tempoIndex = 0;

  function secondsAt(tick) {
    while (tempoIndex < tempos.length && tempos[tempoIndex].tick <= tick) {
      const tempo = tempos[tempoIndex++];
      if (!tempo.microsecondsPerQuarter) throw new Error("Invalid MIDI tempo.");
      previousSeconds += (tempo.tick - previousTick) * secondsPerTick;
      previousTick = tempo.tick;
      secondsPerTick = tempo.microsecondsPerQuarter / (1e6 * ticksPerQuarter);
    }
    return previousSeconds + (tick - previousTick) * secondsPerTick;
  }

  events.sort((a, b) => a.tick - b.tick);
  for (const event of events) event.seconds = secondsAt(event.tick);
  const endTick = midi.tracks.reduce((end, track) => Math.max(end, track.ticks), 0);
  return { events, duration: secondsAt(endTick) };
}

export const defaultMidiTone = Object.freeze({
  bass: 0,
  mid: 0,
  midFrequency: 1500,
  treble: 0,
  trebleFrequency: 3000,
  bypass: false,
});

function createMidiEq(context) {
  const bass = context.createBiquadFilter();
  const mid = context.createBiquadFilter();
  const treble = context.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 250;
  mid.type = "peaking";
  mid.Q.value = 1;
  treble.type = "highshelf";
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(context.destination);

  function update(settings, immediate = false) {
    const now = context.currentTime;
    const gains = [
      [bass.gain, settings.bass],
      [mid.gain, settings.mid],
      [treble.gain, settings.treble],
    ];
    const parameters = [
      ...gains.map(([parameter, value]) => [parameter, settings.bypass ? 0 : value]),
      [mid.frequency, settings.midFrequency],
      [treble.frequency, settings.trebleFrequency],
    ];
    for (const [parameter, value] of parameters) {
      if (immediate) parameter.value = value;
      else parameter.setTargetAtTime(value, now, 0.02);
    }
  }

  return { input: bass, update };
}

// TinySynth owns a page-lifetime maintenance timer. Reuse the synth, but
// give each run its own audio context so Stop also silences queued percussion.
let synth;

export function playMidi(bytes, initialTone, onPlaying, onFinish) {
  let context;
  let eq;
  let timer;
  let stopped = false;

  function stop(message = "MIDI stopped.") {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    if (context) {
      synth.stopMIDI();
      void context.close().catch(() => {});
    }
    onFinish(message);
  }

  async function start() {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) throw new Error("Web Audio is unavailable in this browser.");
    synth ??= new globalThis.WebAudioTinySynth({ internalcontext: 0 });
    context = new AudioContext();

    eq = createMidiEq(context);
    eq.update(initialTone, true);
    synth.setAudioContext(context, eq.input);
    const [data] = await Promise.all([bytes, context.resume()]);
    if (stopped) return;
    const { events, duration } = midiTimeline(data);
    const startTime = context.currentTime + 0.05;
    let next = 0;

    function schedule() {
      try {
        const now = context.currentTime;
        while (next < events.length && startTime + events[next].seconds <= now + 0.08) {
          const event = events[next++];
          synth.send(event.message, Math.max(now, startTime + event.seconds));
        }
        if (now >= startTime + duration + 0.4) stop("MIDI finished.");
      } catch (error) {
        stop(`Unable to play MIDI. ${error.message}`);
      }
    }

    onPlaying();
    timer = setInterval(schedule, 25);
    schedule();
  }

  // Handle a file-read failure even if the browser cannot initialize audio.
  void bytes.catch(() => {});
  void start().catch(error => stop(`Unable to play MIDI. ${error.message}`));
  return {
    stop,
    setTone(settings) {
      if (!stopped) eq?.update(settings);
    },
  };
}
