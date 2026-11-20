import assert from "node:assert/strict";

// Regression guard for known retired implementation and inspection residue.
// Game-authored source in ZIPs and inert fixture/provenance data is not code.
const retiredModule = /(?:^|\/)(?:bstw-(?:compatibility|title|ending)|tk3-source-(?:dialogue|menu)|imported-inn|inn-dialogue|inn-contract)\.(?:m?js|css|html|json)$|(?:^|\/)sandbox\.(?:m?js|html)$/i;
const retiredReference = /bstw-(?:compatibility|title|ending)|tk3-source-(?:dialogue|menu)|(?:imported-inn|inn-dialogue|inn-contract)\.(?:m?js|json)|play-(?:bstw|compatibility|script-recovery)|Demo\/Prg\/start\.prg/i;
const gameSelectors = /(?:\b|\\b)(?:bstw|bruce|loyalis|mwininn|cmwin|ccmap|menutitle|menumain|enddemo|initcmaps|initvar|settxt|updateclues|clues|maxclues|checkedinn|lastinntalk|einn|innDoor|innStatus|isInnDoor)\b|(?:\b|\\b)checked(?:\s*\[|\\s)/i;
export const productionModule = path => !path.startsWith("vendor/") && /\.m?js$/i.test(path);
export function verifyProductionFile(path, text = "") {
  assert.doesNotMatch(path, retiredModule, "Retired production payload: " + path);
  const code = /\.(?:m?js|html|css|svg|map)$/i.test(path);
  const configuration = /\.json$/i.test(path) && !/^(?:docs|fixtures)\//.test(path);
  if (path.startsWith("vendor/") || !(code || configuration)) return;
  assert.doesNotMatch(text, retiredReference, "Retired production reference: " + path);
  assert.doesNotMatch(text, gameSelectors, "Game-specific production assumption: " + path);
}
