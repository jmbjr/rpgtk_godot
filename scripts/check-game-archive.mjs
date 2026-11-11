import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { openGameArchive } from "../archive.mjs";
import { readMainFile, resolveAsset } from "../model.mjs";
import JSZip from "../vendor/jszip.min.js";

const loadZip = bytes => JSZip.loadAsync(bytes);

// Android file pickers may classify a valid ZIP as an unknown binary type.
// Never restrict file selection by extension/MIME; the ZIP loader checks bytes.
const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
const archiveInput = page.match(/<input\\b[^>]*\\bid="archive"[^>]*>/)?.[0];
assert.ok(archiveInput, "Archive picker must exist");
assert.doesNotMatch(archiveInput, /\\baccept\\s*=/i, "Archive picker must not filter unknown Android MIME types");
assert.match(page, /id="open-test-game"/, "Direct baseline viewer button is present");
assert.match(page, /id="open-legacy-game"/, "Direct legacy viewer button is present");
const game = new JSZip();
game.file("main.gam", ["RPGTLKIT MAIN", " 2 ", " 0 ", "1", "start.prg", "", "0", "0", "27", "13",
  "home.brd", "db.tem", ""].join("\r\n"));
game.file("Prg\\start.prg", "#Done()");
const payload = await game.generateAsync({ type: "nodebuffer" });
const plain = await openGameArchive(payload, loadZip);
assert.ok(plain.file("Prg/start.prg"));

const artifact = new JSZip();
artifact.file("tk2-legacy-game.zip", payload);
const unwrapped = await openGameArchive(await artifact.generateAsync({ type: "uint8array" }), loadZip);
assert.ok(unwrapped.file("main.gam"));
assert.ok(unwrapped.file("Prg/start.prg"));
assert.equal(unwrapped.file("tk2-legacy-game.zip"), null);

// A downloaded Actions artifact can contain a single ZIP under a directory;
// both entry styles should resolve through the same viewer import path.
const folderArtifact = new JSZip();
folderArtifact.file("artifact\\tk2-legacy-game.zip", payload, { createFolders: false });
const fromFolder = await openGameArchive(await folderArtifact.generateAsync({ type: "uint8array" }), loadZip);
assert.ok(fromFolder.file("Prg/start.prg"));

const malformedArtifact = new JSZip();
malformedArtifact.file("tk2-legacy-game.zip", "not a ZIP");
await assert.rejects(openGameArchive(await malformedArtifact.generateAsync({ type: "uint8array" }), loadZip),
  /Unable to read nested game ZIP/);

const ambiguousArtifact = new JSZip();
ambiguousArtifact.file("first.zip", payload);
ambiguousArtifact.file("second.zip", payload);
await assert.rejects(openGameArchive(await ambiguousArtifact.generateAsync({ type: "uint8array" }), loadZip),
  /multiple game ZIPs/);

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
const wrappedInstaller = new JSZip();
wrappedInstaller.file("tk2-installer.zip", await wrap(footer));
const installedFromArtifact = await openGameArchive(await wrappedInstaller.generateAsync({ type: "uint8array" }), loadZip);
assert.ok(installedFromArtifact.file("main.gam"));
const main = readMainFile(await installed.file("main.gam").async("uint8array"));
assert.deepEqual(main, { major: 2, minor: 0, startup: "start.prg", board: "home.brd", character: "db.tem" });
assert.equal(resolveAsset(Object.keys(installed.files), "Prg", main.startup).path, "Prg/start.prg");
assert.equal(installed.file("game.exe"), null);

const invalid = Buffer.from(footer);
invalid.writeUInt32LE(payload.length + 1, 8);
await assert.rejects(openGameArchive(await wrap(invalid), loadZip), /compound game payload is invalid/);
game.file("Prg/start.prg", "#Done()");
await assert.rejects(openGameArchive(await game.generateAsync({ type: "uint8array" }), loadZip), /duplicate path/);
console.log("Game archive checks passed for plain ZIPs, nested Actions artifact ZIPs, Toolkit installer payloads, startup, and malformed archives.");
