// Independent read-only inspection cases. Never executed by acceptance tests.
import JSZip from "../../../vendor/jszip.min.js";
import { buildBrowserGame } from "./tk3-browser-fixtures.mjs";

export async function buildDependencyCases(legacyBytes) {
  const legacy = await JSZip.loadAsync(legacyBytes);
  const native = await JSZip.loadAsync(await buildBrowserGame("grove", { nativeEncounters: true }));
  const cases = [
    { name: "dependencies-tk2.zip", zip: legacy, root: "Game/TK2LegacyLab/", board: "Boards/legacy-text-20.brd", entry: "start.prg", audio: "tone.wav", legacy: true },
    { name: "dependencies-tk3.zip", zip: native, root: "", board: "Boards/ridge.brd", entry: "doorTrigger.prg", audio: "tick.wav", legacy: false },
  ];
  for (const test of cases) {
    const { zip, root, entry, audio } = test;
    const call = (command, value) => (test.legacy ? "#" : "") + command + "(" + value + ")";
    const media = value => call(test.legacy ? "Wav" : "mediaPlay", value);
    zip.file(root + "Prg/" + entry, [
      "// Synthetic static dependency evidence; execution is not asserted.",
      call("Run", '"branch.prg"'), call("Run", '"also.prg"'),
      media('"' + audio + '"'), media('"absent.wav"'), media(test.legacy ? "clues$" : "clues"), media('"shared.wav"'),
      ...Array.from({ length: 14 }, (_, i) => call("Run", '"leaf' + i + '.prg"')),
      ...Array.from({ length: 65 }, () => media('"' + audio + '"')),
    ].join("\n"));
    zip.file(root + "Prg/branch.prg", [call("Run", '"' + entry + '"'), media('"' + audio + '"'), call("Run", '"chain0.prg"')].join("\n"));
    zip.file(root + "Prg/also.prg", media('"' + audio + '"'));
    for (let i = 0; i < 14; i++) zip.file(root + "Prg/leaf" + i + ".prg", "// No indexed outgoing references");
    for (let i = 0; i < 8; i++) zip.file(root + "Prg/chain" + i + ".prg", i < 7 ? call("Run", '"chain' + (i + 1) + '.prg"') : "// Last chain link");
    const wave = await zip.file(root + "Media/" + audio).async("uint8array");
    zip.file(root + "Media/shared.wav", wave); zip.file(root + "media/SHARED.wav", wave);
    test.bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    test.board = root + test.board; test.program = root + "Prg/" + entry; test.sound = root + "Media/" + audio;
    delete test.zip;
  }
  return cases;
}
