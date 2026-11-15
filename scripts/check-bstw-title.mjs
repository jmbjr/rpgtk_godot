import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "../vendor/jszip.min.js";
import { openGameArchive } from "../archive.mjs";
import { readArtifacts, buildReferences } from "../artifacts.mjs";
import { buildPlayableScene } from "../playable-scene.mjs";
import { assessBstwTitle, requestBstwNewSession } from "../bstw-title.mjs";
import { initialInnState, activateInn, advanceInn } from
  "../experiments/movement-sandbox/inn-dialogue.mjs";
import { nativeMainFixture } from
  "../docs/specs/fixtures/native-main-29-fixtures.mjs";
import { board24Fixtures } from "../docs/specs/fixtures/board-24-fixtures.mjs";
import { character28, nativeAnims, testTileset } from
  "../docs/specs/fixtures/native-character-28-fixtures.mjs";

const source = [
  "// Only synthetic title source; no third-party RPGCode copied.",
  "titleCmap->setGraphic(win0,0,0, \"tNew.png\")",
  "titleCmap->setGraphic(win0,0,0, \"tNew_roll.png\",1)",
  "iTitle[3] = \"BSTW.png?\" + castlit(delayVal*.8)",
  "Slideshow(iTitle,640,480,0,0)",
  "switch (index)",
  "{",
  "  case 0:",
  "  {",
  "    _party[0] = \"Bruce\"",
  "    setPlayer(0,\"Bruce\",\"Hero\",150,150,100)",
  "    _party[1] = \"Loyalis\"",
  "    setPlayer(1,\"Loyalis\",\"Knight\",100,100,75)",
  "    initCmaps()",
  "    end()",
  "  }",
  "  case 1:",
  "  {",
  "    // Unsupported Load action remains unimplemented.",
  "  }",
  "}",
].join("\n");
const synthetic = new JSZip();
synthetic.file("BSTW.gam", nativeMainFixture);
synthetic.file("BSTW/Prg/menuTitle.prg", source);
synthetic.file("BSTW/Boards/start.brd", board24Fixtures.standard);
synthetic.file("BSTW/Chrs/bruce.tem", character28);
synthetic.file("BSTW/Tiles/test-characters.tst", testTileset);
synthetic.file("BSTW/Tiles/two-tiles.tst",
  await readFile(new URL("../docs/specs/fixtures/two-tiles.tst", import.meta.url)));
for (const [name, bytes] of nativeAnims)
  synthetic.file("BSTW/Misc/" + name, bytes);
// The metadata reader deliberately treats PNGs as media rather than
// trying to interpret their pixels as native Toolkit graphics.
const pixel = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64"));
synthetic.file("BSTW/Bitmap/BSTW.png", pixel);
synthetic.file("BSTW/Bitmap/tNew.png", pixel);
synthetic.file("BSTW/Bitmap/tNew_roll.png", pixel);
const { artifacts: decoded } = await readArtifacts(synthetic, {});
// The native GAM fixture intentionally uses a different synthetic game
// title. Make a derived synthetic BSTW main for recognition tests.
const originalMain = decoded.get("BSTW.gam");
const artifacts = new Map(decoded);
artifacts.set("BSTW.gam", { ...originalMain, title: "BSTW" });
const main = artifacts.get("BSTW.gam");
const scene = buildPlayableScene(artifacts, buildReferences(artifacts));
assert.equal(scene.ok, true, JSON.stringify(scene.issues));
assert.deepEqual(scene.start, { x: 19, y: 27, layer: 1 });
const title = assessBstwTitle(artifacts, main, scene);
assert.equal(title.ok, true, title.detail);
assert.equal(title.code, "bstw-title");
assert.equal(title.startupPath, "BSTW/Prg/menuTitle.prg");
assert.equal(title.titleArt.path, "BSTW/Bitmap/BSTW.png");
assert.equal(title.titleArt.status, "resolved");
assert.equal(title.newArt.path, "BSTW/Bitmap/tNew.png");
assert.equal(title.newArt.status, "resolved");
assert.equal(title.newEnabled, true);
assert.deepEqual(title.sourceEvidence, {
  slideshowImageLine: 4, slideshowCallLine: 5,
  newGraphicLine: 2, newBranchCaseLine: 8,
  newBranchStatementLines: [10, 11, 12, 13, 14, 15],
});
const requested = requestBstwNewSession(title, scene);
assert.deepEqual(requested, {
  ok: true, fresh: true, action: "BSTW New",
  start: { x: 19, y: 27, layer: 1 },
  boardPath: "BSTW/Boards/start.brd",
});
// No synthetic game/real ZIP data is stashed in the title adapter.
// The board's preexisting inn state is newly allocated each mount.
let visited = initialInnState();
const active = activateInn(visited,
  { x: 13 * 32 + 16, y: 2 * 32 + 20 }, 0,
  { landmark: { x: 13 * 32 + 16, y: 2 * 32 } });
