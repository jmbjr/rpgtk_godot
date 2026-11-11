// Purpose-built, readable sprites for the *legacy test game*, not historical
// editor saves. Keep format-fixtures.mjs untouched as byte-level evidence.
import { fixtures } from "./format-fixtures.mjs";

const original = new Map(fixtures.map(f => [f.path, f.bytes]));
const directions = ["South", "East", "North", "West"];
const actions = ["Attack", "Defense", "Special move", "Defeat"];
const tint = {
  South: [75, 207, 120], East: [255, 183, 60],
  North: [91, 191, 255], West: [217, 132, 255],
  Attack: [249, 102, 93], Defense: [93, 194, 255],
  "Special move": [196, 130, 255], Defeat: [153, 158, 173],
  Rest: [83, 222, 168], Custom: [255, 205, 91],
};
const color = (r, g, b) => r | (g << 8) | (b << 16);
const rgb = values => color(...values);
const bg = color(24, 31, 49);
const white = color(255, 253, 235);
const ink = color(13, 16, 31);
const skin = color(248, 199, 143);
const hair = color(73, 57, 88);
const hairLight = color(118, 98, 138);

const slug = name => name.toLowerCase().replaceAll(" ", "-");
const walkFile = (direction, segment) => "diag-walk-" + slug(direction) + "-" + segment + ".gph";
const actionFile = (kind, frame) => "diag-" + slug(kind) + "-" + frame + ".gph";
const restFile = "diag-rest.gph";
const customFile = frame => "diag-custom-" + frame + ".gph";

// Each tile has four color registration corners, a transparent outside,
// a dark opaque field, and a large subject mark. No deliberately blank frames.
function diagnosticTile(kind, frame = 1, segment = "whole") {
  const pixels = Array(1024).fill(-1);
  const paint = (x, y, value) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) pixels[x * 32 + y] = value;
  };
  const rect = (x0, y0, x1, y1, value) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) paint(x, y, value);
  };
  const accent = rgb(tint[kind]);
  rect(2, 2, 29, 29, bg);
  rect(2, 2, 29, 5, accent);
  rect(2, 26, 29, 29, accent);
  rect(2, 2, 5, 29, accent);
  rect(26, 2, 29, 29, accent);
  rect(2, 2, 5, 5, white);      // top-left orientation square
  rect(26, 2, 29, 5, ink);      // top-right square
  rect(2, 26, 5, 29, ink);      // bottom-left square
  rect(26, 26, 29, 29, white);  // bottom-right square
  if (directions.includes(kind)) {
    if (segment !== "bottom") {
      // Four *readable* facings, independent of the direction's accent color.
      // South: two eyes. East/West: one eye and a protruding nose pointing
      // right/left. North: back of the head, with hair and no visible face.
      if (kind === "North") {
        rect(9, 8, 22, 22, hair);
        rect(10, 9, 21, 10, white);
        rect(11, 12, 13, 19, hairLight);
        rect(18, 12, 20, 19, hairLight);
        rect(14, 20, 17, 22, skin); // neck, not a mouth
      } else {
        rect(9, 8, 22, 22, skin);
        rect(10, 9, 21, 10, white);
        if (kind === "South") {
          rect(12, 14, 14, 16, ink);
          rect(18, 14, 20, 16, ink);
          rect(14, 19, 18, 19, ink);
        } else if (kind === "East") {
          rect(18, 14, 20, 16, ink);
          rect(22, 17, 24, 19, skin); // nose facing right
          rect(20, 20, 22, 21, ink);
        } else if (kind === "West") {
          rect(11, 14, 13, 16, ink);
          rect(7, 17, 9, 19, skin); // nose facing left
          rect(9, 20, 11, 21, ink);
        }
      }
    }
    if (segment !== "top") {
      const top = segment === "whole" ? 20 : 8;
      rect(8, top, 23, top + 9, accent);
      rect(11, top + 2, 20, top + 4, white);
      rect(9, Math.min(top + 10, 27), 13, 27, ink);
      rect(18, Math.min(top + 10, 27), 22, 27, ink);
    }
    // Visible direction marker on the left edge; walking frame index on right.
    rect(6, 10, 7, 14, white);
    rect(23, 8 + frame * 3, 25, 9 + frame * 3, white);
  } else {
    rect(9, 9, 22, 22, accent);
    rect(12, 12, 19, 19, ink);
    rect(14, 14, 17, 17, white);
    const dots = kind === "Custom" ? frame : Math.min(frame, 4);
    for (let i = 0; i < dots; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      rect(7 + col * 4, 23 + row * 2, 8 + col * 4, 24 + row * 2, white);
    }
  }
  return pixels;
}

