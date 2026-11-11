import { formatSummary, formatSpecTarget, mainSourceFormat } from "./asset-format.mjs";
import { openGameArchive } from "./archive.mjs";
import { mainFileBindings, readMainFile, resolveAsset } from "./model.mjs";
import { basename, boardTilesets, buildReferences, directory, readArtifacts, tilePixels } from "./artifacts.mjs";
import { defaultMidiTone, playMidi } from "./midi.mjs";
import { renderMidiPianoRoll } from "./piano-roll.mjs";
import { artifactRecord } from "./records.mjs";
import { connectedGameRecord, rpgcodeRoles } from "./game-graph.mjs";
import { createInspectorHistory } from "./inspector-history.mjs";
import { connectionCounts, connectionFilterOptions, connectionNeighbors, connectionType,
  filterConnections, referenceDestination } from "./connection-map.mjs";
import { characterArtworkSprite, animationFrames, battleBackground, enemySprite, itemSprites, keyFrameColor, standaloneTilePixels } from "./sprites.mjs";

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
let archiveName;
let paths = [];
let programs = [];
let mainFile = null;
let uploadedMainFile = null;
let archiveMainFile = null;
let archiveDownload;
let selected = null;
let archiveRequest = 0;
let mainRequest = 0;
let artifacts = new Map();
let folders = [];
let selectedFolder = null;
let references = { incoming: new Map(), outgoing: new Map() };
let tileSelection;
let selectedLine;
let connectionMapOpen = false;
let connectionFilters = {};
const inspectorHistory = createInspectorHistory(window.history);
let animationTimer;
let stopAnimationPlayback;
let stopWavePlayback;
let mediaUrl;
let midiPlayback;
let midiTone = { ...defaultMidiTone };
let midiSoundBank;
let midiSoundSource = "generaluser";
let generalUserGsDownload;
const generalUserGs = {
  name: "GeneralUser GS 2.0.3",
  async arrayBuffer() {
    generalUserGsDownload ??= fetch(new URL("./vendor/generaluser-gs/GeneralUser-GS.sf2", import.meta.url))
      .then(response => {
        if (!response.ok) throw new Error(`Could not download GeneralUser GS (HTTP ${response.status}).`);
        return response.blob();
      })
      .catch(error => {
        generalUserGsDownload = undefined;
        throw error;
      });
    // The audio worklet takes ownership of each playback's ArrayBuffer.
    return (await generalUserGsDownload).arrayBuffer();
  },
};
let inspectorRevision = 0;
const demoStartup = "Demo/Prg/start.prg";
const sourceNames = {
  R13: "RPGCODE.REF · Toolkit 2.13",
  R19: "rpgcodeEN.ref · Toolkit 2.19b",
  H: "help3.htm · RPGCode Reference",
  E: "eventsEN.ref · Event catalog",
};
function selectDefault(newArchive = false) {
  mainFile = uploadedMainFile ?? archiveMainFile;
  const bindings = mainFile ? mainFileBindings(mainFile, paths) : [];
  const demo = !mainFile && programs.includes(demoStartup) ? demoStartup : null;
  selected = bindings[0]?.[1].path ?? demo;
  selectedFolder = selected ? directory(selected) : (programs[0] ? directory(programs[0]) : folders[0]);
  tileSelection = undefined;
  selectedLine = undefined;
  renderBindings(bindings);
  references = buildReferences(artifacts, mainFile && {
    name: mainFile.filename, bindings, external: mainFile === uploadedMainFile,
  });
  const mainData = byId("main-data");
  mainData.replaceChildren();
  if (mainFile) mainData.append(assetFormatHeader({ type: "gam", sourceFormat: mainSourceFormat(mainFile) }));
  if (mainFile === archiveMainFile && archiveMainFile) {
    mainData.append(jsonPanel(() => artifactRecord(artifacts.get(archiveMainFile.filename), references)));
  } else if (mainFile) {
    const { filename, ...data } = mainFile;
    mainData.append(jsonPanel(() => artifactRecord(
      { ...data, path: filename, type: "gam", decodeStatus: "decoded" },
      references,
      { external: true, bindings },
    )));
  }
  renderBrowser();
  showArtifact();
  const selection = { path: selected, folder: selectedFolder, tile: tileSelection, line: selectedLine };
  if (newArchive) inspectorHistory.reset(crypto.getRandomValues(new Uint32Array(4)).join("-"), selection);
  else inspectorHistory.replace(selection);
}

