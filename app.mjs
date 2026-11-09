import { decodeProgram, indexProgram, readMainFile, resolveAsset } from "./model.mjs";

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
let programRequest = 0;
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
  renderBindings(startup);
  renderPrograms();
  showProgram();
}

function renderBindings(startup = mainFile && resolveAsset(programs, "Prg", mainFile.startup)) {
  const bindings = byId("bindings");
  bindings.hidden = !mainFile;
  bindings.replaceChildren();
  if (!mainFile) return;
  const root = startup.path ? startup.path.slice(0, startup.path.toLowerCase().lastIndexOf("prg/")) : null;
  const facts = [
    ["Game title", mainFile.title],
    ["Configured startup", bindingValue(mainFile.startup, startup)],
    ["Opening board", bindingValue(mainFile.board, resolveAsset(paths, "Boards", mainFile.board, root))],
    ["Initial character", bindingValue(mainFile.character, resolveAsset(paths, "Chrs", mainFile.character, root))],
  ];
  for (const [label, value] of facts) {
    const fact = el("div");
    fact.append(el("dt", label), el("dd", value, "technical"));
    bindings.append(fact);
  }
}

function bindingValue(name, result) {
  if (result.path) return result.path;
  if (result.status === "unset") return "Unspecified";
  const label = !archive ? "awaiting ZIP" : result.status === "ambiguous" ? "ambiguous in ZIP" : "missing from ZIP";
  return `${name} · ${label}`;
}

function renderPrograms() {
  byId("workspace").hidden = !archive;
  byId("file-count").textContent = String(programs.length);
  byId("file-list").replaceChildren(...programs.map(path => {
    const node = button(path, () => {
      selected = path;
      for (const item of byId("file-list").children) item.setAttribute("aria-pressed", String(item === node));
      showProgram();
    });
    node.setAttribute("aria-pressed", String(path === selected));
    return node;
  }));
}

function selectionLabel(path) {
  if (!path) return "";
  if (mainFile && resolveAsset(programs, "Prg", mainFile.startup).path === path) return "Configured startup";
  if (!mainFile && path === demoStartup) return "Demo default";
  return "Selected program";
}

async function showProgram() {
  const request = ++programRequest;
  const path = selected;
  const source = byId("source");
  byId("source-path").textContent = path ?? "";
  byId("selection").textContent = selectionLabel(path);
  byId("graph").replaceChildren();
  byId("reference").replaceChildren();
  byId("counts").textContent = "";
  source.replaceChildren(el("p", path ? "Reading program…" : programs.length ? "Choose a program from the list." : "No RPGCode programs were found."));
  if (!path) return;
  try {
    const bytes = await archive.file(path).async("uint8array");
    if (request !== programRequest) return;
    const result = indexProgram(decodeProgram(bytes), catalog);
    renderSource(result);
    renderGraph(result);
  } catch (error) {
    if (request === programRequest) source.replaceChildren(el("p", `Unable to read this program. ${error.message}`));
  }
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
    jumps.append(button(`Line ${line}`, () => {
      byId("source").querySelector(".active-line")?.classList.remove("active-line");
      const target = byId(`line-${line}`);
      target.classList.add("active-line");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }, "line-jump"));
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
    archive = zip;
    catalog = commands;
    paths = Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort();
    programs = paths.filter(path => /\.prg$/i.test(path));
    status("archive-status", `${file.name} · ${programs.length} RPGCode programs`);
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
    mainFile = result;
    status("main-status", `${file.name} · Binary format ${result.major}.${result.minor}`);
  } catch (error) {
    if (request !== mainRequest) return;
    mainFile = null;
    status("main-status", `Unable to read ${file.name}. ${error.message}`, true);
  }
  selectDefault();
});
