import { readMainFile, resolveAsset } from "./model.mjs";
import { basename, boardTilesets, buildReferences, directory, readArtifacts, tilePixels } from "./artifacts.mjs";
import { artifactRecord } from "./records.mjs";

const byId = id => document.getElementById(id);
const el = (tag, value = "", className = "") => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};
function button(label, action, className = "") {
  const node = el("button", label, className);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
function status(id, message, error = false) {
  const node = byId(id);
  node.textContent = message;
  node.classList.toggle("error", error);
}

let catalog;
let archive = null;
let paths = [];
let programs = [];
let mainFile = null;
let selected = null;
let archiveRequest = 0;
let mainRequest = 0;
let artifacts = new Map();
let folders = [];
let selectedFolder = null;
let references = { incoming: new Map(), outgoing: new Map() };
let tileSelection;
let animationTimer;
let mediaUrl;
let inspectorRevision = 0;
const demoStartup = "Demo/Prg/start.prg";
const sourceNames = {
  R13: "RPGCODE.REF · Toolkit 2.13",
  R19: "rpgcodeEN.ref · Toolkit 2.19b",
  H: "help3.htm · RPGCode Reference",
  E: "eventsEN.ref · Event catalog",
};
const roles = [
  ["Game Developer", "authors", "RPGCode program"],
  ["Translator / Trans2", "interprets", "RPGCode commands"],
];

function selectDefault() {
  const startup = mainFile ? resolveAsset(programs, "Prg", mainFile.startup) : null;
  const demo = !mainFile && programs.includes(demoStartup) ? demoStartup : null;
  selected = startup?.path ?? demo;
  selectedFolder = selected ? directory(selected) : (programs[0] ? directory(programs[0]) : folders[0]);
  tileSelection = undefined;
  const bindings = renderBindings(startup);
  references = buildReferences(artifacts, mainFile && { name: mainFile.filename, bindings });
  const mainData = byId("main-data");
  mainData.replaceChildren();
  if (mainFile) {
    const { filename, ...data } = mainFile;
    mainData.append(jsonPanel(() => artifactRecord(
      { ...data, path: filename, type: "gam", decodeStatus: "decoded" },
      references,
      { external: true, bindings },
    )));
  }
  renderBrowser();
  showArtifact();
}

function renderBindings(startup) {
  const panel = byId("bindings");
  panel.hidden = !mainFile;
  panel.replaceChildren();
  if (!mainFile) return [];
  const root = startup.path ? directory(directory(startup.path).slice(0, -1)) : null;
  const bindings = [
    ["Configured startup", { ...startup, value: mainFile.startup }],
    ["Opening board", { ...resolveAsset(paths, "Boards", mainFile.board, root), value: mainFile.board }],
    ["Initial character", { ...resolveAsset(paths, "Chrs", mainFile.character, root), value: mainFile.character }],
  ];
  const facts = [
    ["Game title", mainFile.title],
    ...bindings.map(([label, binding], i) => [label, bindingValue([mainFile.startup, mainFile.board, mainFile.character][i], binding)]),
  ];
  for (const [label, value] of facts) {
    const fact = el("div");
    fact.append(el("dt", label), el("dd", value, "technical"));
    panel.append(fact);
  }
  return bindings;
}

function bindingValue(name, result) {
  if (result.path) return result.path;
  if (result.status === "unset") return "Unspecified";
  const label = !archive ? "awaiting ZIP" : result.status === "ambiguous" ? "ambiguous in ZIP" : "missing from ZIP";
  return `${name} · ${label}`;
}

function renderBrowser() {
  byId("workspace").hidden = !archive;
  byId("folder-list").replaceChildren(...folders.map(folder => {
    const depth = Math.max(0, folder.split("/").length - 2);
    const node = button(folder ? basename(folder.slice(0, -1)) : "Archive root", () => {
      selectedFolder = folder;
      const first = paths.find(path => directory(path) === folder);
      selectArtifact(first ?? null);
      [...byId("folder-list").children].find(item => item.dataset.folder === folder)?.focus({ preventScroll: true });
    });
    node.style.paddingInlineStart = `${0.55 + depth * 0.65}rem`;
    node.title = folder || "Archive root";
    node.dataset.folder = folder;
    node.setAttribute("aria-pressed", String(folder === selectedFolder));
    return node;
  }));
  const files = paths.filter(path => directory(path) === selectedFolder);
  byId("file-count").textContent = `${files.length} in ${selectedFolder ? basename(selectedFolder.slice(0, -1)) : "archive root"}`;
  byId("file-list").replaceChildren(...files.map(path => {
    const node = button(basename(path), () => {
      selectArtifact(path);
      byId("file-list").querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    });
    node.title = path;
    node.setAttribute("aria-pressed", String(path === selected));
    return node;
  }));
  if (!files.length) byId("file-list").append(el("p", "No files in this folder."));
}

function selectArtifact(path, tile, line) {
  if (path && !artifacts.has(path)) return;
  selected = path;
  if (path) selectedFolder = directory(path);
  tileSelection = tile;
  renderBrowser();
  showArtifact();
  if (line) jumpToLine(line);
}

function selectionLabel(path) {
  if (!path) return "";
  if (mainFile && resolveAsset(programs, "Prg", mainFile.startup).path === path) return "Configured startup";
  if (!mainFile && path === demoStartup) return "Demo default";
  return "Selected file";
}

function showArtifact() {
  clearInterval(animationTimer);
  inspectorRevision++;
  if (mediaUrl) {
    URL.revokeObjectURL(mediaUrl);
    mediaUrl = undefined;
  }
  const artifact = artifacts.get(selected);
  const source = byId("source");
  byId("source-path").textContent = selected ?? "";
  byId("selection").textContent = selectionLabel(selected);
  byId("file-title").textContent = artifact?.program ? "Source" : artifact?.runs ? "Board preview" : "File details";
  byId("graph-title").textContent = artifact?.program ? "Capability graph" : "Artifact inspector";
  byId("graph").replaceChildren();
  byId("reference").replaceChildren();
  byId("connections").replaceChildren();
  byId("counts").textContent = "";
  source.replaceChildren(el("p", artifact ? "Details for this file appear in the inspector." : "Choose a file to inspect."));
  if (!artifact) return;
  if (artifact.program) {
    renderSource(artifact.program);
    renderGraph(artifact.program);
  } else {
    renderAsset(artifact);
  }
  renderConnections(artifact.path);
}

function paintTile(canvas, edge, y = 0) {
  const set = artifacts.get(edge?.to);
  const rgba = set?.bytes ? tilePixels(set, edge.tile) : null;
  if (rgba) canvas.getContext("2d").putImageData(new ImageData(rgba, 32, 32), 0, y);
}

function tileCanvas(height = 32) {
  const canvas = el("canvas", "", "tile-image");
  canvas.width = 32;
  canvas.height = height;
  canvas.setAttribute("aria-hidden", "true");
  return canvas;
}

function renderAsset(artifact) {
  const panel = byId("graph");
  const edges = references.outgoing.get(artifact.path) ?? [];
  if (artifact.error) {
    panel.append(el("p", artifact.error));
    return;
  }
  if (artifact.type === "tst") {
    panel.append(el("p", `${artifact.count} tiles · 32 × 32 pixels · ART-05 Tilesets`));
    const grid = el("div", "", "tile-grid");
    for (let tile = 1; tile <= artifact.count; tile++) {
      const node = button(String(tile), () => {
        tileSelection = tileSelection === tile ? undefined : tile;
        for (const cell of grid.children) cell.setAttribute("aria-pressed", String(Number(cell.dataset.tile) === tileSelection));
        renderConnections(artifact.path);
      });
      node.dataset.tile = tile;
      node.setAttribute("aria-label", `Tile ${tile}`);
      node.setAttribute("aria-pressed", String(tile === tileSelection));
      const canvas = tileCanvas();
      paintTile(canvas, { to: artifact.path, tile });
      node.prepend(canvas);
      grid.append(node);
    }
    panel.append(grid);
    grid.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest" });
    return;
  }
  if (artifact.type === "tan") {
    panel.append(el("p", `${edges.length} frames · Stored speed ${artifact.speed} · ART-07 Animated tiles`));
    if (!edges.length) return;
    const canvas = tileCanvas();
    canvas.classList.add("large-tile");
    const label = el("p", "", "technical");
    let frame = 0;
    function preview(index) {
      frame = index;
      canvas.getContext("2d").clearRect(0, 0, 32, 32);
      paintTile(canvas, edges[frame]);
      label.textContent = `Frame ${frame + 1} · ${edges[frame].value}`;
    }
    const play = button("Play preview", () => {
      if (play.getAttribute("aria-pressed") === "true") {
        clearInterval(animationTimer);
        play.setAttribute("aria-pressed", "false");
        play.textContent = "Play preview";
      } else {
        animationTimer = setInterval(() => preview((frame + 1) % edges.length), Math.max(80, 1000 / Math.max(1, artifact.speed)));
        play.setAttribute("aria-pressed", "true");
        play.textContent = "Pause preview";
      }
    });
    play.setAttribute("aria-pressed", "false");
    panel.append(canvas, label, play);
    preview(0);
    return;
  }
  if (artifact.type === "tem") {
    panel.append(el("h3", artifact.name), el("p", "ACT-01 Player definition · ACT-03 Player art and audio"));
    const stats = el("dl", "", "bindings");
    for (const [name, value] of Object.entries(artifact.stats)) {
      const fact = el("div");
      fact.append(el("dt", name), el("dd", String(value)));
      stats.append(fact);
    }
    const portrait = edges.find(edge => edge.evidence === "Character portrait")?.to;
    if (portrait) showMedia(panel, portrait, `${artifact.name} portrait`);
    panel.append(stats);
    const sprites = el("div", "", "sprite-strip");
    for (const frame of artifact.walking.filter(frame => frame.frame === 1)) {
      const canvas = tileCanvas(64);
      const caption = el("div", frame.direction);
      for (const [index, part] of frame.parts.entries()) {
        paintTile(canvas, edges.find(edge => edge.evidence === part.evidence), index * 32);
      }
      caption.prepend(canvas);
      sprites.append(caption);
    }
    panel.append(sprites);
    return;
  }
  if (artifact.runs) {
    renderBoard(panel, artifact, edges);
    return;
  }
  if (/^(gif|jpg|jpeg|png|bmp)$/.test(artifact.type)) {
    if (artifact.width) panel.append(el("p", `${artifact.width} × ${artifact.height} pixels`));
    showMedia(panel, artifact.path, basename(artifact.path));
    return;
  }
  if (artifact.type === "wav") {
    panel.append(el("p", `${artifact.channels} channel(s) · ${artifact.sampleRateHz} Hz · ${artifact.bitsPerSample} bits`));
    showMedia(panel, artifact.path, basename(artifact.path), true);
    return;
  }
  if (artifact.type === "mid") {
    panel.append(el("p", `Standard MIDI File · Format ${artifact.format} · ${artifact.trackCount} tracks`));
    return;
  }
  if (artifact.type === "doc") {
    panel.append(el("p", `Compound document · ${artifact.directory?.length ?? 0} directory entries`));
    return;
  }
  if (artifact.type === "___") {
    panel.append(el("p", `${artifact.records.length} observed text records · Source format unverified`));
    return;
  }
  panel.append(el("p", `${artifact.type.toUpperCase() || "Unknown format"} · Archive entry`));
}

function renderBoard(panel, board, edges) {
  panel.append(el("p", `${board.width} × ${board.height} tiles · ${board.layers} layers · MAP-01 Boards`));
  const sets = boardTilesets(edges, references, artifacts);
  panel.append(el("h3", "Tilesets used"));
  if (!sets.size) panel.append(el("p", "No resolved tilesets in the decoded board references."));
  const list = el("ul", "", "edge-list");
  for (const [path, set] of sets) {
    const description = [
      set.direct.size ? `${set.direct.size} direct tile references` : "",
      ...[...set.animations].map(animation => `via ${basename(animation)}`),
    ].filter(Boolean).join(" · ");
    const row = el("li");
    row.append(button(basename(path), () => selectArtifact(path)), el("span", ` ${description}`));
    list.append(row);
  }
  panel.append(list);
  const preview = byId("source");
  const tileSize = Math.min(32, Math.floor(4096 / Math.max(board.width, board.height)));
  if (tileSize < 1) {
    preview.replaceChildren(el("p", "This board exceeds the preview canvas size."));
    return;
  }
  const controls = el("label", "Layers", "board-controls");
  const layers = el("select");
  for (let i = 0; i <= board.layers; i++) {
    const option = el("option", i ? board.layerTitles[i] || `Layer ${i}` : "All layers");
    option.value = String(i);
    layers.append(option);
  }
  controls.append(layers);
  const stage = el("div", "", "board-stage");
  const canvas = el("canvas", "", "board-map");
  canvas.width = board.width * tileSize;
  canvas.height = board.height * tileSize;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Tile map for ${basename(board.path)}`);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const color = board.background;
  if (color >= 0) stage.style.backgroundColor = `rgb(${color & 255}, ${(color >>> 8) & 255}, ${(color >>> 16) & 255})`;
  stage.append(canvas);
  const notes = el("p", "", "board-note");
  preview.replaceChildren(controls, stage, notes);
  const background = edges.find(edge => edge.evidence === "Board background image")?.to;
  if (background) showMedia(stage, background, "Board background");

  const indexed = new Map(edges.filter(edge => edge.index !== undefined).map(edge => [edge.index, edge]));
  const area = board.width * board.height;
  const cache = new Map();
  function stamp(index, shade) {
    const key = `${index}:${shade.join(",")}`;
    if (!cache.has(key)) {
      let tile = indexed.get(index);
      if (artifacts.get(tile?.to)?.type === "tan") tile = references.outgoing.get(tile.to)?.[0];
      const tileset = artifacts.get(tile?.to);
      const rgba = tileset?.bytes ? tilePixels(tileset, tile.tile) : null;
      let image = null;
      if (rgba) {
        for (let p = 0; p < rgba.length; p += 4) {
          for (let channel = 0; channel < 3; channel++) rgba[p + channel] += shade[channel] + board.ambient[channel];
        }
        image = tileCanvas();
        image.getContext("2d").putImageData(new ImageData(rgba, 32, 32), 0, 0);
      }
      cache.set(key, image);
    }
    return cache.get(key);
  }
  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const layer = Number(layers.value);
    const from = layer ? (layer - 1) * area : 0;
    const to = layer ? layer * area : area * board.layers;
    const missing = new Set();
    for (const { offset, length, index, shade } of board.runs) {
      const start = Math.max(from, offset);
      const end = Math.min(to, offset + length);
      if (start >= end) continue;
      const image = stamp(index, shade);
      if (!image) {
        missing.add(index);
        continue;
      }
      for (let cell = start; cell < end; cell++) {
        const x = cell % board.width;
        const y = Math.floor((cell % area) / board.width);
        context.drawImage(image, x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }
    notes.textContent = "Static tile preview · animated tiles show their first frame."
      + (missing.size ? ` ${missing.size} tile references could not be rendered.` : "");
  }
  layers.addEventListener("change", draw);
  draw();
}

async function showMedia(panel, path, description, audio = false) {
  const revision = inspectorRevision;
  try {
    const blob = await archive.file(path).async("blob");
    if (revision !== inspectorRevision) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = URL.createObjectURL(audio ? new Blob([blob], { type: "audio/wav" }) : blob);
    const media = el(audio ? "audio" : "img", "", audio ? "artifact-audio" : "artifact-image");
    media.src = mediaUrl;
    if (audio) {
      media.controls = true;
      media.setAttribute("aria-label", description);
    } else {
      media.alt = description;
    }
    panel.prepend(media);
  } catch {
    if (revision === inspectorRevision) panel.append(el("p", "Media preview unavailable."));
  }
}

function renderConnections(path) {
  const container = byId("connections");
  container.replaceChildren();
  const incoming = references.incoming.get(path) ?? [];
  const outgoing = references.outgoing.get(path) ?? [];
  const uses = tileSelection ? incoming.filter(edge => edge.tile === tileSelection) : incoming;
  const title = tileSelection ? `Used by · Tile ${tileSelection}` : "Used by";
  renderEdges(container, title, uses, true);
  renderEdges(container, "References", outgoing, false);
  container.append(jsonPanel(() => artifactRecord(artifacts.get(path), references)));
}

function jsonPanel(record) {
  const details = el("details", "", "reference data-panel");
  const summary = el("summary", "View decoded JSON");
  const code = el("pre", "", "json-source");
  code.tabIndex = 0;
  code.setAttribute("aria-label", "Decoded artifact JSON");
  details.append(summary, code);
  details.addEventListener("toggle", () => {
    if (details.open && !code.textContent) code.textContent = JSON.stringify(record(), null, 2);
  });
  return details;
}

function renderEdges(container, title, edges, reverse) {
  const section = el("section", "", "reference");
  section.append(el("h3", title));
  if (!edges.length) section.append(el("p", "No matching references in the indexed fields."));
  const groups = new Map();
  for (const edge of edges) {
    const key = reverse ? edge.from : edge.to ?? edge.value;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(edge);
  }
  for (const [name, group] of groups) {
    const details = el("details", "", "edge-group");
    details.open = edges.length <= 12;
    details.append(el("summary", `${name} · ${group.length}`, "technical"));
    const list = el("ul", "", "edge-list");
    for (const edge of group) {
      const target = reverse ? edge.from : edge.to;
      const label = `${edge.evidence}${edge.line ? ` · line ${edge.line}` : ""} · ${edge.value}`;
      const item = el("li");
      item.append(artifacts.has(target) && !(reverse && edge.external) ?
        button(label, () => selectArtifact(target, reverse ? undefined : edge.tile, reverse ? edge.line : undefined)) :
        el("span", edge.to ? label : `${label} · ${edge.status}`));
      list.append(item);
    }
    details.append(list);
    section.append(details);
  }
  container.append(section);
}

function jumpToLine(line) {
  byId("source").querySelector(".active-line")?.classList.remove("active-line");
  const target = byId(`line-${line}`);
  if (!target) return;
  target.classList.add("active-line");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "center", inline: "nearest" });
}

function renderSource(result) {
  const fragment = document.createDocumentFragment();
  for (const [index, row] of result.rows.entries()) {
    const line = el("div", "", "source-row");
    line.id = `line-${index + 1}`;
    line.tabIndex = -1;
    const code = el("code");
    let cursor = 0;
    for (const token of row.tokens) {
      code.append(row.line.slice(cursor, token.start));
      code.append(token.kind === "comment" ? el("span", token.value, "comment") :
        button(token.value, () => showReference(result.groups.get(token.key)), token.kind));
      cursor = token.start + token.value.length;
    }
    code.append(row.line.slice(cursor) || (cursor === 0 ? " " : ""));
    line.append(el("span", String(index + 1), "line-number"), code);
    fragment.append(line);
  }
  byId("source").replaceChildren(fragment);
  byId("source").scrollTo(0, 0);
}

function renderGraph(result) {
  byId("counts").textContent = `${result.count} calls · ${result.builtins.length} built-ins`;
  const graphRoles = el("div", "", "graph-roles");
  for (const [actor, verb, object] of roles) {
    const row = el("div");
    row.append(el("strong", actor), el("span", ` → ${verb} → `, "relation"), object);
    graphRoles.append(row);
  }
  const relation = el("p", "Source occurrences → RPGCode definitions → Toolkit capabilities");
  const list = el("div", "", "command-list");
  for (const group of result.groups.values()) {
    const label = group.kind === "builtin" ? `#${catalog[group.name].name}` : group.value;
    const node = button(`${label} · ${group.lines.length}`, () => showReference(group));
    node.dataset.group = group.key;
    node.setAttribute("aria-pressed", "false");
    list.append(node);
  }
  byId("graph").replaceChildren(graphRoles, relation, list);
  byId("reference").replaceChildren(el("p", "Select a command in the source or graph to inspect its reference and occurrences."));
}

