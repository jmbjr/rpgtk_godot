import assert from "node:assert/strict";
import { openGameArchive } from "../archive.mjs";
import { readMainFile, resolveAsset } from "../model.mjs";
import JSZip from "../vendor/jszip.min.js";

const loadZip = bytes => JSZip.loadAsync(bytes);
const game = new JSZip();
game.file("main.gam", ["RPGTLKIT MAIN", " 2 ", " 0 ", "1", "start.prg", "", "0", "0", "27", "13",
  "home.brd", "db.tem", ""].join("\r\n"));
game.file("Prg\\start.prg", "#Done()");
const payload = await game.generateAsync({ type: "nodebuffer" });
const plain = await openGameArchive(payload, loadZip);
assert.ok(plain.file("Prg/start.prg"));

const stub = Buffer.from("MZ synthetic executable prefix");
const footer = Buffer.alloc(12);
footer.write("CMP1");
footer.writeUInt32LE(stub.length, 4);
footer.writeUInt32LE(payload.length, 8);

async function wrap(footerBytes) {
  const inner = new JSZip();
  inner.file("game.exe", Buffer.concat([stub, payload, footerBytes]));
  const outer = new JSZip();
  outer.file("setup.inf", "synthetic installer");
  outer.file("zip.zip", await inner.generateAsync({ type: "uint8array" }));
  return outer.generateAsync({ type: "uint8array" });
}

const installed = await openGameArchive(await wrap(footer), loadZip);
const main = readMainFile(await installed.file("main.gam").async("uint8array"));
assert.deepEqual(main, { major: 2, minor: 0, startup: "start.prg", board: "home.brd", character: "db.tem" });
assert.equal(resolveAsset(Object.keys(installed.files), "Prg", main.startup).path, "Prg/start.prg");
assert.equal(installed.file("game.exe"), null);

const invalid = Buffer.from(footer);
invalid.writeUInt32LE(payload.length + 1, 8);
await assert.rejects(openGameArchive(await wrap(invalid), loadZip), /compound game payload is invalid/);
game.file("Prg/start.prg", "#Done()");
await assert.rejects(openGameArchive(await game.generateAsync({ type: "uint8array" }), loadZip), /duplicate path/);
console.log("Game archive checks passed for plain ZIPs, Toolkit installer payloads, startup, and malformed archives.");
