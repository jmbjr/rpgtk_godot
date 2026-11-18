import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { initialMovementState, stepMovement } from "../experiments/movement-sandbox/engine.mjs";
import {
  describePlayableTargets, PLAYTEST_TALK_RADIUS,
} from "../experiments/movement-sandbox/playtest-guidance.mjs";
import {
  buildScriptFixtureZip, scriptFixtureSpecs,
} from "../docs/specs/fixtures/tk3-script-interaction-fixtures.mjs";

assert.equal(PLAYTEST_TALK_RADIUS, 46);
assert.deepEqual(describePlayableTargets(null, null).targets, []);
for (const spec of scriptFixtureSpecs) {
  // Reuse exactly the same native archive->artifact->reference->scene path
  // that is used by the live Play opening board button.
  const fixture = await buildScriptFixtureZip(spec);
  const zip = await openGameArchive(
    await fixture.generateAsync({ type: "uint8array" }),
    raw => JSZip.loadAsync(raw));
  const { artifacts } = await readArtifacts(zip, {});
  const graph = buildReferences(artifacts);
  const scene = buildPlayableScene(artifacts, graph);
  assert.equal(scene.ok, true, JSON.stringify(scene.issues));
  const actor = { ...initialMovementState(scene.world), layer: scene.start.layer };
  const start = describePlayableTargets(scene, actor);
  assert.equal(start.player.label, spec.characterName + " · YOU");
  assert.equal(start.player.labelLeft, false);
  assert.equal(start.player.labelAbove, false);
  assert.equal(start.player.xPct, actor.x / (scene.board.width * 32) * 100);
  assert.equal(start.player.yPct, actor.y / (scene.board.height * 32) * 100);
  assert.equal(start.targets.length, 1, "Only the source-resolved ITM/PRG is labeled");
  const target = start.targets[0];
  assert.equal(target.label, spec.itemName);
  assert.equal(target.labelLeft, true, "Right-edge label must anchor to the left");
  assert.equal(target.labelAbove, true, "Lower-edge label must anchor above");
  assert.equal(target.xPct, spec.position.x / (scene.board.width * 32) * 100);
  assert.equal(target.yPct, spec.position.y / (scene.board.height * 32) * 100);
  assert.equal(target.inRange, false, "Actor starts outside Talk range");
  assert.match(start.hint, new RegExp("Find " + spec.itemName + ":"));
  assert.match(start.hint, /right/);

  let walked = initialMovementState(scene.world);
  for (let i = 0; i < 100; ++i) {
    const result = describePlayableTargets(scene,
      { ...walked, layer: scene.start.layer });
    if (result.targets[0].inRange) break;
    walked = stepMovement(walked, {
      x: Math.sign(spec.position.x - walked.x),
      y: Math.sign(spec.position.y - walked.y),
    }, 1 / 60, scene.world);
  }
  const reached = describePlayableTargets(scene,
    { ...walked, layer: scene.start.layer });
  assert.equal(reached.targets[0].inRange, true);
  assert.match(reached.hint, /Within Talk range/);
  assert.match(reached.hint, /Use Talk/);

  const wrongLayer = describePlayableTargets(scene,
    { ...actor, layer: scene.start.layer + 1 });
  assert.equal(wrongLayer.targets.length, 0);
  const disabledItem = { ...scene, placements: scene.placements.map(p => ({
    ...p, itemStatus: "missing",
  })) };
  assert.equal(describePlayableTargets(disabledItem, actor).targets.length, 0,
    "The UI must not label unavailable ITMs as Talk targets");
  assert.equal(describePlayableTargets(scene,
    { x: NaN, y: 0, layer: 1 }).player, null);

  if (spec.secondBoard) {
    const destination = artifacts.get(spec.root + "/Boards/" + spec.secondBoard.board);
    assert.equal(destination.type, "brd");
    const second = buildPlayableScene(artifacts, graph,
      artifacts.get(scene.mainPath), {
        boardPath: destination.path, start: spec.secondBoard.spawn,
      });
    assert.equal(second.ok, true);
    const secondGuidance = describePlayableTargets(second, {
      ...initialMovementState(second.world), layer: second.start.layer,
    });
    assert.equal(secondGuidance.player.label, spec.characterName + " · YOU");
    assert.equal(secondGuidance.targets[0].label, spec.secondBoard.itemName);
    assert.equal(secondGuidance.targets[0].inRange, false);
    assert.match(secondGuidance.hint, new RegExp(spec.secondBoard.itemName));
  }
  console.log(spec.id + ": clearly labeled player + source Talk target; right/bottom label anchors and approach guidance passed.");
}

// UI presentation contract: these are DOM labels at CSS sizes, not
// canvas text scaled to 10× on tiny test maps.
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../experiments/movement-sandbox/authored-play.mjs", import.meta.url), "utf8");
const css = await readFile(new URL("../style.css", import.meta.url), "utf8");
for (const id of ["play-target-hint", "play-map-frame", "play-map-markers",
  "play-markers-enabled", "play-canvas", "play-collision", "play-talk"]) {
  assert.match(html, new RegExp('id="' + id + '"'));
}
assert.match(html, /id="play-markers-enabled" checked/);
assert.match(html, /<details class="play-diagnostics">/);
assert.match(js, /describePlayableTargets\(scene, actorAtLayer\(\)\)/);
assert.match(js, /markerLayer\.replaceChildren\(\)/);
assert.match(js, /updatePlaytestMarkers\(\)/);
assert.match(js, /markerLayer\.hidden = !markerToggle\.checked/);
assert.match(js, /drawImage\(animation\.frames\[frame\], origin\.x, origin\.y\)/,
  "Keep the original animation under the playtest marker");
assert.doesNotMatch(js, /ctx\.fillText\("TALK"/,
  "Never scale a source-pixel label to hundreds of CSS pixels");
assert.match(css, /\.play-map-frame--compact\s*\{\s*max-width:/);
assert.match(css, /\.play-map-marker__label/);
assert.match(css, /\.play-map-marker\.label-left/);
assert.match(css, /\.play-map-marker\.label-above/);
console.log("Script Lab playtest visibility: archive targets, marker placement, readable DOM overlay, and artwork preservation passed.");
