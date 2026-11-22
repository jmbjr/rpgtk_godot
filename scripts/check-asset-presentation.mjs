import assert from "node:assert/strict";
import { assetIdentity, referenceExplanation } from "../asset-presentation.mjs";
assert.match(assetIdentity({ type:"wav", decodeStatus:"decoded" }).support, /Preview available/);
assert.match(assetIdentity({ type:"prg" }).support, /does not establish gameplay/);
assert.match(assetIdentity({ type:"dll" }).support, /does not run/);
assert.match(assetIdentity({ type:"brd", error:"bad header" }).support, /could not be decoded/);
assert.match(assetIdentity({ type:"brd", sourceFormat:{supported:false} }).support, /not verified as supported/);
assert.match(assetIdentity({ type:"xyz", decodeStatus:"unidentified" }).support, /No decoder or preview/);
for (const [status, expected] of [["Missing", /No matching target/], ["Dynamic", /computed/],
  ["Ambiguous", /More than one/], ["Foreign-only", /another project/], ["Unindexed", /does not establish.*missing/]]) {
  assert.match(referenceExplanation({status}), expected);
}
assert.match(referenceExplanation({to:"asset.wav"}), /resolver found/);
console.log("Selection presentation passed: decoded/error/unsupported/source boundaries and resolver outcome explanations.");
