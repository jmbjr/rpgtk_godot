import { decodeTile, pencilRoute, readProject, submitTile, tileSize, workFit } from "./authoring-project.mjs";
import { standaloneTilePixels } from "./sprites.mjs";

export function mountTileAuthoring() {
  const byId = id => document.getElementById(id);
  const status = byId("tile-project-status");
  const filePicker = byId("tile-project-file");
  const launch = byId("open-tile-project");
  const profile = byId("tile-contributor");
  const filter = byId("tile-work-filter");
  const editor = byId("tile-editor");
  const pencil = byId("tile-pencil");
  const preview = byId("tile-actual");
  const color = byId("tile-color");
  const brief = byId("tile-brief");
  const tags = text => [...new Set(text.split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean))];
  let project, work, variant, basedOn, pixels, lastPoint, dirty = false, openRequest = 0;
  let x = 0, y = 0;

  function node(parent, tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
  }
  function button(parent, label, action) {
    const element = node(parent, "button", label);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }
  function download() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tile-project.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved tile edits?");
  }
  window.addEventListener("beforeunload", event => {
    if (dirty) event.preventDefault();
  });

  function renderWork() {
    const list = byId("tile-work");
    list.replaceChildren();
    let hidden = 0;
    for (const item of project.workItems) {
      const fit = workFit(item, project.contributor);
      if (filter.checked && fit !== "Suitable") {
        hidden++;
        continue;
      }
      const row = node(list, "li", "");
      button(row, `Open brief · ${item.title}`, () => {
        if (!canLeave()) return;
        work = item;
        dirty = false;
        editor.hidden = true;
        renderBrief();
        brief.querySelector("h3").focus();
      });
      node(row, "span", ` · ${fit} · Readiness: ${item.readiness}`);
    }
    byId("tile-work-summary").textContent = `${list.childElementCount} shown · ${hidden} hidden by contributor fit.`;
  }

  function renderBrief() {
    const need = project.assetRequirements.find(entry =>
      entry.id === work.requirement.id && entry.revision === work.requirement.revision);
    const goal = project.projectRequirements.find(entry => entry.id === need.projectRequirementId);
    brief.replaceChildren();
    node(brief, "h3", work.title).tabIndex = -1;
    node(brief, "p", `${project.id} / ${goal.id} ${goal.title} → ${need.id} r${need.revision} ${need.title} → ${work.id}`);
    node(brief, "p", `${work.brief} · Readiness: ${work.readiness}`);
    node(brief, "p", `Requirement constraints: ${need.constraints}`);
    node(brief, "p", `Requirement acceptance: ${need.acceptance}`);
    node(brief, "p", `Work acceptance: ${work.acceptance}`);
    for (const route of work.routes) {
      node(brief, "p", `${route.label} (${route.id}) · ${route.id === pencilRoute ? "Web pencil available" : "Web support unverified"} · Skills: ${route.skills.join(", ") || "none specified"} · Tools: ${route.tools.join(", ") || "none specified"}`);
    }
    if (work.routes.some(route => route.id === pencilRoute)) {
      button(brief, "Draw a new tile", () => openEditor());
    }
    for (const candidate of project.variants.filter(entry => entry.workItemId === work.id)) {
      node(brief, "h4", `${candidate.title} · ${candidate.id}`);
      const history = node(brief, "ol", "");
      candidate.revisions.forEach((revision, index) => {
        const row = node(history, "li",
          `Proposed · ${revision.contributor.name} (${revision.contributor.id}) · ${revision.id} · ${candidate.routeId} `);
        button(row, `Open ${candidate.title} revision ${index + 1}`, () => openEditor(candidate, revision));
      });
    }
    brief.hidden = false;
  }

  function openEditor(candidate, revision) {
    if (!canLeave()) return;
    variant = candidate;
    basedOn = revision?.id;
    lastPoint = undefined;
    pixels = revision ? decodeTile(revision.gph).pixels : Array(tileSize ** 2).fill(0);
    editor.elements.title.value = candidate?.title ?? "";
    editor.elements.title.readOnly = Boolean(candidate);
    byId("tile-editor-title").textContent = revision
      ? `Edit ${candidate.title} · based on revision ${revision.id}`
      : `Draw tile · ${work.title}`;
    dirty = false;
    x = y = 0;
    editor.hidden = false;
    draw();
    pencil.focus();
  }

  function draw() {
    const image = new ImageData(standaloneTilePixels({ width: tileSize, height: tileSize, pixels }), tileSize, tileSize);
    for (const canvas of [pencil, preview]) canvas.getContext("2d").putImageData(image, 0, 0);
    const context = pencil.getContext("2d");
    context.lineWidth = 0.2;
    context.strokeStyle = "white";
    context.strokeRect(x + .1, y + .1, .8, .8);
    byId("tile-cursor").textContent = `Pixel (${x}, ${y})`;
  }

  function paint(nextX, nextY) {
    const [red, green, blue] = color.value.slice(1).match(/../g).map(pair => parseInt(pair, 16));
    const packed = red | green << 8 | blue << 16;
    const [startX, startY] = lastPoint ?? [nextX, nextY];
    const steps = Math.max(1, Math.abs(nextX - startX), Math.abs(nextY - startY));
    for (let step = 0; step <= steps; step++) {
      const column = Math.round(startX + (nextX - startX) * step / steps);
      const row = Math.round(startY + (nextY - startY) * step / steps);
      pixels[column * tileSize + row] = packed;
    }
    x = nextX;
    y = nextY;
    dirty = true;
    draw();
  }

  const clamp = position => Math.max(0, Math.min(tileSize - 1, position));
  function paintPointer(event) {
    const box = pencil.getBoundingClientRect();
    paint(clamp(Math.floor((event.clientX - box.left) * tileSize / box.width)),
      clamp(Math.floor((event.clientY - box.top) * tileSize / box.height)));
    lastPoint = [x, y];
  }
  pencil.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pencil.setPointerCapture(event.pointerId);
    paintPointer(event);
  });
  pencil.addEventListener("pointermove", event => {
    if (pencil.hasPointerCapture(event.pointerId)) paintPointer(event);
  });
  pencil.addEventListener("lostpointercapture", () => { lastPoint = undefined; });
  pencil.addEventListener("keydown", event => {
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (event.key === " ") {
      event.preventDefault();
      paint(x, y);
    } else if (movement) {
      event.preventDefault();
      x = clamp(x + movement[0]);
      y = clamp(y + movement[1]);
      draw();
    }
  });

  filePicker.addEventListener("change", async event => {
    const request = ++openRequest;
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const next = readProject(JSON.parse(await file.text()));
      if (request !== openRequest || !canLeave()) return;
      project = next;
      dirty = false;
      editor.hidden = brief.hidden = true;
      byId("tile-project-title").textContent = `${project.title} · ${project.id}`;
      const contributor = project.contributor;
      profile.elements.id.value = contributor?.id ?? "";
      profile.elements.name.value = contributor?.name ?? "";
      profile.elements.skills.value = contributor?.skills.join(", ") ?? "";
      profile.elements.tools.value = contributor?.tools.join(", ") ?? "";
      filter.checked = Boolean(contributor);
      byId("tile-project").hidden = false;
      renderWork();
      status.textContent = `Opened ${file.name}.`;
      byId("tile-project-title").focus();
    } catch (error) {
      if (request === openRequest) status.textContent = `Could not open project. ${error.message}`;
    }
  });

  launch.addEventListener("click", () => filePicker.click());
  launch.disabled = filePicker.disabled = false;
  status.textContent = "Choose a project manifest to begin.";

  profile.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(profile);
    const id = form.get("id").trim();
    const name = form.get("name").trim();
    if (!id || !name) {
      status.textContent = "Enter a contributor ID and display name.";
      return;
    }
    project.contributor = { id, name, skills: tags(form.get("skills")), tools: tags(form.get("tools")) };
    renderWork();
    status.textContent = `Using contributor ${name}.`;
  });
  filter.addEventListener("change", renderWork);
  byId("tile-project-download").addEventListener("click", download);
  editor.addEventListener("input", () => { dirty = true; });
  editor.addEventListener("submit", event => {
    event.preventDefault();
    try {
      const result = submitTile(project, {
        work, variant, basedOn, title: editor.elements.title.value.trim(), pixels,
        contributor: project.contributor, createId: () => crypto.randomUUID(),
      });
      project = result.project;
      openSaved(result.candidate);
      download();
      status.textContent = `Saved ${variant.title}, proposed revision ${variant.revisions.length}. Keep the downloaded project to reopen it.`;
    } catch (error) {
      status.textContent = error.message;
    }
  });

  function openSaved(candidate) {
    dirty = false;
    renderBrief();
    openEditor(candidate, candidate.revisions.at(-1));
  }
}
