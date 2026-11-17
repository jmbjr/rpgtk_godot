import { assessBstwTitle, requestBstwNewSession } from "./bstw-title.mjs";
import { initialInnState, activateInn, advanceInn, currentInnMessage,
  conversationMessages } from "./experiments/movement-sandbox/inn-dialogue.mjs";
import { readLegacyDialogueDefinitions, compileLegacyDialogue, initialLegacyDialogueState,
  openLegacyDialogue, advanceLegacyDialogue, currentLegacyDialogue, compileBstwEnding } from "./tk3-source-dialogue.mjs";
import { compileTk3SourceMenu, openTk3SourceMenu, selectTk3SourceMenu,
  confirmTk3MenuProfile, cancelTk3SourceMenu } from "./tk3-source-menu.mjs";
import { findAuthoredInn } from "./experiments/movement-sandbox/imported-inn.mjs";
import { listTk3RuntimeKeys } from "./tk3-runtime-keys.mjs";

const stylesheet = '<link rel="stylesheet" href="./bstw-compatibility.css">';
const titleMarkup = `
<section id="bstw-title-stage" class="panel bstw-title-panel" aria-labelledby="bstw-title-heading" hidden tabindex="-1">
        <div class="sandbox-panel-heading">
          <h2 id="bstw-title-heading">Bruce Saves the World! · Title</h2>
          <button type="button" id="bstw-title-back">Back to Game Explorer</button>
        </div>
        <p class="technical">A source-backed snapshot of BSTW's original title slideshow, not a running RPGCode menu. Only New is implemented.</p>
        <div class="bstw-title-image-frame">
          <img id="bstw-title-image" alt="Original BSTW title slideshow image from the uploaded ZIP" width="640" height="480" hidden>
          <p id="bstw-title-fallback" class="bstw-title-fallback">Bruce Saves the World! The authored title artwork could not be displayed.</p>
        </div>
        <p id="bstw-title-art-status" class="technical" role="status">Artwork status will appear here.</p>
        <div class="bstw-title-actions">
          <button type="button" id="bstw-title-new" disabled>New</button>
        </div>
        <p id="bstw-title-status" class="technical" role="status">The New action opens a fresh supported board session.</p>
      </section>`;
const playerMarkup = `
  <div class="sandbox-hud" id="play-hud" role="status"></div>
  <p id="play-inn" class="play-inn-label" hidden></p>
  <section class="sandbox-dialogue" id="bstw-dialogue" hidden aria-labelledby="bstw-speaker">
    <div class="sandbox-dialogue-heading">
      <strong id="bstw-speaker"></strong>
      <span id="bstw-progress" class="technical"></span>
    </div>
    <p id="bstw-message"></p>
  </section>
<section id="play-source-menu" class="play-source-menu" hidden aria-labelledby="play-source-menu-heading">
          <h3 id="play-source-menu-heading">Archive RPGCode menu</h3>
          <p class="technical">Source-defined choices and first-time clue effects. Graphical CCmap screens, equipment changes, saving and plugins are not executed.</p>
          <p id="play-source-menu-note" role="status" aria-live="polite">Select a source menu item.</p>
          <div id="play-source-menu-actions" class="play-menu-actions" role="group" aria-label="Source-defined menu choices"></div>
          <div id="play-source-menu-profiles" class="play-menu-actions" role="group" aria-label="Source-defined player selection" hidden></div>
          <button type="button" id="play-source-menu-close">Back / Close menu</button>
        </section>
  <section id="bstw-ending" class="play-source-menu" hidden tabindex="-1" aria-labelledby="bstw-ending-heading">
    <h3 id="bstw-ending-heading">Demo complete</h3>
    <p id="bstw-ending-source" class="technical"></p>
    <button type="button" id="bstw-ending-close">Back to Game Explorer</button>
  </section>`;

// Audited opening-board placement provenance in #92.
const placements = [
  ["lami.itm", "mwinlami.prg", "item"],
  ["rusty.itm", "mwinrusty.prg", "item"],
  ["jim.itm", "mwinjim.prg", "item"],
  ["door.itm", "mwininn.prg", "board"],
  ["door.itm", "mwinuglyhouse.prg", "board"],
  ["door.itm", "mwinsmallhouse.prg", "board"],
  ["loyalis.itm", "mwinstartboardload.prg", "item"],
];
const lower = value => value?.toLowerCase();
const equals = (actual, expected) => lower(actual) === lower(expected);

