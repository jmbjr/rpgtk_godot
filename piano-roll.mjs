import { midiTimeline } from "./midi.mjs";

const pixelsPerSecond = 64;
const svgNamespace = "http://www.w3.org/2000/svg";
const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const pitchName = pitch => `${noteNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const channelKey = (port, channel) => `${port}:${channel}`;

export function midiNoteSequence(bytes) {
  const { events, duration } = midiTimeline(bytes);
  const notes = [];
  const pending = new Map();
  for (const { seconds, port, message: [status, pitch, velocity] } of events) {
    const command = status >>> 4;
    if (command !== 8 && command !== 9) continue;
    const channel = (status & 15) + 1;
    const key = `${channelKey(port, channel)}:${pitch}`;
    if (command === 9 && velocity > 0) {
      const note = { pitch, velocity, channel, port, isDrum: channel === 10, startTime: seconds, endTime: duration };
      notes.push(note);
      if (!pending.has(key)) pending.set(key, []);
      pending.get(key).push(note);
    } else {
      const queue = pending.get(key);
      if (!queue) continue;
      queue.shift().endTime = seconds;
      if (!queue.length) pending.delete(key);
    }
  }
  return { notes, totalTime: Math.max(duration, 0.25) };
}

function make(tag, text = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

export function renderMidiPianoRoll(tracks, readBytes, playbackTime) {
  const details = make("details");
  details.className = "edge-group midi-piano-roll";
  const status = make("p", "Open to load the piano roll.");
  const filterLabel = make("label", "Part");
  const filter = make("select");
  filter.append(make("option", "All parts"));
  filter.options[0].value = "";
  filterLabel.append(filter);
  filterLabel.hidden = true;
  const viewport = make("div");
  viewport.className = "midi-roll-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "Scrollable MIDI piano roll");
  viewport.hidden = true;
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  viewport.append(svg);
  details.append(make("summary", "Piano roll"), filterLabel, viewport, status);

  let sequence;
  let Visualizer;
  let loading = false;
  let frame;
  let playhead;
  let notes = [];
  let rectangles = [];
  let next = 0;
  let lastTime = -Infinity;
  const active = new Set();

  function update(time) {
    if (time === lastTime) return;
    if (time < lastTime) {
      for (const index of active) rectangles[index].classList.remove("active");
      active.clear();
      next = 0;
      if (time < 0 || lastTime - time > 0.1) {
        viewport.scrollLeft = Math.max(0, time * pixelsPerSecond - 24);
      }
    }
    lastTime = time;
    const x = Math.max(0, time) * pixelsPerSecond;
    playhead.setAttribute("x1", x);
    playhead.setAttribute("x2", x);
    if (x > viewport.scrollLeft + viewport.clientWidth * 0.8) viewport.scrollLeft = x - 24;
    while (next < notes.length && notes[next].startTime <= time) {
      if (notes[next].endTime > time) {
        rectangles[next].classList.add("active");
        active.add(next);
      }
      next++;
    }
    for (const index of active) {
      if (notes[index].endTime <= time) {
        rectangles[index].classList.remove("active");
        active.delete(index);
      }
    }
    const pitches = [...new Set([...active].map(index => {
      const note = notes[index];
      return note.isDrum ? `Drum ${note.pitch}` : pitchName(note.pitch);
    }))];
    const text = `${Math.max(0, time).toFixed(1)} s · ${pitches.length ? pitches.join(", ") : "—"}`;
    if (status.textContent !== text) status.textContent = text;
  }

  function draw() {
    notes = filter.value ?
      sequence.notes.filter(note => channelKey(note.port, note.channel) === filter.value) : sequence.notes;
    new Visualizer({ notes, totalTime: sequence.totalTime }, svg, {
      pixelsPerTimeStep: pixelsPerSecond,
      noteHeight: 5,
      noteRGB: "211, 178, 117",
    });
    rectangles = [...svg.querySelectorAll("rect.note")];
    playhead = document.createElementNS(svgNamespace, "line");
    playhead.setAttribute("class", "midi-roll-playhead");
    playhead.setAttribute("y1", "0");
    playhead.setAttribute("y2", "100%");
    svg.append(playhead);
    active.clear();
    next = 0;
    lastTime = -Infinity;
    viewport.scrollLeft = Math.max(0, playbackTime() * pixelsPerSecond - 24);
    update(Math.min(sequence.totalTime, playbackTime()));
  }

  function follow() {
    if (!details.open || !details.isConnected) return;
    update(Math.min(sequence.totalTime, playbackTime()));
    frame = requestAnimationFrame(follow);
  }

  async function open() {
    if (loading) return;
    if (!sequence) {
      loading = true;
      status.textContent = "Loading piano roll…";
      try {
        const [bytes, module] = await Promise.all([readBytes(), import("./vendor/piano-roll/magenta.mjs")]);
        if (!details.isConnected) return;
        const parsed = midiNoteSequence(bytes);
        if (!parsed.notes.length) {
          status.textContent = "This MIDI contains no notes.";
          return;
        }
        const parts = new Map();
        for (const track of tracks) {
          for (const part of track.parts) {
            const key = channelKey(part.port, part.channel);
            if (!parts.has(key)) parts.set(key, { ...part, names: new Set() });
            parts.get(key).names.add(part.instrument);
          }
        }
        for (const [key, part] of parts) {
          const port = part.port ? `Port ${part.port} · ` : "";
          const option = make("option", `${port}Ch. ${part.channel} · ${[...part.names].join(" / ")}`);
          option.value = key;
          filter.append(option);
        }
        sequence = parsed;
        Visualizer = module.PianoRollSVGVisualizer;
        filterLabel.hidden = false;
        viewport.hidden = false;
        draw();
      } catch (error) {
        sequence = undefined;
        filterLabel.hidden = true;
        viewport.hidden = true;
        status.textContent = `Piano roll unavailable. ${error.message}`;
        return;
      } finally {
        loading = false;
      }
    }
    follow();
  }

  filter.addEventListener("change", draw);
  details.addEventListener("toggle", () => {
    cancelAnimationFrame(frame);
    if (details.open) void open();
  });
  return details;
}
