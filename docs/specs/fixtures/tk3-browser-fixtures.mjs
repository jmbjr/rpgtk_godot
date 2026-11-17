// Independent generated archives for the staged Explorer entry point.
import assert from "node:assert/strict";
import { buildScriptFixtureZip, scriptFixtureSpecs } from "./tk3-script-interaction-fixtures.mjs";
import { fixtures } from "./format-fixtures.mjs";

const z = value => Buffer.from(value + "\0", "ascii");
function ints(width, ...values) {
  const data = Buffer.alloc(width * values.length);
  values.forEach((value, index) => width === 2 ?
    data.writeInt16LE(value, index * width) : data.writeInt32LE(value, index * width));
  return data;
}
const short = (...values) => ints(2, ...values);
const long = (...values) => ints(4, ...values);
const pack = (...values) => Buffer.concat(values);

function replace(bytes, needle, value) {
  const data = Buffer.from(bytes);
  const offset = data.indexOf(needle);
  assert.ok(offset >= 0 && data.indexOf(needle, offset + 1) < 0,
    "Expected one fixture field: " + needle.toString("hex"));
  return pack(data.subarray(0, offset), value, data.subarray(offset + needle.length));
}

function zone(bytes, source) {
  const original = pack(z("doorTrigger.prg"), z("trigger.png"), z("doorClosed"), z("1"),
    z("doorOpen"), z("yes"), short(1,1,4,1,1), long(48,72,80,72), short(-1), z("door-trigger"));
  const replacement = pack(z(source), z(""), z(""), z(""), z(""), z(""),
    short(0,0,0,1,3), long(25,18,32,18,32,36,25,36), short(-1), z("gate"));
  return replace(bytes, original, replacement);
}

function addFight(zip, root, binary) {
  const background = binary ?
    pack(z("RPGTLKIT BKG"), short(2,3), z("field.png"), ...Array(5).fill(z(""))) :
    fixtures.find(fixture => fixture.path === "Bkrounds/room.bkg").bytes;
  const enemy = binary ?
    pack(z("RPGTLKIT ENEMY"), short(2,1), z("Synthetic Sentinel"), long(12,3,2,1),
      Buffer.from([1]), short(0,0,0), z(""), short(-1,-1), Buffer.from([0,0]),
      z(""), long(4,2), z("win.prg"), z(""), short(-1,-1,0)) :
    Buffer.from(["RPGTLKIT ENEMY", 2, 0, "Synthetic Sentinel", 12, 3, 2, 1, 1, 0, 0,
      1, 1, ...Array(335).fill(""), 0, 0, "", 4, 2, "win.prg", "", "", "", "", "", ""
    ].join("\r\n"), "ascii");
  zip.file(root + "Enemy/sentinel.ene", enemy);
  zip.file(root + "Bkrounds/field.bkg", background);
  zip.file(root + "Prg/win.prg", 'mwin("Sentinel defeated.")\nwait()\neraseItem("source")\nwon = 1');
}