const gph = pixels => Buffer.from(
  ["RPGTLKIT TILE", 2, 0, 1, 0, ...pixels, ""].join("\r\n"), "ascii"
);
export const visualTileBytes = new Map();
for (const direction of directions) for (const part of ["top", "bottom"]) {
  visualTileBytes.set(walkFile(direction, part), gph(diagnosticTile(direction, 1, part)));
}
for (const kind of actions) for (let frame = 1; frame <= 4; frame++) {
  visualTileBytes.set(actionFile(kind, frame), gph(diagnosticTile(kind, frame)));
}
visualTileBytes.set(restFile, gph(diagnosticTile("Rest")));
for (let frame = 1; frame <= 10; frame++) {
  visualTileBytes.set(customFile(frame), gph(diagnosticTile("Custom", frame)));
}

const text = fields => Buffer.from([...fields, ""].join("\r\n"), "ascii");
const zstr = value => Buffer.from(value + "\0", "ascii");
const concat = (...fields) => Buffer.concat(fields.map(value =>
  typeof value === "string" ? zstr(value) : value
));
const fill = (length, value) => Array(length).fill(value);
const walkingGraphics = () => directions.flatMap(direction =>
  Array.from({ length: 4 }, () => [walkFile(direction, "top"), walkFile(direction, "bottom")]).flat()
);
const artGraphics = (minor, binary) => {
  const out = [];
  const cols = minor === 1 && !binary ? 1 : 2;
  const pushAction = (kind, frame) => out.push(actionFile(kind, frame));
  if (binary) {
    for (let frame = 1; frame <= 4; frame++) for (let x = 0; x < cols; x++) {
      for (let y = 0; y < 2; y++) for (const kind of actions) pushAction(kind, frame);
    }
  } else {
    for (let x = 0; x < cols; x++) for (let y = 0; y < 2; y++) {
      for (let frame = 1; frame <= 4; frame++) for (const kind of actions) pushAction(kind, frame);
    }
  }
  for (let x = 0; x < cols; x++) for (let y = 0; y < 2; y++) out.push(restFile);
  for (let frame = 1; frame <= 10; frame++) for (let y = 0; y < 2; y++) out.push(customFile(frame));
  return out;
};

function textCharacter(minor, embedded, name) {
  const graphics = [];
  if (embedded) {
    for (const direction of directions) for (let frame = 1; frame <= 4; frame++) {
      graphics.push(...diagnosticTile(direction, frame, "whole"));
    }
    // The text reader stores battle art pixel-by-pixel in fight, special,
    // defense, defeat order, rather than whole frames for each action.
    for (let frame = 1; frame <= 4; frame++) {
      const byAction = actions.map(kind => diagnosticTile(kind, frame));
      for (let p = 0; p < 1024; p++) {
        for (const index of [0, 2, 1, 3]) graphics.push(byAction[index][p]);
      }
    }
    graphics.push(...diagnosticTile("Rest"));
    for (let frame = 1; frame <= 10; frame++) graphics.push(...diagnosticTile("Custom", frame));
  } else {
    graphics.push(...walkingGraphics(), ...artGraphics(minor, false));
  }
  const fields = ["RPGTLKIT CHAR", 2, minor, name, ...fill(9, ""), 10, 7, 9, 2, 3, 4, 6, 1,
    "face.gif", "pulse.spc", ...fill(201 * 5 - 1, ""), "", 0,
    ...(minor ? [embedded ? 0 : 1] : []), ...graphics,
    ...fill(23, 0), "tone.wav", "", minor <= 1 ? "tone.wav" : "", "", "start.prg", 0];
  return text(fields);
}

function binaryCharacter(minor) {
  // Preserve the existing source fixture's complete, versioned metadata
  // prefix. Its final slots are 32 walking zstr and 88 artwork zstr.
  const base = original.get(minor === 3 ? "Chrs/hero.tem" : "Chrs/walker.tem");
  if (!base) throw new Error("Missing binary character conformance template");
  const oldWalkingSize = minor === 3 ? 32 : zstr("two-tiles.tst2").length + 31;
  const prefix = base.subarray(0, base.length - oldWalkingSize - 88);
  return concat(prefix, ...walkingGraphics(), ...artGraphics(minor, true));
}

// The original seven conformance fixtures remain in format-fixtures.mjs.
// These are separately generated *diagnostic editions*, never editor saves.
export const visualCharacterBytes = new Map([
  ["Chrs/text-0-0.tem", textCharacter(0, true, "Text 2.0 hero 0")],
  ["Chrs/text-1-0.tem", textCharacter(1, true, "Text 2.1 hero 0")],
  ["Chrs/text-1-1.tem", textCharacter(1, false, "Text 2.1 hero 1")],
  ["Chrs/text-hero-0.tem", textCharacter(2, true, "Old hero")],
  ["Chrs/text-hero-1.tem", textCharacter(2, false, "Old hero")],
  ["Chrs/hero.tem", binaryCharacter(3)],
  ["Chrs/walker.tem", binaryCharacter(4)],
]);

export const diagnosticStyle = {
  id: "diagnostic-v1",
  tileCount: visualTileBytes.size,
  characterCount: visualCharacterBytes.size,
  transparentCorner: -1,
  background: bg,
  // COLORREF, not RGB24; positive values should decode to these RGBA triples.
  corners: { topLeft: white, topRight: ink, bottomLeft: ink, bottomRight: white },
};
