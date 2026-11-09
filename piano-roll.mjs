import { midiTimeline } from "./midi.mjs";

const pixelsPerSecond = 64;
const svgNamespace = "http://www.w3.org/2000/svg";
const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const pitchName = pitch => `${noteNames[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
const channelKey = (port, channel) => `${port}:${channel}`;
const partKey = ({ port, channel, program }) => `${channelKey(port, channel)}:${program}`;

function partColor(index) {
  // Space successive hues by the golden angle and convert HSL to a hex color.
  const hue = ((42 + index * 137.508) % 360) / 30;
  const channel = offset => {
    const k = (offset + hue) % 12;
    const value = 0.66 - 0.26 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function midiNoteSequence(bytes) {
  const { events, duration } = midiTimeline(bytes);
  const notes = [];
  const pending = new Map();
  const programs = new Map();
  for (const { seconds, port, message: [status, pitch, velocity] } of events) {
    const command = status >>> 4;
    if (command !== 8 && command !== 9 && command !== 12) continue;
    const channel = (status & 15) + 1;
    const channelId = channelKey(port, channel);
    if (command === 12) {
      programs.set(channelId, pitch + 1);
      continue;
    }
    const key = `${channelId}:${pitch}`;
    if (command === 9 && velocity > 0) {
      const note = { pitch, velocity, channel, port, program: programs.get(channelId) ?? 1,
        isDrum: channel === 10, startTime: seconds, endTime: duration };
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
  const instruments = make("fieldset");
  instruments.className = "midi-roll-instruments";
  instruments.hidden = true;
  const all = make("input");
  all.type = "checkbox";
  all.checked = true;
  const allLabel = make("label");
  allLabel.append(all, "All instruments");
  const rows = make("div");
  rows.className = "midi-roll-parts";
  instruments.append(make("legend", "Visible instruments"), allLabel, rows);
  const viewport = make("div");
  viewport.className = "midi-roll-viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("role", "region");
  viewport.setAttribute("aria-label", "Scrollable MIDI piano roll");
  viewport.hidden = true;
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("aria-hidden", "true");
  viewport.append(svg);
  details.append(make("summary", "Piano roll"), instruments, viewport, status);

  let sequence;
  const parts = new Map();
  let loading = false;
  let frame;
  let playhead;
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
    const notes = sequence.notes;
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
    updateStatus();
  }

  function updateStatus() {
    const pitches = new Set();
    for (const index of active) {
      const note = sequence.notes[index];
      if (parts.get(partKey(note))?.toggle.checked) {
        pitches.add(note.isDrum ? `Drum ${note.pitch}` : pitchName(note.pitch));
      }
    }
    const text = `${Math.max(0, lastTime).toFixed(1)} s · ${[...pitches].join(", ") || "—"}`;
    if (status.textContent !== text) status.textContent = text;
  }

  function updatePart(part) {
    for (const rectangle of part.rectangles) {
      rectangle.classList.toggle("part-hidden", !part.toggle.checked);
      rectangle.style.setProperty("--part-color", part.picker.value);
    }
  }

  function updateAllCheckbox() {
    const shown = [...parts.values()].filter(part => part.toggle.checked).length;
    all.checked = shown === parts.size;
    all.indeterminate = shown > 0 && shown < parts.size;
  }

  function addPart(part, key) {
    const port = part.port ? `Port ${part.port} · ` : "";
    const name = part.percussion ? `${part.instrument} (kit ${part.program})` : part.instrument;
    const label = `${name} · ${port}Ch. ${part.channel}`;
    const row = make("div");
    row.className = "midi-roll-part";
    const toggle = make("input");
    toggle.type = "checkbox";
    toggle.checked = true;
    const partLabel = make("label");
    partLabel.append(toggle, make("span", label));
    const picker = make("input");
    picker.type = "color";
    picker.value = partColor(parts.size);
    picker.setAttribute("aria-label", `Color for ${label}`);
    picker.title = `Color for ${label}`;
    const controls = { toggle, picker, rectangles: [] };
    parts.set(key, controls);
    toggle.addEventListener("change", () => {
      updatePart(controls);
      updateAllCheckbox();
      updateStatus();
    });
    picker.addEventListener("input", () => updatePart(controls));
    row.append(partLabel, picker);
    rows.append(row);
  }

  function draw(Visualizer) {
    new Visualizer(sequence, svg, {
      pixelsPerTimeStep: pixelsPerSecond,
      noteHeight: 5,
    });
    rectangles = [...svg.querySelectorAll("rect.note")];
    for (const [index, note] of sequence.notes.entries()) {
      parts.get(partKey(note))?.rectangles.push(rectangles[index]);
    }
    for (const part of parts.values()) updatePart(part);
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
        parts.clear();
        rows.replaceChildren();
        for (const track of tracks) {
          for (const part of track.parts) {
            const key = partKey(part);
            if (!parts.has(key)) addPart(part, key);
          }
        }
        updateAllCheckbox();
        sequence = parsed;
        instruments.hidden = false;
        viewport.hidden = false;
        draw(module.PianoRollSVGVisualizer);
      } catch (error) {
        sequence = undefined;
        instruments.hidden = true;
        viewport.hidden = true;
        status.textContent = `Piano roll unavailable. ${error.message}`;
        return;
      } finally {
        loading = false;
      }
    }
    follow();
  }

  all.addEventListener("change", () => {
    for (const part of parts.values()) {
      part.toggle.checked = all.checked;
      updatePart(part);
    }
    updateAllCheckbox();
    updateStatus();
  });
  details.addEventListener("toggle", () => {
    cancelAnimationFrame(frame);
    if (details.open) void open();
  });
  return details;
}
