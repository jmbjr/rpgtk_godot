import { resolveAsset } from "./model.mjs";
import { compileTk3Interaction, finishTk3Fight, abandonTk3Fight }
  from "./tk3-script-slice.mjs";

// Toolkit 3.1 calls a configurable combat plugin for fightEnemy().
// This module resolves only the source contract: ENE, BKG and the
// ENE-authored victory PRG. The browser does NOT implement or emulate
// tk3fight.dll's native combat algorithm or automatic rewards.
// An explicitly labelled "simulate victory" user action resumes the
// source PRG after compiling the enemy's actual victory program.
const issue = (path, line, message) =>
  ({ path, line, message, text: path + ":" + line + ": " + message });
const valid = (file, type) =>
  file?.type === type && file.decodeStatus === "decoded" && !file.error;

function failed(response, message) {
  const path = response.encounter.path, line = response.encounter.line;
  const diagnostic = issue(path, line, message);
  return { status: "error", diagnostic,
    state: { ...response.state, execution: null, pendingFight: null,
      scriptStack: [], diagnostic, message: "" } };
}

export function resolveTk3FightRequest(response, artifacts) {
  if (response?.status !== "fight" || !response.encounter ||
      !response.state?.pendingFight)
    return { status: "inactive", state: response?.state };
  const requested = response.encounter;
  const root = requested.path.match(/^(.*\/)Prg\/[^/]+\.prg$/i)?.[1] ?? null;
  const names = [...artifacts.keys()];
  if (!root) return failed(response, "Fight source has no identifiable archive root.");
  for (const [key, value] of [["enemy", requested.enemy],
    ["background", requested.background]]) {
    if (typeof value !== "string" || !/^[^\\/:"*?<>|]+\.[A-Za-z0-9]+$/i.test(value))
      return failed(response, "Invalid fight " + key + " filename.");
  }
  const enemyRef = resolveAsset(names, "Enemy", requested.enemy, root);
  if (enemyRef.status !== "resolved")
    return failed(response, "Enemy " + requested.enemy + " is " + enemyRef.status + ".");
  const bkgRef = resolveAsset(names, "Bkrounds", requested.background, root);
  if (bkgRef.status !== "resolved")
    return failed(response, "Battle background " + requested.background +
      " is " + bkgRef.status + ".");
  const enemy = artifacts.get(enemyRef.path);
  const background = artifacts.get(bkgRef.path);
  if (!valid(enemy, "ene") || !valid(background, "bkg"))
    return failed(response, "Referenced ENE or BKG could not be decoded.");
  if (!Number.isFinite(enemy.stats?.HP) || enemy.stats.HP <= 0)
    return failed(response, "Enemy HP is not a supported positive value.");
  let victory = null;
  const victoryName = enemy.programs?.["Victory program"];
  if (victoryName) {
    const ref = resolveAsset(names, "Prg", victoryName, root);
    if (ref.status !== "resolved")
      return failed(response, "Enemy victory program " + victoryName +
        " is " + ref.status + ".");
    const asset = artifacts.get(ref.path);
    if (!valid(asset, "prg") || !Array.isArray(asset.program?.rows))
      return failed(response, "Enemy victory program " + ref.path +
        " has no decoded source.");
    const source = asset.program.rows.map(row => row.line).join("\n");
    const compiled = compileTk3Interaction(source, asset.path);
    if (!compiled.ok) return failed(response,
      "Enemy victory program contains unsupported syntax at " +
        compiled.diagnostic.text);
    victory = { path: ref.path, instructions: compiled.instructions };
  }
  return { status: "ready", state: response.state,
    encounter: {
      path: requested.path, line: requested.line,
      enemyPath: enemyRef.path, backgroundPath: bkgRef.path,
      name: enemy.name, hp: enemy.stats.HP,
      fightPower: enemy.stats.Fight, defense: enemy.stats.Defense,
      victoryProgram: victory,
      xp: enemy.xp, gold: enemy.gold,
    } };
}

export function simulateTk3FightVictory(state, encounter) {
  if (!encounter || !state?.pendingFight)
    return { status: "inactive", state };
  return finishTk3Fight(state, encounter.victoryProgram);
}

export function cancelTk3FightTest(state) {
  return abandonTk3Fight(state);
}