function showReference(group) {
  for (const node of byId("graph").querySelectorAll("[data-group]")) {
    node.setAttribute("aria-pressed", String(node.dataset.group === group.key));
  }
  const entry = catalog[group.name];
  const reference = byId("reference");
  const heading = group.kind === "builtin" ? `#${entry.name}` : group.value;
  reference.replaceChildren(el("h3", heading));
  if (group.kind === "builtin") {
    if (entry.signature) reference.append(el("p", entry.signature, "technical"));
    reference.append(
      el("p", entry.summary),
      el("p", `Capability · ${entry.feature} ${entry.featureTitle}`),
      el("p", `Reference · ${entry.sources.map(source => sourceNames[source]).join(" / ")}`),
    );
  } else {
    const descriptions = {
      assignment: "RPGCode variable assignment · SCR-03 Variables and logic",
      local: "Call to a method declared in this program · SCR-04 Reuse and extension",
      declaration: "RPGCode method declaration · SCR-04 Reuse and extension",
      unknown: "Unresolved RPGCode token. It may belong to an external library, plugin, or another release.",
    };
    reference.append(el("p", descriptions[group.kind]));
  }
  const jumps = el("div", "", "jump-list");
  for (const line of new Set(group.lines)) {
    jumps.append(button(`Line ${line}`, () => jumpToLine(line), "line-jump"));
  }
  reference.append(jumps);
}

