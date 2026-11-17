import { mainFileBindings, resolveAsset } from "./model.mjs";

// One source-evidence adapter for BSTW's title → New → configured board.
// This is NOT a general RPGCode parser, interpreter, slideshow executor,
// party setup implementation, or automatic engine bootstrap.
const SCRIPT = "menutitle.prg";
const BOARD = "start.brd";
const CHARACTER = "bruce.tem";
const BASENAME = value => String(value ?? "").replaceAll("\\", "/").split("/").at(-1).toLowerCase();
const decoded = (asset, type) =>
  asset?.type === type && asset.decodeStatus === "decoded" && !asset.error;

function sourceLines(program) {
  // The decoded PRG's existing indexer keeps each original source line.
  // Discard comment-only lines and trailing // comments before matching
  // the narrowly known BSTW statements.
  return (program.program?.rows ?? []).map((row, index) => ({
    number: index + 1,
    code: row.line.replace(/\/\/.*$/, "").trim(),
  }));
}

function matchLine(lines, expression) {
  return lines.find(line => expression.test(line.code)) ?? null;
}

function titleEvidence(lines) {
  const frame = matchLine(lines,
    /^iTitle\s*\[\s*3\s*\]\s*=\s*"([^"?\\/]+\.(?:png|jpe?g|gif))\?"/i);
  const slideshow = matchLine(lines,
    /^Slideshow\s*\(\s*iTitle\s*,\s*640\s*,\s*480\s*,\s*0\s*,\s*0\s*\)/i);
  const graphic = matchLine(lines,
    /^(?:titleCmap\s*->\s*)?setGraphic\s*\(\s*win0\s*,\s*0\s*,\s*0\s*,\s*"([^"\\/]+)"\s*\)/i);
  // The original uses titleCmap->setGraphic(win0,0,0, "tNew.png").
  const titleName = frame?.code.match(/"([^"]+)\?"/)?.[1] ?? null;
  const newName = graphic?.code.match(/"([^"]+\.(?:png|jpe?g|gif))"/i)?.[1] ?? null;
  return { frame, slideshow, graphic, titleName, newName };
}