export function prepareBstwCompatibility({ archive, context }) {
  const { artifacts, main, scene } = context ?? {};
  if (!artifacts) return { ok: false, detail: "A unique archive project is required." };
  const title = assessBstwTitle(artifacts, main, scene);
  if (!title.ok) return { ok: false, detail: title.detail };
  const root = scene.projectRoot ?? "";
  const definitions = readLegacyDialogueDefinitions(artifacts, scene);
  const sourcePlans = new Map();
  const innPath = root + "Prg/mwininn.prg";
  const eligibleInn = findAuthoredInn(scene, innPath);
  let innPlacement;
  if (title.newEnabled) for (const placement of scene.placements) {
    const spec = placements[placement.slot];
    if (!spec || placement.itemStatus !== "resolved" ||
        placement.positionStatus !== "valid" || placement.programStatus !== "resolved") continue;
    const [item, program, provenance] = spec;
    if (!equals(placement.itemPath, root + "Item/" + item) ||
        !equals(placement.programPath, root + "Prg/" + program) ||
        placement.programSource !== provenance) continue;
    if (placement.slot === 3) {
      if (placement !== eligibleInn) continue;
      innPlacement = placement;
    }
    if (definitions.supported) {
      const plan = compileLegacyDialogue(artifacts.get(placement.programPath), artifacts, definitions, scene);
      if (plan.ok) sourcePlans.set(placement.slot, plan);
    }
  }
  const actions = listTk3RuntimeKeys(scene, artifacts);
  const menuAction = actions.find(action =>
    action.status === "resolved" && equals(action.path, root + "Prg/menuMain.prg"));
  const candidate = menuAction && compileTk3SourceMenu(artifacts, scene, menuAction, definitions);
  const menu = candidate?.ok && equals(candidate.path, root + "Prg/menus.prg") &&
    equals(candidate.method, "MainMenu") ? candidate : null;

  const endingActions = actions.filter(action => action.label === "Q" &&
    action.status === "resolved" && equals(action.path, root + "Prg/ENDDEMO.prg"));
  const ending = endingActions.length === 1 ? {
    action: endingActions[0],
    plan: compileBstwEnding(artifacts.get(endingActions[0].path), artifacts),
  } : null;

  return {
    ok: true,
    mountTitle: callbacks => mountTitle(archive, title, scene, callbacks),
    createSession: () => createSession(scene, definitions, sourcePlans, innPlacement, menu, menuAction, ending),
  };
}

function mountTitle(archive, title, scene, { onBack, onNew }) {
  const host = document.createElement("div");
  host.innerHTML = stylesheet + titleMarkup;
  const panel = host.querySelector("#bstw-title-stage");
  const image = panel.querySelector("#bstw-title-image");
  const fallback = panel.querySelector("#bstw-title-fallback");
  const artStatus = panel.querySelector("#bstw-title-art-status");
  const titleStatus = panel.querySelector("#bstw-title-status");
  const newButton = panel.querySelector("#bstw-title-new");
  const art = title.titleArt;
  let disposed = false;
  let url;
  panel.hidden = false;
  newButton.disabled = !title.newEnabled;
  titleStatus.textContent = title.newReason;
  artStatus.textContent = "Title artwork " + (art.filename ?? "(unset)") + " · " + art.status +
    ". New artwork " + (title.newArt.filename ?? "(unset)") + " · " + title.newArt.status + ".";
  panel.querySelector("#bstw-title-back").addEventListener("click", onBack);
  newButton.addEventListener("click", () => {
    const action = requestBstwNewSession(title, scene);
    if (action.ok) onNew();
    else titleStatus.textContent = action.reason;
  });
  const entry = art.status === "resolved" && archive.file(art.path);
  if (entry) void entry.async("uint8array").then(bytes => {
    if (disposed) return;
    const mime = /\.png$/i.test(art.path) ? "image/png" :
      /\.gif$/i.test(art.path) ? "image/gif" : "image/jpeg";
    url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    image.onload = () => { image.hidden = false; fallback.hidden = true; };
    image.onerror = () => { artStatus.textContent = "Title artwork could not be displayed."; };
    image.src = url;
  }).catch(() => {
    if (!disposed) artStatus.textContent = "Title artwork could not be read.";
  });
  return { host, panel, destroy() {
    disposed = true;
    if (url) URL.revokeObjectURL(url);
    host.remove();
  } };
}