byId("archive").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++archiveRequest;
  status("archive-status", `Opening ${file.name}…`);
  try {
    const [zip, commands] = await Promise.all([
      globalThis.JSZip.loadAsync(await file.arrayBuffer()),
      catalog ? Promise.resolve(catalog) : fetch("./catalog.json").then(response => {
        if (!response.ok) throw new Error("Unable to load the command catalog.");
        return response.json();
      }),
    ]);
    if (request !== archiveRequest) return;
    const indexed = await readArtifacts(zip, commands);
    if (request !== archiveRequest) return;
    archive = zip;
    catalog = commands;
    artifacts = indexed.artifacts;
    folders = indexed.folders;
    paths = [...artifacts.keys()].sort();
    programs = paths.filter(path => artifacts.get(path).type === "prg");
    status("archive-status", `${file.name} · ${paths.length} files · ${programs.length} RPGCode programs`);
    selectDefault();
  } catch (error) {
    if (request === archiveRequest) status("archive-status", `Unable to open ${file.name}. ${error.message}`, true);
  }
});

byId("main-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++mainRequest;
  try {
    const result = readMainFile(new Uint8Array(await file.arrayBuffer()));
    if (request !== mainRequest) return;
    mainFile = { ...result, filename: file.name };
    status("main-status", `${file.name} · Binary format ${result.major}.${result.minor}`);
  } catch (error) {
    if (request !== mainRequest) return;
    mainFile = null;
    status("main-status", `Unable to read ${file.name}. ${error.message}`, true);
  }
  selectDefault();
});