assert.equal(active.outcome, "opened");
visited = active.state;
for (let i = 0; i < 4; i++) visited = advanceInn(visited, i + 1).state;
assert.equal(visited.clues, 1);
const another = requestBstwNewSession(title, scene);
assert.equal(another.ok, true);
assert.equal(another.fresh, true);
assert.deepEqual(initialInnState(), { checkedInn: 0, clues: 0, maxClues: 13,
  lastInnTalkMs: null, conversation: null, clueMessage: null },
  "New must allocate the scene's usual unvisited inn model");
assert.notStrictEqual(another.start, requested.start,
  "New requests must never reuse a mutable session start object");

const withoutTitleArt = new Map(artifacts);
withoutTitleArt.delete(title.titleArt.path);
const missingArt = assessBstwTitle(withoutTitleArt, main, scene);
assert.equal(missingArt.ok, true);
assert.equal(missingArt.titleArt.status, "missing");
assert.equal(missingArt.titleArt.path, null);
assert.equal(missingArt.newEnabled, true, "Missing title image must not prevent New");
assert.equal(requestBstwNewSession(missingArt, scene).ok, true);

const ambiguousArt = new Map(artifacts);
ambiguousArt.set("BSTW/Bitmap/bstw.png", {
  ...artifacts.get(title.titleArt.path), path: "BSTW/Bitmap/bstw.png",
});
const ambiguous = assessBstwTitle(ambiguousArt, main, scene);
assert.equal(ambiguous.ok, true);
assert.equal(ambiguous.titleArt.status, "ambiguous");
assert.equal(ambiguous.titleArt.path, null);
assert.equal(requestBstwNewSession(ambiguous, scene).ok, true,
  "Ambiguous artwork must not arbitrarily select one or block source-backed New");

const noButtonArt = new Map(artifacts);
noButtonArt.delete("BSTW/Bitmap/tNew.png");
const textNew = assessBstwTitle(noButtonArt, main, scene);
assert.equal(textNew.ok, true);
assert.equal(textNew.newArt.status, "missing");
assert.equal(textNew.newEnabled, true, "Native New button does not depend on source PNG");

const unsupportedBitmap = new Map(artifacts);
unsupportedBitmap.set(title.titleArt.path, {
  ...artifacts.get(title.titleArt.path), error: "Malformed PNG",
});
const corrupt = assessBstwTitle(unsupportedBitmap, main, scene);
assert.equal(corrupt.ok, true);
assert.equal(corrupt.titleArt.status, "unsupported");

const withoutStartup = new Map(artifacts);
withoutStartup.delete(title.startupPath);
assert.equal(assessBstwTitle(withoutStartup, main, scene).code, "startup-unresolved");
const duplicateStartup = new Map(artifacts);
duplicateStartup.set("Other/Prg/menuTitle.prg", {
  ...artifacts.get(title.startupPath), path: "Other/Prg/menuTitle.prg",
});
assert.equal(assessBstwTitle(duplicateStartup, main, scene).code,
  "startup-unresolved", "Ambiguous startup PRG must not be executed/assumed");

const noNew = new Map(artifacts);
const brokenProgram = {
  ...artifacts.get(title.startupPath),
  program: {
    ...artifacts.get(title.startupPath).program,
    rows: artifacts.get(title.startupPath).program.rows.map(row =>
      row.line.includes('setPlayer(1,"Loyalis"') ?
        { ...row, line: "someUnknownCustomCommand()" } : row),
  },
};
noNew.set(title.startupPath, brokenProgram);
assert.equal(assessBstwTitle(noNew, main, scene).code, "startup-unrecognized");
assert.equal(assessBstwTitle(artifacts, { ...main, title: "Other Game" }, scene).code,
  "not-bstw");