function newBranchEvidence(lines) {
  const switchLine = matchLine(lines, /^switch\s*\(\s*index\s*\)/i);
  if (!switchLine) return null;
  const start = lines.findIndex(line =>
    line.number > switchLine.number && /^case\s+0\s*:/i.test(line.code));
  if (start < 0) return null;
  const stop = lines.findIndex((line, index) =>
    index > start && /^case\s+(?:-?\d+)\s*:/i.test(line.code));
  const branch = lines.slice(start, stop < 0 ? lines.length : stop);
  const checks = [
    /_party\s*\[\s*0\s*\]\s*=\s*"Bruce"/i,
    /^setPlayer\s*\(\s*0\s*,\s*"Bruce"\s*,\s*"Hero"\s*,/i,
    /_party\s*\[\s*1\s*\]\s*=\s*"Loyalis"/i,
    /^setPlayer\s*\(\s*1\s*,\s*"Loyalis"\s*,\s*"Knight"\s*,/i,
    /^initCmaps\s*\(\s*\)/i,
    /^end\s*\(\s*\)/i,
  ];
  const matched = [];
  let cursor = 0;
  for (const expression of checks) {
    const index = branch.findIndex((line, offset) =>
      offset >= cursor && expression.test(line.code));
    if (index < 0) return null;
    matched.push(branch[index].number);
    cursor = index + 1;
  }
  return { caseLine: lines[start].number, statementLines: matched };
}

function resolveTitleImage(paths, filename, root) {
  if (!filename) return {
    filename: null, status: "unset", path: null,
    reason: "The inspected title script does not declare an image.",
  };
  const result = resolveAsset(paths, "Bitmap", filename, root);
  return {
    filename,
    path: result.status === "resolved" ? result.path : null,
    status: result.status,
    reason: result.status === "resolved" ? "" :
      result.status === "ambiguous" ?
        "Multiple matching images in this game root; no image was selected." :
        "No matching Bitmap asset in this game root.",
  };
}

export function assessBstwTitle(artifacts, main, scene) {
  const unsupported = (code, detail) => ({
    ok: false, code, detail, titleArt: null, newArt: null,
    newEnabled: false,
  });
  if (!decoded(main, "gam") || main.major !== 2 || main.minor !== 9 ||
      main.title?.toLowerCase() !== "bstw" ||
      BASENAME(main.startup) !== SCRIPT ||
      BASENAME(main.board) !== BOARD ||
      BASENAME(main.character) !== CHARACTER) {
    return unsupported("not-bstw", "Only BSTW's native GAM 2.9 menuTitle.prg → start.brd / bruce.tem startup is supported.");
  }

  const paths = [...artifacts.keys()];
  const startupBinding = new Map(mainFileBindings(main, paths, scene?.projectRoot)).get("Configured startup");
  const startup = artifacts.get(startupBinding?.path);
  if (startupBinding?.status !== "resolved" || !decoded(startup, "prg")) {
    return unsupported("startup-unresolved",
      "Configured menuTitle.prg is missing, ambiguous or not decoded.");
  }
  const lines = sourceLines(startup);
  const title = titleEvidence(lines);
  const branch = newBranchEvidence(lines);
  if (!title.frame || !title.slideshow || !branch ||
      BASENAME(title.titleName) !== "bstw.png" ||
      !title.graphic || BASENAME(title.newName) !== "tnew.png") {
    return unsupported("startup-unrecognized",
      "The title slideshow or the expected case 0 New branch does not match the verified BSTW startup evidence.");
  }

  const startupDirectory = startup.path.slice(0, startup.path.lastIndexOf("/"));
  const root = scene?.projectRoot ?? startupDirectory.slice(0, startupDirectory.lastIndexOf("/") + 1);
  const titleArt = resolveTitleImage(paths, title.titleName, root);
  const newArt = resolveTitleImage(paths, title.newName, root);
  // A uniquely resolved image must also be an actual displayable media
  // entry; never use a corrupt or unsupported matching archive record.
  for (const art of [titleArt, newArt]) {
    if (art.status === "resolved") {
      const asset = artifacts.get(art.path);
      if (!asset || asset.error || !["png", "jpg", "jpeg", "gif"].includes(asset.type)) {
        art.status = "unsupported";
        art.reason = "The matching archive entry is not supported displayable artwork.";
        art.path = null;
      }
    }
  }

  const newEnabled = Boolean(scene?.ok && scene.mainPath === main.path &&
    BASENAME(scene.boardPath) === BOARD && BASENAME(scene.characterPath) === CHARACTER);
  return {
    ok: true, code: "bstw-title", detail: "BSTW source-backed title and New case recognized.",
    mainPath: main.path, startupPath: startup.path,
    boardPath: newEnabled ? scene.boardPath : null,
    newEnabled,
    newReason: newEnabled ? "New creates a fresh imported start.brd session." :
      "New requires a supported and fully resolved opening board and Bruce animations.",
    titleArt, newArt,
    sourceEvidence: {
      slideshowImageLine: title.frame.number,
      slideshowCallLine: title.slideshow.number,
      newGraphicLine: title.graphic.number,
      newBranchCaseLine: branch.caseLine,
      newBranchStatementLines: branch.statementLines,
    },
  };
}

// A pure guard for the browser's New button. The actual browser launch
// calls the *same* mountAuthoredBoard launcher as direct Play, which
// allocates fresh movement, inn dialogue, visit and clue state each time.
export function requestBstwNewSession(title, scene) {
  if (!title?.ok || !title.newEnabled || !scene?.ok ||
      title.mainPath !== scene.mainPath ||
      title.boardPath !== scene.boardPath ||
      BASENAME(scene.characterPath) !== CHARACTER) {
    return { ok: false, reason: "This title cannot start the current imported board." };
  }
  return {
    ok: true, fresh: true, action: "BSTW New",
    start: { ...scene.start }, boardPath: scene.boardPath,
  };
}