function renderBindings(bindings) {
  const panel = byId("bindings");
  panel.hidden = !mainFile;
  panel.replaceChildren();
  if (!mainFile) return;
  const facts = [
    ["Game title", mainFile.title ?? "—"],
    ...bindings.map(([label, binding]) => [label, bindingValue(binding.value, binding)]),
  ];
  for (const [label, value] of facts) {
    const fact = el("div");
    fact.append(el("dt", label), el("dd", value, "technical"));
    panel.append(fact);
  }
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
      const first = paths.find(path => directory(path) === folder);
      selectArtifact(first ?? null, undefined, undefined, folder);
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

function selectArtifact(path, tile, line, folder = path ? directory(path) : selectedFolder) {
  if (path && !artifacts.has(path)) return;
  const selection = { path, folder, tile, line };
  inspectorHistory.visit(selection);
  restoreSelection(selection);
}

function restoreSelection({ path, folder, tile, line }) {
  const fileChanged = path !== selected || folder !== selectedFolder;
  const tileChanged = tile !== tileSelection;
  const lineChanged = line !== selectedLine;
  selected = path;
  selectedFolder = folder;
  tileSelection = tile;
  selectedLine = line;
  if (fileChanged) {
    renderBrowser();
    showArtifact();
  } else if (tileChanged) {
    for (const cell of byId("graph").querySelectorAll(".tile-grid [data-tile]")) {
      const active = Number(cell.dataset.tile) === tileSelection;
      cell.setAttribute("aria-pressed", String(active));
      if (active) cell.scrollIntoView({ block: "nearest" });
    }
    renderConnections(path);
  }
  if (line || fileChanged || lineChanged) jumpToLine(line);
}

window.addEventListener("popstate", event => {
  const selection = inspectorHistory.restore(event.state);
  if (selection) restoreSelection(selection);
});

function selectionLabel(path) {
  if (!path) return "";
  if (mainFile && resolveAsset(programs, "Prg", mainFile.startup).path === path) return "Configured startup";
  if (!mainFile && path === demoStartup) return "Demo default";
  return "Selected file";
}

function showArtifact() {
  midiPlayback?.stop();
  stopAnimationPlayback?.();
  stopAnimationPlayback = undefined;
  stopWavePlayback?.();
  stopWavePlayback = undefined;
  clearInterval(animationTimer);
  inspectorRevision++;
  if (mediaUrl) {
    URL.revokeObjectURL(mediaUrl);
    mediaUrl = undefined;
  }
  const artifact = artifacts.get(selected);
  const program = artifact?.type === "prg" ? artifact.program : undefined;
  const source = byId("source");
  byId("source-path").textContent = selected ?? "";
  byId("selection").textContent = selectionLabel(selected);
  byId("file-title").textContent = program ? "Source" : artifact?.runs ? "Board preview" :
    artifact?.type === "bkg" && !artifact.error ? "Battle background preview" : "File details";
  byId("graph-title").textContent = program ? "Capability graph" : "Artifact inspector";
  byId("graph").replaceChildren();
  byId("reference").replaceChildren();
  byId("connections").replaceChildren();
  byId("counts").textContent = "";
  source.replaceChildren(el("p", artifact ? "Details for this file appear in the inspector." : "Choose a file to inspect."));
  if (!artifact) return;
  if (program) {
    renderSource(program);
    renderGraph(program);
  } else {
    renderAsset(artifact);
  }
  byId("graph").prepend(assetFormatHeader(artifact));
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

function formatSpecLink(format, section = "", sourceFormat) {
  const target = formatSpecTarget({ type: format, sourceFormat });
  const { page } = target;
  const label = section ? "Tile addressing spec" : sourceFormat?.version ?
    `${format.toUpperCase()} ${sourceFormat.encoding} ${sourceFormat.version}${sourceFormat.detail === undefined ? "" : ` detail ${sourceFormat.detail}`} ${sourceFormat.supported ? "spec" : "coverage limits"}` :
    page === "other" ? "Archive entry spec" : `${format.toUpperCase()} format spec`;
  section ||= target.anchor;
  const link = el("a", label);
  link.href = `https://github.com/jmbjr/rpgtk_godot/blob/main/docs/specs/${page}.md${section}`;
  return link;
}

function assetFormatHeader(artifact) {
  const header = el("div", "", "asset-format");
  header.append(el("p", `File format: ${formatSummary(artifact)}`, "asset-format-version"),
    formatSpecLink(artifact.type, "", artifact.sourceFormat));
  if (artifact.sourceFormat?.version) header.append(el("p", "File-format revisions are independent of Toolkit releases.", "technical"));
  if (artifact.type === "tem" && !artifact.error) {
    header.append(el("p", artifact.embeddedWalking ?
      "Artwork storage: Embedded pixels. These pixels are stored inside this TEM; no source tileset is recorded." :
      "Artwork storage: Tile references. Graphics slots store filenames and, where applicable, tileset tile numbers.", "artwork-storage"));
  }
  return header;
}

function tilesetPdfControl(artifact) {
  const controls = el("div", "", "sprite-controls");
  const message = el("span", "", "technical");
  message.setAttribute("role", "status");
  const download = button("Download print-and-play PDF", async () => {
    const revision = inspectorRevision;
    const graph = references;
    download.disabled = true;
    message.textContent = "Building PDF…";
    try {
      const { tilesetPdf } = await import("./tile-pdf.mjs");
      const pdf = await tilesetPdf(artifact, graph);
      if (revision !== inspectorRevision) return;
      const url = URL.createObjectURL(pdf);
      const link = el("a");
      link.href = url;
      link.download = basename(artifact.path).replace(/\.tst$/i, "") + "-tile-cards.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      message.textContent = "PDF ready.";
    } catch (error) {
      message.textContent = `Unable to export PDF. ${error.message}`;
    } finally {
      download.disabled = false;
    }
  });
  controls.append(download, message);
  return controls;
}

function renderAsset(artifact) {
  const panel = byId("graph");
  const edges = references.outgoing.get(artifact.path) ?? [];
  if (artifact.error) {
    panel.append(el("p", artifact.error));
    return;
  }
  if (artifact.type === "bkg") {
    renderBattleBackground(panel, artifact, edges);
    return;
  }
  if (artifact.type === "fnt") {
    renderFont(panel, artifact);
    return;
  }
  if (artifact.type === "anm") {
    renderAnimation(panel, artifact, edges);
    return;
  }
  if (artifact.type === "spc") {
    renderSpecialMove(panel, artifact, edges);
    return;
  }
  if (artifact.type === "ste") {
    renderStatusEffect(panel, artifact, edges);
    return;
  }
  if (artifact.type === "tst") {
    panel.append(el("p", `${artifact.count} tiles · ${artifact.width} × ${artifact.height} pixels · ART-05 Tilesets`));
    if (artifact.count > 0) panel.append(tilesetPdfControl(artifact));
    const grid = el("div", "", "tile-grid");
    for (let tile = 1; tile <= artifact.count; tile++) {
      const node = button(String(tile), () => {
        selectArtifact(artifact.path, tileSelection === tile ? undefined : tile);
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
  if (artifact.type === "ene") {
    panel.append(el("h3", artifact.name), el("p", "Enemy graphic · BAT-03 Enemy definition"));
    const sprite = enemySprite(artifact, artifacts, references);
    if (!sprite?.parts.length) {
      panel.append(el("p", "No enemy graphic is available."));
      return;
    }
    if (sprite.missing.length === sprite.parts.length) {
      panel.append(el("p", "The archive is missing the tiles for this enemy graphic."));
    } else {
      const canvas = spriteCanvas(`${artifact.name} assembled graphic`);
      drawSprite(canvas, sprite);
      panel.append(canvas);
    }
    panel.append(spriteLinks(sprite));
    return;
  }
  if (artifact.type === "itm") {
    renderItemSprites(panel, artifact);
    return;
  }
  if (artifact.type === "gph") {
    const canvas = spriteCanvas(basename(artifact.path));
    const pixels = standaloneTilePixels(artifact);
    if (pixels) drawSprite(canvas, { width: 32, height: 32, pixels });
    panel.append(el("p", `${artifact.width} × ${artifact.height} pixels · ART-01 Tile drawing`), canvas);
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
    for (const [index, frame] of artifact.walking.entries()) {
      if (frame.frame !== 1) continue;
      const embedded = artifact.embeddedWalking?.[index];
      const canvas = tileCanvas(embedded ? 32 : 64);
      const caption = el("div", frame.direction);
      if (embedded) {
        const pixels = standaloneTilePixels({ width: 32, height: 32, pixels: embedded });
        canvas.getContext("2d").putImageData(new ImageData(pixels, 32, 32), 0, 0);
      } else {
        for (const [partIndex, part] of frame.parts.entries()) {
          paintTile(canvas, edges.find(edge => edge.evidence === part.evidence), partIndex * 32);
        }
      }
      caption.prepend(canvas);
      sprites.append(caption);
    }
    panel.append(sprites);
    for (const kind of ["Attack", "Defense", "Special move", "Defeat", "Rest", "Custom"]) {
      const frames = artifact.artwork.filter(frame => frame.kind === kind);
      const section = el("details", "", "character-artwork");
      section.append(el("summary", `${kind} artwork · ${frames.length} frame${frames.length === 1 ? "" : "s"}`));
      const strip = el("div", "", "sprite-strip");
      for (const frame of frames) {
        const sprite = characterArtworkSprite(artifact, frame, artifacts, references);
        const canvas = spriteCanvas(`${kind} frame ${frame.frame}`);
        drawSprite(canvas, sprite);
        const entry = el("div");
        entry.append(canvas, el("p", `Frame ${frame.frame}`));
        if (frame.parts) entry.append(spriteLinks(sprite));
        if (sprite.missing.length) entry.append(el("p", `${sprite.missing.length} tile parts missing`));
        if (!sprite.pixels.some(value => value)) entry.append(el("p", "Empty or unavailable artwork"));
        strip.append(entry);
      }
      section.append(strip);
      panel.append(section);
    }
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
    void renderWaveControls(panel, artifact.path);
    return;
  }
  if (artifact.type === "mid") {
    panel.append(el("p", `Standard MIDI File · Format ${artifact.format} · ${artifact.trackCount} tracks`));
    renderMidiControls(panel, artifact);
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

function assetFields(fields) {
  const list = el("dl", "", "asset-fields");
  for (const [name, value] of fields) {
    const detail = el("dd");
    detail.append(value);
    list.append(el("dt", name), detail);
  }
  return list;
}

function linkedAsset(value, edge) {
  if (edge?.to) return button(value, () => selectArtifact(edge.to, edge.tile));
  return edge ? `${value} · ${edge.status}` : value || "—";
}

function renderBattleBackground(panel, artifact, edges) {
  const background = battleBackground(artifact, artifacts, references);
  const canvas = spriteCanvas(`Battle backdrop for ${basename(artifact.path)}`);
  drawSprite(canvas, background);
  canvas.style.width = `${background.width}px`;
  byId("source").replaceChildren(canvas);
  if (!background.parts.length) byId("source").append(el("p", "This background has no tile placements."));
  panel.append(el("p", `Battle backdrop · ${artifact.width} × ${artifact.height} tiles`),
    el("h3", "Battle media"), assetFields(Object.entries(artifact.audio).map(([name, value]) =>
      [name, linkedAsset(value, edges.find(edge => edge.evidence === name))])));
  if (background.parts.length) panel.append(spriteLinks(background));
}

function renderFont(panel, font) {
  function drawGlyph(context, rows, x, y) {
    rows.forEach((byte, row) => {
      for (let column = 0; column < font.width; column++) {
        if (byte & (128 >> column)) context.fillRect(x + column, y + row, 1, 1);
      }
    });
  }
  const sampleLabel = el("label", "Sample text (ASCII)", "font-sample");
  const input = el("input");
  input.type = "text";
  input.maxLength = 80;
  input.value = "The Jewel of Destiny 0123";
  sampleLabel.append(input);
  const sample = spriteCanvas("Bitmap font sample");
  function drawSample() {
    const text = Array.from(input.value);
    sample.width = Math.max(1, text.length * font.width);
    sample.height = font.height;
    sample.style.width = `${sample.width * 2}px`;
    sample.setAttribute("aria-label", `Bitmap font sample: ${input.value}`);
    const context = sample.getContext("2d");
    context.fillStyle = "#ece8df";
    text.forEach((character, i) => {
      const code = character.codePointAt(0);
      drawGlyph(context, font.glyphs[code < 128 ? code : 63], i * font.width, 0);
    });
  }
  input.addEventListener("input", drawSample);
  drawSample();
  const atlas = spriteCanvas("All 256 glyphs in byte order, 16 per row");
  atlas.width = 16 * (font.width + 1);
  atlas.height = 16 * (font.height + 1);
  atlas.style.width = `${atlas.width * 2}px`;
  const context = atlas.getContext("2d");
  context.fillStyle = "#ece8df";
  font.glyphs.forEach((glyph, index) => {
    drawGlyph(context, glyph, (index % 16) * (font.width + 1), Math.floor(index / 16) * (font.height + 1));
  });
  panel.append(el("p", `Bitmap font · ${font.width} × ${font.height} pixels per glyph`),
    sampleLabel, sample, el("h3", "Glyphs in byte order"), atlas);
}

function renderSpecialMove(panel, move, edges) {
  const { name, description, fightPower, targetSpecialPower, cost, battle, board, program, assets } = move;
  const link = (value, evidence) => linkedAsset(value, edges.find(edge => edge.evidence === evidence));
  panel.append(el("h3", name), el("p", description), assetFields([
    ["Fight Power", String(fightPower)],
    ["Target SMP removed", String(targetSpecialPower)],
    ["SMP cost", String(cost)],
    ["Battle-Driven", battle ? "Yes" : "No"],
    ["Board-Driven", board ? "Yes" : "No"],
    ["RPGCode program", link(program, "Special move program")],
    ["Status effect", link(assets["Status effect"], "Status effect")],
    ["Effect animation", link(assets.Animation, "Animation")],
  ]));
}

function renderStatusEffect(panel, effect, edges) {
  const { name, rounds, speed, slow, disable, removeHp, hpAmount, removeSmp, smpAmount, runProgram, program } = effect;
  const yesNo = enabled => enabled ? "Yes" : "No";
  const programEdge = edges.find(edge => edge.evidence === "Status effect program");
  panel.append(el("h3", name), el("p", "Status effect"), assetFields([
    ["Duration", rounds === 0 ? "Until end of fight" : `${rounds} ${rounds === 1 ? "round" : "rounds"}`],
    ["Speed target charge time", yesNo(speed)],
    ["Slow target charge time", yesNo(slow)],
    ["Disable target", yesNo(disable)],
    ["Remove HP", yesNo(removeHp)],
    ["HP amount", String(hpAmount)],
    ["Remove SMP", yesNo(removeSmp)],
    ["SMP amount", String(smpAmount)],
    ["Run RPGCode program", yesNo(runProgram)],
    ["RPGCode program", linkedAsset(program, programEdge)],
  ]), el("p", "Negative amounts restore HP or SMP."));
}

const playbackIcons = {
  previous: "M5 5h2v14H5zM19 5v14L8 12z",
  next: "M17 5h2v14h-2zM5 5l11 7-11 7z",
  play: "M7 5l12 7-12 7z",
  pause: "M6 5h4v14H6zm8 0h4v14h-4z",
};

function setPlaybackIcon(control, iconName, label) {
  const namespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(namespace, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", playbackIcons[iconName]);
  icon.append(path);
  control.setAttribute("aria-label", label);
  control.title = label;
  control.replaceChildren(icon);
}

function renderAnimation(panel, artifact, edges) {
  const frames = animationFrames(artifact.frames);
  const { width, height } = artifact;
  panel.append(el("p", `Animation · ${width} × ${height} pixels · ${frames.length} frames`));
  if (!frames.length) return;
  if (![width, height].every(size => Number.isInteger(size) && size > 0 && size <= 2048)) {
    panel.append(el("p", "These animation dimensions cannot be previewed."));
    return;
  }

  const revision = inspectorRevision;
  const canvas = spriteCanvas(`Frame preview for ${basename(artifact.path)}`);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  const frameStatus = el("p", "", "technical");
  const frameAssets = el("div");
  const controls = el("div", "", "sprite-controls animation-controls");
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Animation playback controls");
  const loop = el("input");
  loop.type = "checkbox";
  const loopLabel = el("label", "", "animation-loop");
  loopLabel.append(loop, "Loop");
  const byEvidence = new Map(edges.map(edge => [edge.evidence, edge]));
  const sourceArchive = archive;
  const images = frames.map(({ image }, index) => {
    const path = byEvidence.get(`Frame ${index + 1} image`)?.to;
    return path && image ? sourceArchive.file(path).async("blob").then(async blob => {
      const url = URL.createObjectURL(blob);
      try {
        const frameImage = new Image();
        frameImage.src = url;
        await frameImage.decode();
        return frameImage;
      } finally {
        URL.revokeObjectURL(url);
      }
    }).catch(() => null) : Promise.resolve(null);
  });
  const sounds = frames.map((_, index) => byEvidence.get(`Frame ${index + 1} sound`)?.to);
  const soundPaths = [...new Set(sounds.filter(Boolean))];
  const audioStatus = el("p");
  audioStatus.setAttribute("role", "status");
  audioStatus.hidden = true;
  let index = 0;
  let drawRequest = 0;
  let playback;
  function display() {
    const request = ++drawRequest;
    const frame = frames[index];
    const label = `Frame ${index + 1} of ${frames.length}`;
    frameStatus.textContent = label;
    previous.disabled = index === 0;
    next.disabled = index === frames.length - 1;
    frameAssets.replaceChildren(assetFields([
      ["Image", linkedAsset(frame.image, byEvidence.get(`Frame ${index + 1} image`))],
      ["Sound", linkedAsset(frame.sound, byEvidence.get(`Frame ${index + 1} sound`))],
    ]));
    context.clearRect(0, 0, width, height);
    void images[index].then(image => {
      if (revision !== inspectorRevision || request !== drawRequest) return;
      if (!image) {
        if (frame.image) frameStatus.textContent = `${label} · Image unavailable`;
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      keyFrameColor(pixels.data, frame.transparentColor);
      context.putImageData(pixels, 0, 0);
    });
  }
  function stop() {
    if (!playback) return;
    clearInterval(playback.timer);
    if (playback.audio) void playback.audio.close().catch(() => {});
    playback = undefined;
    updatePlayButton(false);
  }
  function moveFrame(change) {
    stop();
    index = Math.min(frames.length - 1, Math.max(0, index + change));
    display();
  }
  function finish(run) {
    clearInterval(run.timer);
    run.finished = true;
    updatePlayButton(false);
    // Let the final frame's sound ring out before releasing the audio context.
    if (!run.activeSounds) stop();
  }
  function playFrameSound(run) {
    const buffer = run.buffers.get(sounds[index]);
    if (!buffer) return;
    const source = run.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(run.audio.destination);
    run.activeSounds++;
    source.onended = () => {
      run.activeSounds--;
      if (playback === run && run.finished && !run.activeSounds) stop();
    };
    source.start();
  }
  async function start() {
    if (index === frames.length - 1) {
      index = 0;
      display();
    }
    const run = { buffers: new Map(), activeSounds: 0, finished: false };
    playback = run;
    updatePlayButton(true);
    audioStatus.hidden = true;
    if (soundPaths.length) {
      try {
        const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
        run.audio = new AudioContext();
        const resumed = run.audio.resume();
        const results = soundPaths.map(async path => {
          const bytes = await sourceArchive.file(path).async("arraybuffer");
          const buffer = await run.audio.decodeAudioData(bytes);
          run.buffers.set(path, buffer);
        });
        const [, decoded] = await Promise.all([resumed, Promise.allSettled(results)]);
        if (decoded.some(result => result.status === "rejected")) {
          throw new Error("One or more frame sounds could not be decoded.");
        }
      } catch {
        if (playback !== run) return;
        audioStatus.textContent = "Some frame audio could not be played.";
        audioStatus.hidden = false;
      }
    }
    if (playback !== run) return;
    playFrameSound(run);
    run.timer = setInterval(() => {
      if (index === frames.length - 1 && !loop.checked) {
        finish(run);
        return;
      }
      index = (index + 1) % frames.length;
      display();
      playFrameSound(run);
    }, Math.max(16, artifact.pauseSeconds * 1000 || 100));
  }
  const previous = button("", () => moveFrame(-1));
  setPlaybackIcon(previous, "previous", "Previous frame");
  const next = button("", () => moveFrame(1));
  setPlaybackIcon(next, "next", "Next frame");
  const play = button("", () => {
    const playing = playback && !playback.finished;
    stop();
    if (!playing) void start();
  });
  function updatePlayButton(playing) {
    setPlaybackIcon(play, playing ? "pause" : "play", playing ? "Pause animation" : "Play animation");
  }
  updatePlayButton(false);
  stopAnimationPlayback = stop;
  controls.append(previous, play, next, loopLabel);
  play.disabled = true;
  void Promise.all(images).then(() => {
    if (revision === inspectorRevision) play.disabled = false;
  });
  panel.append(canvas, frameStatus, controls, audioStatus, frameAssets);
  display();
}

function spriteCanvas(label) {
  const canvas = el("canvas", "", "sprite-preview");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", label);
  return canvas;
}

function drawSprite(canvas, sprite) {
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  canvas.style.width = `${sprite.width * 2}px`;
  canvas.getContext("2d").putImageData(new ImageData(sprite.pixels, sprite.width, sprite.height), 0, 0);
}

function spriteLinks(sprite) {
  if (sprite.embedded) return el("p", "Source artwork is embedded in this item.", "technical");
  const details = el("details", "", "edge-group");
  details.append(el("summary", `Source tiles · ${sprite.parts.length}`));
  const list = el("ul", "", "edge-list");
  for (const { x, y, value, edge } of sprite.parts) {
    const row = el("li");
    const label = `(${x + 1}, ${y + 1}) · ${value}`;
    row.append(edge?.to ?
      button(label, () => selectArtifact(edge.to, edge.tile)) :
      el("span", `${label} · ${edge?.status ?? "Unresolved"}`));
    list.append(row);
  }
  details.append(list);
  if (sprite.missing.length) {
    details.open = true;
    details.append(el("p", `${sprite.missing.length} tile parts could not be rendered.`));
  }
  return details;
}

function renderItemSprites(panel, artifact) {
  panel.append(el("h3", artifact.name), el("p", "Item graphics · ITM-01 Item roles"));
  const sprites = itemSprites(artifact, artifacts, references);
  const sequences = sprites.walking.filter(sequence => sequence.frames.some(Boolean));
  if (sprites.rest) {
    const rest = spriteCanvas(`${artifact.name} resting sprite`);
    drawSprite(rest, sprites.rest);
    panel.append(el("h3", "Resting sprite"), rest, spriteLinks(sprites.rest));
  }
  if (!sequences.length) {
    if (!sprites.rest) panel.append(el("p", "This item has no assigned graphic."));
    return;
  }

  panel.append(el("h3", "Walking sprite"));
  const directionLabel = el("label", "Direction", "board-controls");
  const directions = el("select");
  for (const { direction } of sequences) directions.append(el("option", direction));
  directionLabel.append(directions);
  const canvas = spriteCanvas(`${artifact.name} walking sprite`);
  drawSprite(canvas, sequences[0].frames.find(Boolean));
  const controls = el("div", "", "sprite-controls");
  const frameStatus = el("span", "", "technical");
  const links = el("div");
  let frame = 0;

  const sequence = () => sequences[directions.selectedIndex].frames;
  function display() {
    const sprite = sequence()[frame];
    if (sprite) {
      drawSprite(canvas, sprite);
      links.replaceChildren(spriteLinks(sprite));
    } else {
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      links.replaceChildren(el("p", "This frame has no assigned graphic."));
    }
    frameStatus.textContent = `${directions.value} · Frame ${frame + 1} of ${sequence().length}`;
  }
  function stop() {
    clearInterval(animationTimer);
    play.setAttribute("aria-pressed", "false");
    play.textContent = "Play walk";
  }
  function step(change) {
    frame = (frame + change + sequence().length) % sequence().length;
    display();
  }
  const play = button("Play walk", () => {
    if (play.getAttribute("aria-pressed") === "true") {
      stop();
      return;
    }
    play.setAttribute("aria-pressed", "true");
    play.textContent = "Pause walk";
    animationTimer = setInterval(() => step(1), 167);
  });
  play.setAttribute("aria-pressed", "false");
  directions.addEventListener("change", () => {
    stop();
    frame = 0;
    display();
  });
  controls.append(
    button("Previous frame", () => { stop(); step(-1); }),
    play,
    button("Next frame", () => { stop(); step(1); }),
  );
  panel.append(directionLabel, canvas, frameStatus, controls, links);
  display();
}

function renderBoardMetadata(panel, board) {
  panel.append(el("p", `Stored start: (${board.start.x}, ${board.start.y}, layer ${board.start.layer}) · Save disabled flag: ${board.saveDisabled}`));
  for (const [title, slots, field] of [["Program placements", board.programs, "program"], ["Item placements", board.items, "item"]]) {
    const section = el("details", "", "board-conditions");
    const populated = slots.filter(slot => slot[field] || slot.graphic || slot.activationProgram || slot.multitaskProgram ||
      Object.values(slot.condition).some(value => value !== "" && value !== 0));
    section.append(el("summary", `${title} · ${populated.length} populated / ${slots.length} stored slots`));
    for (const slot of populated) {
      const c = slot.condition;
      const position = slot.position;
      const row = el("div", "", "reference");
      row.append(el("h4", `Slot ${slot.slot}: ${slot[field] || "(blank filename)"}`),
        el("p", `Stored position (${position.x}, ${position.y}, layer ${position.layer})`),
        el("p", `Activation mode ${c.mode}${c.mode === 0 ? " (always)" : c.mode === 1 ? " (conditional)" : ""}; type ${c.type}${c.type === 0 ? " (step on)" : c.type === 1 ? " (activation key)" : ""}`),
        el("p", `Initial: ${JSON.stringify(c.initialVariable)} = ${JSON.stringify(c.initialValue)}; Final: ${JSON.stringify(c.finalVariable)} = ${JSON.stringify(c.finalValue)}`));
      for (const [key, label] of [["graphic", "Graphic"], ["activationProgram", "Activation program"], ["multitaskProgram", "Multitask program"]]) if (slot[key]) row.append(el("p", `${label}: ${slot[key]}`));
      section.append(row);
    }
    section.append(el("p", "Stored conditions are displayed as data; they are not evaluated."));
    panel.append(section);
  }
  const types = new Map();
  for (const run of board.tileTypes) types.set(run.value, (types.get(run.value) ?? 0) + run.length);
  const labels = { 0: "Normal", 1: "Solid", 2: "Under", 3: "North/south normal", 4: "East/west normal" };
  panel.append(el("h3", "Tile types"));
  for (const [value, count] of [...types].sort((a, b) => a[0] - b[0])) {
    const label = labels[value] ?? (value >= 11 && value <= 18 ? `Elevate to layer ${value - 10}` : "Unknown stored code");
    panel.append(el("p", `${value}: ${label} · ${count} cells`));
  }
}

function renderBoard(panel, board, edges) {
  panel.append(el("p", `${board.width} × ${board.height} tiles · ${board.layers} layers · MAP-01 Boards`));
  renderBoardMetadata(panel, board);
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
  const controls = el("div", "", "board-controls");
  const layers = el("select");
  for (let i = 0; i <= board.layers; i++) {
    const option = el("option", i ? board.layerTitles[i] || `Layer ${i}` : "All layers");
    option.value = String(i);
    layers.append(option);
  }
  const typeLabel = el("label", "Show tile types");
  const showTypes = el("input");
  showTypes.type = "checkbox";
  typeLabel.prepend(showTypes);
  const layerLabel = el("label", "Layers");
  layerLabel.append(layers);
  controls.append(layerLabel, typeLabel);
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
    if (showTypes.checked) {
      for (const { offset, length, value } of board.tileTypes) {
        if (!value) continue;
        for (let cell = Math.max(from, offset); cell < Math.min(to, offset + length); cell++) {
          const x = (cell % board.width) * tileSize;
          const y = Math.floor((cell % area) / board.width) * tileSize;
          context.fillStyle = "rgba(210, 80, 80, 0.45)";
          context.fillRect(x, y, tileSize, tileSize);
          context.fillStyle = "white";
          context.font = `${Math.max(9, Math.floor(tileSize * 0.4))}px monospace`;
          context.fillText(String(value), x + 1, y + Math.max(9, tileSize / 2));
        }
      }
    }
    notes.textContent = "Static tile preview · animated tiles show their first frame."
      + (missing.size ? ` ${missing.size} tile references could not be rendered.` : "");
  }
  const cellInfo = el("p", "Click a cell to inspect its stored tile types.");
  preview.append(cellInfo);
  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width / tileSize);
    const y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height / tileSize);
    if (x < 0 || x >= board.width || y < 0 || y >= board.height) return;
    const selected = Number(layers.value);
    const values = [];
    for (let l = 0; l < board.layers; l++) {
      if (selected && l !== selected - 1) continue;
      const offset = l * area + y * board.width + x;
      const run = board.tileTypes.find(run => offset >= run.offset && offset < run.offset + run.length);
      values.push(`layer ${l + 1}: ${run?.value ?? "unavailable"}`);
    }
    cellInfo.textContent = `Cell (${x + 1}, ${y + 1}) · ${values.join("; ")}`;
  });
  showTypes.addEventListener("change", draw);
  layers.addEventListener("change", () => { cellInfo.textContent = "Click a cell to inspect its stored tile types."; draw(); });
  draw();
}

function renderMidiTracks(tracks) {
  const details = el("details", "", "edge-group");
  details.append(el("summary", `MIDI tracks · ${tracks.length}`));
  const scroller = el("div", "", "midi-track-scroll");
  scroller.tabIndex = 0;
  scroller.setAttribute("role", "region");
  scroller.setAttribute("aria-label", "MIDI track and note summary");
  const table = el("table", "", "midi-track-table");
  const head = el("thead");
  const columns = el("tr");
  for (const name of ["Track", "Instrument", "Notes", "Range"]) {
    const heading = el("th", name);
    heading.scope = "col";
    columns.append(heading);
  }
  head.append(columns);
  table.append(head);
  const pitchNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const pitchName = note => `${pitchNames[note % 12]}${Math.floor(note / 12) - 1}`;
  for (const track of tracks) {
    const group = el("tbody");
    const name = [...new Set(track.names.filter(Boolean))].join(" / ");
    const heading = el("th", name ? `${track.number} · ${name}` : `Track ${track.number}`);
    heading.scope = "rowgroup";
    heading.rowSpan = Math.max(1, track.parts.length);
    if (track.instruments.length) heading.append(el("small", track.instruments.join(" / ")));
    if (!track.parts.length) {
      const row = el("tr");
      row.append(heading, el("td", "No notes"), el("td", "0"), el("td", "—"));
      group.append(row);
    }
    for (const [index, part] of track.parts.entries()) {
      const row = el("tr");
      if (index === 0) row.append(heading);
      const instrument = el("td", part.instrument);
      const channel = `Ch. ${part.channel}${part.port ? ` · Port ${part.port}` : ""}`;
      instrument.append(el("small", `${channel} · ${part.percussion ? "Kit" : "Program"} ${part.program}`));
      const noteLabel = part.percussion ? String : pitchName;
      const low = noteLabel(part.lowestNote);
      const high = noteLabel(part.highestNote);
      row.append(instrument, el("td", part.noteCount.toLocaleString()), el("td", low === high ? low : `${low}–${high}`));
      group.append(row);
    }
    table.append(group);
  }
  scroller.append(table);
  details.append(scroller, el("p", "Instrument labels use General MIDI. Percussion ranges show MIDI key numbers."));
  return details;
}

function renderMidiControls(panel, artifact) {
  const controls = el("div", "", "audio-controls");
  const message = el("p");
  message.setAttribute("role", "status");
  let playing = false;
  let playingMessage;

  function updatePlay() {
    setPlaybackIcon(play, playing ? "pause" : "play", playing ? "Pause MIDI" : "Play MIDI");
  }
  const play = button("", () => {
    if (midiPlayback) {
      playing = !playing;
      midiPlayback.setPaused(!playing);
      message.textContent = playing ? playingMessage : "MIDI paused.";
      updatePlay();
      return;
    }

    play.disabled = true;
    reset.disabled = false;
    const bank = midiSoundSource === "generaluser" ? generalUserGs :
      midiSoundSource === "local" ? midiSoundBank : undefined;
    playingMessage = bank ? `Playing with ${bank.name}.` : "Playing MIDI with the built-in synth.";
    message.textContent = bank ? `Loading MIDI with ${bank.name}…` : "Loading MIDI…";
    midiPlayback = playMidi(
      archive.file(artifact.path).async("uint8array"),
      midiTone,
      bank,
      () => {
        playing = true;
        play.disabled = false;
        message.textContent = playingMessage;
        updatePlay();
      },
      finish,
    );
  });
  const reset = button("", () => midiPlayback?.stop("MIDI reset to beginning."));
  setPlaybackIcon(reset, "previous", "Reset MIDI to beginning");
  function finish(messageText) {
    midiPlayback = undefined;
    playing = false;
    play.disabled = false;
    reset.disabled = true;
    message.textContent = messageText;
    updatePlay();
  }
  updatePlay();
  reset.disabled = true;
  controls.append(play, reset);
  const pianoRoll = renderMidiPianoRoll(
    artifact.tracks,
    () => archive.file(artifact.path).async("uint8array"),
    () => midiPlayback?.currentTime ?? -1,
  );
  panel.append(controls, message, pianoRoll, renderMidiTracks(artifact.tracks), renderMidiSoundBank(), renderMidiTone());
}

function renderMidiSoundBank() {
  const group = el("fieldset", "", "midi-bank");
  group.append(el("legend", "MIDI sound source"));

  const picker = el("input");
  picker.type = "file";
  picker.accept = ".sf2,.dls";
  const pickerLabel = el("label", "Choose a local sound bank (.sf2 or .dls)");
  pickerLabel.append(picker);
  const source = el("select");
  const builtIn = el("option", "Built-in synth");
  builtIn.value = "builtin";
  const hosted = el("option", generalUserGs.name);
  hosted.value = "generaluser";
  const local = el("option");
  local.value = "local";
  source.append(hosted, builtIn, local);
  const sourceLabel = el("label", "Playback synth");
  sourceLabel.append(source);

  function display() {
    local.textContent = midiSoundBank?.name ?? "Local sound bank";
    local.disabled = !midiSoundBank;
    source.value = midiSoundSource;
  }

  picker.addEventListener("change", () => {
    const file = picker.files[0];
    if (!file) return;
    midiPlayback?.stop();
    midiSoundBank = file;
    midiSoundSource = "local";
    display();
    picker.value = "";
  });
  source.addEventListener("change", () => {
    midiPlayback?.stop();
    midiSoundSource = source.value;
  });
  const credit = el("p", "GeneralUser GS by ");
  const creator = el("a", "S. Christian Collins");
  creator.href = "https://www.schristiancollins.com/generaluser.php";
  const license = el("a", "License");
  license.href = "./vendor/generaluser-gs/LICENSE.txt";
  credit.append(creator, " · ", license, " · 32 MB on first play");
  display();
  group.append(sourceLabel, credit, pickerLabel);
  return group;
}

function renderMidiTone() {
  const group = el("fieldset", "", "midi-eq");
  group.append(el("legend", "MIDI tone"));
  const sliders = [
    ["bass", "Bass (250 Hz)", -18, 6, 1, "dB"],
    ["mid", "Mid gain", -18, 6, 1, "dB"],
    ["midFrequency", "Mid frequency", 200, 8000, 100, "Hz"],
    ["treble", "Treble gain", -18, 6, 1, "dB"],
    ["trebleFrequency", "Treble frequency", 1000, 12000, 100, "Hz"],
  ].map(([key, name, min, max, step, unit]) => {
    const label = el("label");
    const reading = el("span", "", "midi-eq-value");
    reading.setAttribute("aria-hidden", "true");
    const input = el("input");
    input.type = "range";
    input.min = min;
    input.max = max;
    input.step = step;
    function display() {
      const value = midiTone[key];
      input.value = value;
      reading.textContent = `${value} ${unit}`;
      input.setAttribute("aria-valuetext", reading.textContent);
    }
    input.addEventListener("input", () => {
      midiTone[key] = input.valueAsNumber;
      display();
      midiPlayback?.setTone(midiTone);
    });
    label.append(el("span", name), input, reading);
    group.append(label);
    display();
    return display;
  });

  const actions = el("div", "", "midi-eq-actions");
  const bypassLabel = el("label");
  const bypass = el("input");
  bypass.type = "checkbox";
  bypass.checked = midiTone.bypass;
  bypass.addEventListener("change", () => {
    midiTone.bypass = bypass.checked;
    midiPlayback?.setTone(midiTone);
  });
  bypassLabel.append(bypass, " Bypass EQ");
  actions.append(bypassLabel, button("Reset EQ", () => {
    midiTone = { ...defaultMidiTone };
    for (const display of sliders) display();
    bypass.checked = midiTone.bypass;
    midiPlayback?.setTone(midiTone);
  }));
  group.append(actions);
  return group;
}

async function renderWaveControls(panel, path) {
  const revision = inspectorRevision;
  const controls = el("div", "", "audio-controls");
  const message = el("p");
  message.setAttribute("role", "status");
  const audio = el("audio");
  audio.hidden = true;
  const play = button("", () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    message.textContent = "";
    void audio.play().catch(error => {
      if (revision === inspectorRevision && error.name !== "AbortError") {
        message.textContent = "Unable to play WAV.";
      }
    });
  });
  const reset = button("", () => {
    audio.pause();
    audio.currentTime = 0;
    message.textContent = "";
  });
  const updatePlay = () => {
    const playing = !audio.paused && !audio.ended;
    setPlaybackIcon(play, playing ? "pause" : "play", playing ? "Pause WAV" : "Play WAV");
  };
  updatePlay();
  setPlaybackIcon(reset, "previous", "Reset WAV to beginning");
  play.disabled = true;
  reset.disabled = true;
  for (const event of ["play", "pause", "ended"]) audio.addEventListener(event, updatePlay);
  audio.addEventListener("error", () => {
    if (revision !== inspectorRevision) return;
    play.disabled = true;
    reset.disabled = true;
    message.textContent = "Unable to load WAV.";
  });
  stopWavePlayback = () => audio.pause();
  controls.append(play, reset);
  panel.append(controls, message, audio);
  try {
    const blob = await archive.file(path).async("blob");
    if (revision !== inspectorRevision) return;
    mediaUrl = URL.createObjectURL(new Blob([blob], { type: "audio/wav" }));
    audio.src = mediaUrl;
    play.disabled = false;
    reset.disabled = false;
  } catch {
    if (revision === inspectorRevision) message.textContent = "Unable to load WAV.";
  }
}

async function showMedia(panel, path, description) {
  const revision = inspectorRevision;
  try {
    const blob = await archive.file(path).async("blob");
    if (revision !== inspectorRevision) return;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = URL.createObjectURL(blob);
    const media = el("img", "", "artifact-image");
    media.src = mediaUrl;
    media.alt = description;
    if (panel.firstElementChild?.classList.contains("asset-format")) panel.firstElementChild.after(media);
    else panel.prepend(media);
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
  if (tileSelection) container.append(formatSpecLink("tst", "#tile-addressing"));
  container.append(renderConnectionMap(path, uses, outgoing, incoming.length - uses.length));
  renderEdges(container, title, uses, true);
  renderEdges(container, "References", outgoing, false);
  container.append(jsonPanel(() => artifactRecord(artifacts.get(path), references)));
}

const connectionTypes = {
  brd: "Board", prg: "Program", tem: "Character", ene: "Enemy", itm: "Item",
  tst: "Tileset", gph: "Tile", tan: "Animated tile", gam: "Main File",
};

function connectionTypeLabel(type) {
  if (type === "no-target") return "No target file";
  if (Object.hasOwn(connectionTypes, type)) return connectionTypes[type];
  return type === "file" ? "File" : type.toUpperCase();
}

function connectionBadge(path, tile, external) {
  const type = connectionType(path, tile, external, artifacts);
  const badge = el("span", connectionTypeLabel(type), "connection-badge");
  badge.dataset.type = type;
  return badge;
}

function countLabel(count, singular, plural = singular + "s") {
  return `${count} ${count === 1 ? singular : plural}`;
}

function evidenceLabel(edge) {
  return `${edge.evidence}${edge.line ? ` · line ${edge.line}` : ""} · ${edge.value}`;
}

function openConnection({ path, tile, line }) {
  selectArtifact(path, tile, line);
}

function renderConnectionMap(path, incoming, outgoing, otherIncoming) {
  const map = el("details", "", "reference connection-map");
  map.open = connectionMapOpen;
  map.addEventListener("toggle", () => {
    if (map.isConnected) connectionMapOpen = map.open;
  });
  const summary = el("summary", "Connection map", "connection-map-summary");
  const stats = el("span", "", "technical");
  summary.append(stats);
  const controls = el("div", "", "connection-filters");
  const neighborhood = el("div");
  const counts = el("p", "", "technical");
  counts.setAttribute("role", "status");
  const preview = el("div", "", "connection-preview");
  preview.setAttribute("aria-live", "polite");
  let active;

  const { types, statuses } = connectionFilterOptions(incoming, outgoing, artifacts);
  if (connectionFilters.type && !types.includes(connectionFilters.type)) types.push(connectionFilters.type);
  if (connectionFilters.resolution && !["resolved", "no-target"].includes(connectionFilters.resolution) &&
      !statuses.has(connectionFilters.resolution)) {
    const value = connectionFilters.resolution;
    statuses.set(value, value[0].toUpperCase() + value.slice(1));
  }
  const fields = {};
  function filterControl(key, title, options) {
    const label = el("label", title);
    const select = el("select");
    for (const [value, text] of options) {
      const option = el("option", text);
      option.value = value;
      select.append(option);
    }
    select.value = connectionFilters[key] ?? "";
    select.addEventListener("change", () => {
      connectionFilters[key] = select.value;
      renderNeighborhood();
    });
    fields[key] = select;
    label.append(select);
    controls.append(label);
  }
  filterControl("direction", "Direction", [["", "Both directions"], ["incoming", "Used by"], ["outgoing", "References"]]);
  filterControl("type", "Neighbor type", [["", "All types"], ...types
    .map(type => [type, connectionTypeLabel(type)]).sort((a, b) => a[1].localeCompare(b[1]))]);
  filterControl("resolution", "Resolution", [["", "All references"], ["resolved", "Resolved"],
    ["no-target", "Without a target"], ...[...statuses].sort((a, b) => a[1].localeCompare(b[1]))]);
  const clear = button("Clear filters", () => {
    connectionFilters = {};
    for (const select of Object.values(fields)) select.value = "";
    renderNeighborhood();
  });
  controls.append(clear);

  function lane(label, edges, reverse, counts) {
    const section = el("section", "", "connection-lane");
    const metrics = [countLabel(counts.files, "file"), countLabel(counts.references, "reference")];
    if (counts.placements) metrics.push(countLabel(counts.placements, "board placement"));
    if (counts.unresolved) metrics.push(`${counts.unresolved} without a target`);
    section.append(el("h4", label), el("p", metrics.join(" · "), "technical"));
    const neighbors = connectionNeighbors(edges, reverse);
    if (!neighbors.length) return section;
    const list = el("div", "", "connection-nodes");
    const batch = 6;
    let shown = 0;
    const more = button("", () => {
      const firstNew = shown;
      addNodes(batch);
      list.children[firstNew]?.focus();
    }, "connection-more");
    const fewer = button("Show fewer", () => {
      for (const node of [...list.children].slice(batch)) {
        if (node === active) {
          active = undefined;
          preview.remove();
        }
        node.remove();
      }
      shown = batch;
      updatePaging();
      more.focus();
    }, "connection-more");
    function updatePaging() {
      more.hidden = shown === neighbors.length;
      more.textContent = `Show more (${neighbors.length - shown} hidden)`;
      fewer.hidden = shown <= batch;
    }
    function addNodes(count) {
      for (const node of neighbors.slice(shown, shown + count)) {
        const first = referenceDestination(node.edges[0], reverse, artifacts);
        const destination = first && (node.edges.length === 1 ? first : { path: first.path, tile: first.tile });
        const name = node.path ? basename(node.path) : node.label || "Unspecified";
        const title = node.tile ? `${name} · Tile ${node.tile}` : name;
        const control = button("", () => {
          active?.setAttribute("aria-pressed", "false");
          active = control;
          control.setAttribute("aria-pressed", "true");
          preview.replaceChildren(el("h4", title), el("p", node.path ?? node.status, "technical"));
          if (destination) preview.append(button("Open in inspector", () => openConnection(destination)));
          const evidence = el("ul", "", "edge-list");
          for (const edge of node.edges) {
            const exact = referenceDestination(edge, reverse, artifacts);
            const label = evidenceLabel(edge) + (edge.tiles ? ` · ${countLabel(edge.tiles, "board placement")}` : "");
            const entry = el("li");
            entry.append(exact && node.edges.length > 1 ? button(label, () => openConnection(exact)) : el("span", label));
            evidence.append(entry);
          }
          preview.append(evidence);
          section.after(preview);
        }, "connection-node");
        control.setAttribute("aria-pressed", "false");
        control.title = node.label;
        const badge = node.path ? connectionBadge(node.path, node.tile, node.external) :
          el("span", node.status, "connection-badge");
        if (node.path && node.tile) {
          const thumbnail = tileCanvas();
          thumbnail.classList.add("connection-tile-thumbnail");
          paintTile(thumbnail, { to: node.path, tile: node.tile });
          const leading = el("span", "", "connection-node-leading");
          leading.append(thumbnail, badge);
          control.append(leading);
        } else {
          control.append(badge);
        }
        control.append(el("span", title, "connection-node-name"), el("span", String(node.edges.length), "connection-node-count"));
        if (destination) control.addEventListener("dblclick", () => openConnection(destination));
        list.append(control);
      }
      shown = Math.min(neighbors.length, shown + count);
      updatePaging();
    }
    addNodes(batch);
    section.append(list, more, fewer);
    return section;
  }

  const center = el("div", "", "connection-center");
  center.append(connectionBadge(path, tileSelection), el("strong", tileSelection ? `${basename(path)} · Tile ${tileSelection}` : basename(path)));
  const arrow = () => {
    const marker = el("div", "↓", "connection-arrow");
    marker.setAttribute("aria-hidden", "true");
    return marker;
  };
  function renderNeighborhood() {
    active = undefined;
    preview.remove();
    const uses = filterConnections(incoming, true, artifacts, connectionFilters);
    const refs = filterConnections(outgoing, false, artifacts, connectionFilters);
    const sources = connectionCounts(uses, true);
    const targets = connectionCounts(refs, false);
    const total = incoming.length + outgoing.length;
    const shown = uses.length + refs.length;
    const hidden = total - shown;
    const labels = [`${sources.files} in`, `${targets.files} out`];
    if (targets.unresolved) labels.push(`${targets.unresolved} without a target`);
    if (hidden) labels.push(`${hidden} filtered`);
    stats.textContent = labels.join(" · ");
    const filtering = Object.values(connectionFilters).some(Boolean);
    counts.textContent = filtering
      ? `Showing ${shown} of ${countLabel(total, "reference")}. ${countLabel(hidden, "reference")} hidden by filters.` : "";
    clear.disabled = !filtering;
    const sections = [center];
    if (connectionFilters.direction !== "outgoing") sections.unshift(lane("Used by", uses, true, sources), arrow());
    if (connectionFilters.direction !== "incoming") sections.push(arrow(), lane("References", refs, false, targets));
    if (!shown) sections.push(el("p", filtering ? "No references match these filters." : "No direct references in the indexed fields."));
    neighborhood.replaceChildren(...sections);
  }
  map.append(summary, el("p", "Select a direct neighbor to inspect its reference evidence."), controls, counts);
  if (otherIncoming) map.append(el("p", `${countLabel(otherIncoming, "reference")} to other tiles or the whole tileset hidden.`, "technical"));
  map.append(neighborhood);
  renderNeighborhood();
  return map;
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
      const destination = referenceDestination(edge, reverse, artifacts);
      const label = evidenceLabel(edge);
      const item = el("li");
      item.append(destination ? button(label, () => openConnection(destination)) :
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
  const target = line && byId(`line-${line}`);
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
  for (const role of rpgcodeRoles) {
    const row = el("div");
    row.append(el("strong", role.name), el("span", ` → ${role.relation} → `, "relation"), role.description);
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
    jumps.append(button(`Line ${line}`, () => selectArtifact(selected, undefined, line), "line-jump"));
  }
  reference.append(jumps);
}

async function loadArchive(name, readBytes) {
  const request = ++archiveRequest;
  status("archive-status", `Opening ${name}…`);
  byId("export-game-json").disabled = true;
  status("game-export-status", "");
  try {
    const [zip, commands] = await Promise.all([
      openGameArchive(await readBytes(), bytes => globalThis.JSZip.loadAsync(bytes)),
      catalog ? Promise.resolve(catalog) : fetch("./catalog.json").then(response => {
        if (!response.ok) throw new Error("Unable to load the command catalog.");
        return response.json();
      }),
    ]);
    if (request !== archiveRequest) return;
    const indexed = await readArtifacts(zip, commands);
    if (request !== archiveRequest) return;
    archive = zip;
    connectionFilters = {};
    archiveName = name;
    catalog = commands;
    artifacts = indexed.artifacts;
    folders = indexed.folders;
    paths = [...artifacts.keys()].sort();
    programs = paths.filter(path => artifacts.get(path).type === "prg");
    const mains = [...artifacts.values()].filter(artifact => artifact.type === "gam" && !artifact.error);
    archiveMainFile = mains.length === 1 ? { ...mains[0], filename: mains[0].path } : null;
    if (!uploadedMainFile) {
      status("main-status", archiveMainFile ? mainFileLabel(archiveMainFile) : "A Main File can identify the configured startup script.");
    }
    status("archive-status", `${name} · ${paths.length} files · ${programs.length} RPGCode programs`);
    selectDefault(true);
  } catch (error) {
    if (request === archiveRequest) status("archive-status", `Unable to open ${name}. ${error.message}`, true);
  } finally {
    if (request === archiveRequest) byId("export-game-json").disabled = !archive;
  }
}

function mainFileLabel(file) {
  const format = file.minor === 0 ? "Text" : "Binary";
  return `${file.filename} · ${format} format ${file.major}.${file.minor}`;
}

byId("export-game-json").addEventListener("click", () => {
  if (!archive) return;
  try {
    const graph = connectedGameRecord(artifacts, catalog, { archiveName, externalMain: uploadedMainFile });
    const json = new Blob([JSON.stringify(graph, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(json);
    const link = el("a");
    link.href = url;
    link.download = archiveName.replace(/\.zip$/i, "") + "-game.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    status("game-export-status", `Exported ${graph.archive.fileCount} archive files.`);
  } catch (error) {
    status("game-export-status", `Unable to export game JSON. ${error.message}`, true);
  }
});

byId("archive").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  archiveDownload?.abort();
  byId("archive-download").hidden = true;
  void loadArchive(file.name, () => file.arrayBuffer());
});

byId("archive-url-form").addEventListener("submit", event => {
  event.preventDefault();
  const download = byId("archive-download");
  let url;
  try {
    url = new URL(byId("archive-url").value.trim());
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch {
    archiveDownload?.abort();
    archiveRequest++;
    byId("export-game-json").disabled = !archive;
    status("archive-status", "Enter a public HTTPS URL for a game ZIP.", true);
    download.hidden = true;
    return;
  }
  archiveDownload?.abort();
  const controller = new AbortController();
  archiveDownload = controller;
  download.hidden = true;
  const name = basename(url.pathname) || "game ZIP";
  void loadArchive(name, async () => {
    try {
      const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal });
      if (!response.ok) throw new Error(`The server returned HTTP ${response.status}.`);
      return await response.arrayBuffer();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      download.href = url.href;
      download.hidden = false;
      if (error instanceof TypeError) {
        throw new Error("The browser could not read this URL. The host may block cross-origin downloads. Download the ZIP and open it locally.");
      }
      throw error;
    }
  });
});

byId("main-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const request = ++mainRequest;
  try {
    const result = readMainFile(new Uint8Array(await file.arrayBuffer()));
    if (request !== mainRequest) return;
    uploadedMainFile = { ...result, filename: file.name };
    status("main-status", mainFileLabel(uploadedMainFile));
  } catch (error) {
    if (request !== mainRequest) return;
    uploadedMainFile = null;
    status("main-status", `Unable to read ${file.name}. ${error.message}`, true);
  }
  selectDefault();
});