assert.equal(assessBstwTitle(artifacts, { ...main, board: "elsewhere.brd" }, scene).code,
  "not-bstw");

const unplayable = { ...scene, ok: false };
const titleWithoutBoard = assessBstwTitle(artifacts, main, unplayable);
assert.equal(titleWithoutBoard.ok, true);
assert.equal(titleWithoutBoard.newEnabled, false);
assert.equal(requestBstwNewSession(titleWithoutBoard, unplayable).ok, false);
assert.equal(requestBstwNewSession(title,
  { ...scene, boardPath: "BSTW/Boards/other.brd" }).ok, false);

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const browser = await readFile(new URL("../app.mjs", import.meta.url), "utf8");
const css = await readFile(new URL("../style.css", import.meta.url), "utf8");
for (const id of ["open-bstw-title", "bstw-title-stage", "bstw-title-image",
  "bstw-title-fallback", "bstw-title-art-status", "bstw-title-new",
  "bstw-title-back", "bstw-title-eligibility", "play-bstw"]) {
  assert.match(html, new RegExp('id="' + id + '"'));
}
assert.match(browser, /assessBstwTitle\(artifacts, archiveMainFile, playableScene\)/);
assert.match(browser, /requestBstwNewSession\(bstwTitle, playableScene\)/);
assert.match(browser, /function launchPlayableScene\(\)/);
assert.match(browser, /closePlayable\(\);\s*const panel = byId\("play-stage"\)/);
assert.match(browser, /mountAuthoredBoard\(panel, playableScene, artifacts,/);
assert.match(browser, /URL\.createObjectURL\(new Blob\(\[bytes\]/);
assert.match(browser, /URL\.revokeObjectURL\(url\)/);
assert.match(browser, /byId\("bstw-title-new"\)\.addEventListener\("click"/);
assert.match(browser, /byId\("play-bstw"\)\.addEventListener\("click"/);
assert.match(css, /\.bstw-title-image-frame/);
assert.match(css, /\.bstw-title-actions/);

// Optional SHA-gated, read-only FULL production-JS path against the
// owner's ZIP (never provided to CI or committed into the repository).
if (process.argv[2]) {
  const bytes = await readFile(process.argv[2]);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "77d6d4180948196106e3d4dad7e2ee62144b30fac8c7ac5491048740e9864300");
  const originalZip = await openGameArchive(bytes, b => JSZip.loadAsync(b));
  const real = (await readArtifacts(originalZip, {})).artifacts;
  const realScene = buildPlayableScene(real, buildReferences(real));
  assert.equal(realScene.ok, true, JSON.stringify(realScene.issues));
  const root = real.get("BSTW.gam");
  const originalTitle = assessBstwTitle(real, root, realScene);
  assert.equal(originalTitle.ok, true, originalTitle.detail);
  assert.equal(originalTitle.titleArt.status, "resolved");
  assert.equal(originalTitle.newArt.status, "resolved");
  assert.equal(originalTitle.titleArt.path, "BSTW/Bitmap/BSTW.png");
  assert.equal(originalTitle.newArt.path, "BSTW/Bitmap/tNew.png");
  assert.deepEqual(originalTitle.sourceEvidence, {
    slideshowImageLine: 82, slideshowCallLine: 86,
    newGraphicLine: 49, newBranchCaseLine: 105,
    newBranchStatementLines: [109, 112, 114, 117, 119, 120],
  });
  const realNew = requestBstwNewSession(originalTitle, realScene);
  assert.equal(realNew.ok, true);
  assert.deepEqual(realNew.start, { x: 107, y: 78, layer: 1 });
  assert.equal(realScene.world.vectorCollision.solids.length, 6);
  assert.equal(realScene.innDoor?.slot, 3);
  const logo = await originalZip.file(originalTitle.titleArt.path).async("uint8array");
  assert.deepEqual([...logo.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10]);
  const size = new DataView(logo.buffer, logo.byteOffset, logo.byteLength);
  assert.deepEqual([size.getUint32(16), size.getUint32(20)], [640, 480]);
  console.log("Owner ZIP production JS passed: GAM→startup PRG→source-proven New→BSTW.png 640×480 and tNew.png→fresh start.brd spawn (107,78,L1), six walls and resolved inn.");
}
console.log("BSTW title passed: scoped source branch and image resolution, ambiguous/missing artwork, New fresh-session guard, keyboard/touch DOM and regression compatibility.");