function createSession(opening, definitions, sourcePlans, innPlacement, menu, menuAction, ending) {
  const projected = Boolean(sourcePlans.size || menu);
  const initial = projected ? initialLegacyDialogueState(definitions) : null;
  const initialVariables = { ...initial?.variables,
    ...(ending?.plan.ok ? { [ending.plan.flag]: 0 } : {}) };
  let legacy = initial && { ...initial, variables: undefined };
  let inn = innPlacement && initialInnState();
  let feedback = "";
  let endingPage = null;
  let completed = false;
  return {
    initialVariables,
    mount({ section, scene, readVariables, writeVariables, refresh, signal }) {
      const host = document.createElement("div");
      host.innerHTML = stylesheet + playerMarkup;
      section.querySelector("#play-runtime-actions").after(host);
      const get = id => host.querySelector("#" + id);
      const menuPanel = get("play-source-menu");
      const choices = get("play-source-menu-actions");
      const profiles = get("play-source-menu-profiles");
      const close = get("play-source-menu-close");
      const canonical = scene.mainPath === opening.mainPath && scene.boardPath === opening.boardPath;
      const current = () => endingPage !== null ? ending.plan.pages[endingPage] :
        currentLegacyDialogue(legacy) ?? (inn && currentInnMessage(inn));
      const isInn = target => canonical && innPlacement && target?.slot === innPlacement.slot;
      let menuSignature;
      const snapshot = () => ({ ...legacy, variables: readVariables() });

      function apply(result) {
        const { variables, ...ruleState } = result.state;
        const before = readVariables();
        const patch = Object.fromEntries(Object.entries(variables).filter(([key, value]) =>
          !Object.is(before[key], value)));
        legacy = ruleState;
        if (Object.keys(patch).length) writeVariables(patch);
      }
      function updateMenu(action) {
        apply(action(snapshot()));
        refresh();
      }
      function dismiss() {
        if (!legacy?.menu) return false;
        updateMenu(cancelTk3SourceMenu);
        return true;
      }
      close.addEventListener("click", dismiss, { signal });
      const completion = get("bstw-ending");
      get("bstw-ending-close").addEventListener("click", () => {
        section.querySelector("#play-close").click();
      }, { signal });

      function renderMenu() {
        const state = legacy?.menu;
        menuPanel.hidden = !state;
        if (!state) { menuSignature = null; return; }
        const checked = readVariables().checked;
        const signature = JSON.stringify([state, checked]);
        if (signature === menuSignature) return;
        menuSignature = signature;
        const profile = state.phase === "profile";
        get("play-source-menu-note").textContent = state.message ||
          (profile ? "Choose a party member." : "Choose an option. First visits yield one clue.");
        close.textContent = profile ? "Back to menu" : "Close menu";
        choices.hidden = profile;
        profiles.hidden = !profile;
        const buttons = (records, label, select) => records.map(record => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "play-source-choice";
          button.textContent = label(record);
          button.addEventListener("click", () => updateMenu(state => select(state, menu, record.index)), { signal });
          return button;
        });
        if (profile) profiles.replaceChildren(...buttons(menu.profiles, p => p.name, confirmTk3MenuProfile));
        else choices.replaceChildren(...buttons(menu.choices, c => c.label +
          (checked?.[c.eventIndex] ? " · already visited" : " · clue available") +
          (c.needsProfile ? " · choose player" : ""), selectTk3SourceMenu));
      }

      return {
        get busy() { return Boolean(completed || current() || legacy?.menu); },
        get menuOpen() { return Boolean(legacy?.menu); },
        get canAdvance() { return Boolean(current()); },
        get feedback() { return feedback; },
        label: target => isInn(target) ? "INN DOOR" : undefined,
        dismiss,
        runtime(action) {
          if (ending && action.slot === ending.action.slot && action.path === ending.action.path) {
            if (!ending.plan.ok) feedback = ending.plan.diagnostic.text;
            else if (readVariables()[ending.plan.flag] !== 1)
              feedback = "The ending is locked. Continue finding clues.";
            else {
              endingPage = 0;
              feedback = "";
            }
            return true;
          }
          if (!menu || action.slot !== menuAction.slot || action.path !== menuAction.path) return false;
          apply(openTk3SourceMenu(snapshot(), menu));
          feedback = "";
          return true;
        },
        talk(target, actor, now) {
          if (endingPage !== null) {
            if (endingPage + 1 < ending.plan.pages.length) endingPage++;
            else {
              endingPage = null;
              completed = true;
            }
            return true;
          }
          const plan = canonical && target && sourcePlans.get(target.slot);
          if (legacy?.dialogue || plan) {
            const result = legacy.dialogue ?
              advanceLegacyDialogue(snapshot(), now) : openLegacyDialogue(snapshot(), plan, now);
            apply(result);
            feedback = result.status === "cooldown" ? "Wait " + result.remainingMs + " ms to talk again." :
              result.status === "already-visited" ? "This one-time interaction is complete." : "";
            return true;
          }
          if (!inn?.conversation && !isInn(target)) return false;
          const result = inn.conversation ? advanceInn(inn, now) :
            activateInn(inn, actor, now, { landmark: target.position });
          inn = result.state;
          feedback = result.outcome === "cooldown" ?
            "Wait " + result.remainingMs + " ms to talk again." : "";
          if (result.outcome === "completed" && projected) {
            const vars = readVariables();
            const index = definitions.constants.einn;
            const patch = {};
            if (Number.isInteger(index) && index >= 0 && Array.isArray(vars.checked) && index < vars.checked.length) {
              patch.checked = [...vars.checked];
              patch.checked[index] = (patch.checked[index] ?? 0) + 1;
            }
            if (result.clueGained) {
              patch.clues = (Number(vars.clues) || 0) + 1;
              patch.remainingclues = vars.maxclues - patch.clues;
              if (!patch.remainingclues && menu?.awardFlag) patch[menu.awardFlag] = 1;
            }
            if (Object.keys(patch).length) writeVariables(patch);
          }
          return true;
        },
        render(target, blocked) {
          const vars = readVariables();
          const found = projected ? vars.clues : inn?.clues;
          const total = projected ? vars.maxclues : inn?.maxClues;
          const index = sourcePlans.get(innPlacement?.slot)?.eventIndex;
          const visits = index == null ? inn?.checkedInn : vars.checked?.[index];
          const hud = get("play-hud");
          hud.hidden = !projected && !inn;
          hud.textContent = hud.hidden ? "" : "Clues: " + found + " / " + total +
            (canonical && innPlacement ? " · Inn visits: " + (visits ?? 0) : "");
          const innLabel = get("play-inn");
          innLabel.hidden = !isInn(target);
          innLabel.textContent = innLabel.hidden ? "" : "Locked inn · Talk to interact";
          const line = current();
          const clue = legacy?.clueMessage || inn?.clueMessage;
          const panel = get("bstw-dialogue");
          panel.hidden = Boolean(completed || blocked || legacy?.menu || !(line || clue));
          if (!panel.hidden) {
            get("bstw-speaker").textContent = line?.speaker ?? "Clue discovered";
            get("bstw-message").textContent = line?.text ?? clue;
            get("bstw-progress").textContent = endingPage !== null ?
              line.path + ":" + line.line + " · " + (endingPage + 1) + " / " + ending.plan.pages.length :
              legacy?.dialogue ?
              (legacy.dialogue.index + 1) + " / " + legacy.dialogue.lines.length :
              inn?.conversation ? (inn.conversation.index + 1) + " / " +
                conversationMessages(inn.conversation).length :
                found + " / " + total + " clues found";
          }
          if (completed && completion.hidden) {
            completion.hidden = false;
            get("bstw-ending-source").textContent = ending.plan.path + ":" +
              ending.plan.exitLine + " · windows() ends this browser playthrough.";
            completion.focus({ preventScroll: true });
          }
          renderMenu();
        },
      };
    },
  };
}
