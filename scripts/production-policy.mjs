import assert from "node:assert/strict";

// Regression guard for known retired implementation and inspection residue.
// Game-authored source in ZIPs and inert fixture/provenance data is not code.
const retiredModule = /(?:^|\/)(?:bstw-(?:compatibility|title|ending)|tk3-source-(?:dialogue|menu)|imported-inn|inn-dialogue|inn-contract)\.(?:m?js|css|html|json)$|(?:^|\/)sandbox\.(?:m?js|html)$/i;
const retiredReference = /bstw-(?:compatibility|title|ending)|tk3-source-(?:dialogue|menu)|(?:imported-inn|inn-dialogue|inn-contract)\.(?:m?js|json)|play-(?:bstw|compatibility|script-recovery)|Demo\/Prg\/start\.prg/i;
const gameSelectors = /(?:\b|\\b)(?:bstw|bruce|loyalis|mwininn|cmwin|ccmap|menutitle|menumain|enddemo|initcmaps|initvar|settxt|updateclues|clues|maxclues|checkedinn|lastinntalk|einn|innDoor|innStatus|isInnDoor)\b|(?:\b|\\b)checked(?:\s*\[|\\s)/i;
// These exact outputs are copied/bundled from the pinned dependencies. A new
// first-party file under vendor/ does not inherit a directory-wide exemption.
const thirdPartyCode = new Set([
  "vendor/jszip.min.js", "vendor/webaudio-tinysynth.js",
  "vendor/soundfont/spessasynth.mjs", "vendor/soundfont/spessasynth_processor.min.js",
  "vendor/piano-roll/magenta.mjs", "vendor/jspdf/jspdf.mjs",
]);
export const productionModule = path => !thirdPartyCode.has(path) && /\.m?js$/i.test(path);
export function verifyProductionFile(path, text = "") {
  assert.doesNotMatch(path, retiredModule, "Retired production payload: " + path);
  const code = /\.(?:m?js|html|css|svg|map)$/i.test(path);
  const configuration = /\.json$/i.test(path) && !/^(?:docs|fixtures)\//.test(path);
  if (thirdPartyCode.has(path) || !(code || configuration)) return;
  assert.doesNotMatch(path, retiredReference, "Retired production path: " + path);
  assert.doesNotMatch(text, retiredReference, "Retired production reference: " + path);
  assert.doesNotMatch(text, gameSelectors, "Game-specific production assumption: " + path);
}