const fight = 'mwin("The sentinel challenges you.")\nwait()\nmwinCls()\nfightEnemy("sentinel.ene", "field.bkg")';
export async function buildBrowserGame(id, options = {}) {
  const spec = scriptFixtureSpecs.find(spec => spec.id === id);
  const harbor = id === "harbor";
  const zip = await buildScriptFixtureZip({ ...spec, script: harbor ? "mwininn.prg" : spec.script,
    position: { x: 45, y: 27, layer: 1 } });
  const originalRoot = spec.root + "/";
  let gam = await zip.file(spec.main).async("nodebuffer");
  gam = replace(gam, z("gameover.prg"), z(harbor ? "" : "recover.prg"));
  if (options.blockStartup) zip.file(originalRoot + "Prg/" + spec.startup, "blocked = 1\nunsupportedAction(7)");
  if (harbor) {
    gam = replace(gam, pack(short(35), z("ENDDEMO.prg")), pack(short(101), z("station_report.prg")));
    gam = replace(gam, pack(short(29), z("menuMain.prg")), pack(short(98), z("broken.prg")));
    if (!options.blockStartup) zip.file(originalRoot + "Prg/" + spec.startup, "launched = 7\nclues = 3\nmaxclues = 9");
    zip.file(originalRoot + "Prg/station_report.prg",
      '#include("weather_clock.prg")\nReportTide()\ncaller_resumed = tide');
    zip.file(originalRoot + "Prg/weather_clock.prg",
      'method ReportTide()\n{\ntide = tide + 1\nmwin("The tide is rising.")\nwait()\nmwinCls()\n}');
    zip.file(originalRoot + "Prg/broken.prg", 'untouched = 1\n#include("broken_helper.prg")\nDecline()');
    zip.file(originalRoot + "Prg/broken_helper.prg", "method Decline()\n{\nfontSize(18)\n}");
    zip.file(originalRoot + "Prg/mwininn.prg",
      'mwin("Foreign archive dialogue.")\nwait()\nSend("missing.brd", 19, 27, 1)');
    const path = originalRoot + "Boards/" + spec.board;
    const onward = 'Send("beacon.brd", 19, 27, 2)';
    zip.file(path, zone(await zip.file(path).async("nodebuffer"),
      'send("channel.brd", 19, 27, 1)'));
    zip.file(originalRoot + "Boards/channel.brd", await zip.file(originalRoot + "Boards/beacon.brd").async("nodebuffer"));
    // Exercise a post-Send fight request from a file-backed GAM action.
    gam = replace(gam, pack(short(8), short(96), short(32)), pack(short(104), short(96), short(32)));
    zip.file(originalRoot + "Prg/runtime.prg", onward + '\nfightEnemy("sentinel.ene", "field.bkg")\narrived = 1');
    const beacon = originalRoot + "Boards/beacon.brd";
    const beaconBytes = await zip.file(beacon).async("nodebuffer");
    zip.file(beacon, replace(beaconBytes, short(0,1,78,45,1,-1), short(0,1,40,27,2,-1)));
    zip.file(originalRoot + "Prg/beacon_ending.prg", fight);
    addFight(zip, originalRoot, false);
    // A duplicate helper outside the GAM project must never be imported.
    zip.file("Foreign/Prg/weather_clock.prg", "method ReportTide()\n{\nwrong = 1\n}");
    zip.file(originalRoot + "Foreign/Prg/mwininn.prg", 'mwin("Foreign decoy.")\nwait()');
    zip.file(originalRoot + "Main/" + spec.main, gam);
    zip.remove(spec.main);
  } else {
    gam = replace(gam, z(spec.startup), z(""));
    gam = replace(gam, pack(short(8), short(96), short(32)), pack(short(116), short(96), short(32)));
    const path = originalRoot + "Boards/" + spec.board;
    const board = await zip.file(path).async("nodebuffer");
    const inherited = replace(board, z(spec.script), z(""));
    zip.file(path, inherited);
    const destination = replace(board, z(spec.script), z("challenge.prg"));
    zip.file(originalRoot + "Boards/ridge.brd", destination);
    zip.file(originalRoot + "Prg/pickup.prg", 'Send("ridge.brd", 19, 27, 1)\ntravelled = 1');
    zip.file(originalRoot + "Prg/challenge.prg", fight);
    zip.file(originalRoot + "Prg/runtime.prg",
      'Send("meadow.brd", 19, 27, 1)\nmwin("Return to the ridge?")\nwait()\nSend("ridge.brd", 19, 27, 1)');
    zip.file(originalRoot + "Prg/recover.prg", 'Send("meadow.brd", 19, 27, 1)\nmwin("Recover on the meadow.")\nwait()\nrecovered = 1');
    addFight(zip, originalRoot, true);
    // Flat project layout, independent of the nested Harbor GAM.
    for (const entry of Object.values(zip.files).filter(entry => !entry.dir && entry.name.startsWith(originalRoot))) {
      zip.file(entry.name.slice(originalRoot.length), await entry.async("uint8array"));
    }
    zip.remove(originalRoot);
    zip.file(spec.main, gam);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// The signatures are generated deliberately for the opt-in eligibility test.
export async function buildBstwBrowserGame({ fallback = false } = {}) {
  const spec = { ...scriptFixtureSpecs[0], root: "BSTW", main: "BSTW.gam", title: "BSTW",
    startup: "menuTitle.prg", board: "start.brd", character: "bruce.tem",
    script: "synthetic_unused.prg", item: "synthetic_unused.itm" };
  const zip = await buildScriptFixtureZip(spec);
  const main = await zip.file(spec.main).async("nodebuffer");
  zip.file(spec.main, replace(replace(main, pack(short(29), z("menuMain.prg")),
    pack(short(109), z("menuMain.prg"))), pack(short(8), short(96), short(32)),
    pack(short(116), short(96), short(32))));
  const field = (...values) => pack(...values.map(z));
  const path = "BSTW/Boards/start.brd";
  const board = await zip.file(path).async("nodebuffer");
  const original = pack(short(1),
    field(spec.item, spec.script, "", "", "", "", "", "", ""), short(0,1,78,45,1,-1),
    field("door.itm", "openDoor.prg", "", "trigger", "01", "endTrigger", "done", "loading", "pending"),
    short(1,1,68,90,2,-1));
  const blank = pack(field("", "", "", "", "", "", "", "", ""), short(0,1,0,0,1,-1));
  const door = pack(field("door.itm", "mwininn.prg", "", "", "", "", "", "", ""),
    short(0,1,45,27,1,-1));
  const startBoard = replace(board, original, pack(short(3), blank, blank, blank, door));
  zip.file(path, startBoard);
  zip.file("BSTW/Boards/return.brd", startBoard);
  zip.file("BSTW/Item/door.itm", await zip.file("BSTW/Item/" + spec.item).async("nodebuffer"));
  zip.file("BSTW/Prg/menuTitle.prg", [
    '#include("init.prg")', '_party[0] = "Bruce"', '_party[1] = "Loyalis"',
    'titleCmap->setGraphic(win0,0,0,"tNew.png")', 'iTitle[3] = "BSTW.png?"',
    'Slideshow(iTitle,640,480,0,0)', 'switch(index)', '{', 'case 0:', '{',
    '_party[0] = "Bruce"', 'setPlayer(0,"Bruce","Hero",1,1,1)',
    '_party[1] = "Loyalis"', 'setPlayer(1,"Loyalis","Knight",1,1,1)', 'initCmaps()', 'end()', '}', '}',
  ].join("\n"));
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
  zip.file("BSTW/Bitmap/BSTW.png", pixel);
  zip.file("BSTW/Bitmap/tNew.png", pixel);
  zip.file("BSTW/Prg/CMwin.prg", "method SetTxt(slot,text)\n{\n}");
  const helper = "method updateClues(note)\n{\nif(remainingclues == 0)\n{\nenddemo = 1\n}\n}";
  zip.file("BSTW/Prg/common.prg", helper);
  const labels = ["Items", "Tactics", "Equipment", "Status", "Options", "System"];
  zip.file("BSTW/Prg/init.prg", ["maxclues = 13", "itemtalkthreshold = 500", "einn = 6",
    ...labels.map((name, index) => "ev" + index + " = " + index),
    ...labels.map((name, index) => 'menu->setText(SIDEMENU,' + index + ',0,"' + name + '")'),
    'menu->setGraphic(PROFMENU,0,0,"portrait" + _party[0] + ".png")', helper].join("\n"));
  zip.file("BSTW/Prg/menuMain.prg", '#include("menus.prg")\nMainMenu()');
  zip.file("BSTW/Prg/menus.prg", ["method MainMenu()", "{", "switch(index)", "{",
    ...labels.flatMap((name,index) => ["case " + index + ":", "{",
      ...([1,2,3].includes(index) ? ["menu->setActiveWinID(PROFMENU)", "if(index~=-1)", "{"] : []),
      "if(checked[ev" + index + "]==0)", "{", "clues++", 'updateClues("Learned ' + name + '")', "}",
      ...([1,2,3].includes(index) ? ["}"] : []), "checked[ev" + index + "]++", "}"]),
    "}", "}"].join("\n"));
  zip.file("BSTW/Prg/mwininn.prg", fallback ? 'mwin("The normal archive door.")\nwait()' :
    ['#include("CMwin.prg")', '#include("common.prg")', "delta=getTickCount()-lastTalk",
      "if(delta>itemtalkthreshold)", "{", "if(checked[einn]==0)", "{",
      'dialogue->SetTxt(bruceMwinId,"First visit to the inn.")', "clues++", 'updateClues("Inn clue")', "}",
      "else", "{", 'dialogue->SetTxt(bruceMwinId,"Repeat visit to the inn.")', "}",
      "lastTalk=getTickCount()", "checked[einn]++", "}"].join("\n"));
  zip.file("BSTW/Prg/runtime.prg", 'unrelated = unrelated + 1\nSend("return.brd", 19, 27, 1)\nSend("start.brd", 19, 27, 1)');
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
