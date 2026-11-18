// Toolkit archives may contain a flat project, an enclosing directory,
// or several projects. Keep every path and scope references by ownership.
const assetFolder = /(?:^|\/)(?:Main|Prg|Boards|Chrs|Item|Misc|Tiles|Bitmap|Enemy|Bkrounds|Media|Plugin|StatusE|SpcMove|Font)\//ig;
const folderTypes = {
  prg: ["prg"], boards: ["brd"], chrs: ["tem"], item: ["itm"], enemy: ["ene"],
  bkrounds: ["bkg"], plugin: ["dll"], media: ["wav", "mid", "midi", "mp3", "ogg", "wma", "avi"],
};
const normalized = value => value.replaceAll("\\", "/").toLowerCase();
const typeFolders = Object.entries(folderTypes)
  .filter(([folder]) => folder !== "media")
  .flatMap(([folder, types]) => types.map(type => [type, folder]));
const foldersByType = new Map(typeFolders);
const basename = path => path.split("/").at(-1);
const directory = path => path.slice(0, path.lastIndexOf("/") + 1);
const typeOf = path => basename(path).split(".").at(-1).toLowerCase();
const inventories = new WeakMap();

function layoutRoot(path) {
  const match = [...path.matchAll(assetFolder)].at(-1);
  return match ? match.index + Number(match[0].startsWith("/")) : null;
}

function mainDirectory(path) {
  return directory(path).replace(/(?:^|\/)Main\/$/i, match => match.startsWith("/") ? "/" : "");
}

export function archiveInventory(files) {
  if (inventories.has(files)) return inventories.get(files);
  const paths = [...(files instanceof Map ? files.keys() : files)].filter(path => !path.endsWith("/"));
  const roots = new Map([["", ""]]);
  const owners = new Map();
  const names = new Map();
  for (const path of paths) {
    const folder = layoutRoot(path);
    const root = folder !== null ? path.slice(0, folder) :
      typeOf(path) === "gam" ? mainDirectory(path) : null;
    if (root !== null) {
      roots.set(normalized(root), root);
      owners.set(path, root);
    }
    const name = basename(normalized(path));
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(path);
  }
  const orderedRoots = [...roots.keys()].sort((a, b) => b.length - a.length);
  const physicalOwner = path => owners.get(path) ??
    roots.get(orderedRoots.find(root => normalized(path).startsWith(root)));
  function ownerOf(path) {
    const main = files instanceof Map ? files.get(path) : null;
    if (main?.type === "gam" && main.decodeStatus === "decoded")
      return projectForMain(main).root ?? physicalOwner(path);
    return physicalOwner(path);
  }

  function resolve(value, { projectRoot = null, folder, types } = {}) {
    if (!value || /^none$/i.test(value)) return { status: "unset" };
    const request = normalized(value);
    if (/^(?:[a-z][\w+.-]*:|\/)/i.test(request) || request.split("/").includes(".."))
      return { status: "external" };
    const [name, tileText] = request.replace(/^\.\//, "").split(/(?<=\.tst)(?=\d+$)/i);
    const tile = tileText === undefined ? undefined : Number(tileText);
    const key = projectRoot === null ? null : normalized(projectRoot);
    const expectedFolder = folder ?? (!name.includes("/") && foldersByType.get(typeOf(name)));
    const subdir = expectedFolder && normalized(expectedFolder) + "/";
    const requested = subdir && !name.startsWith(subdir) ? subdir + name : name;
    const accepted = types ?? folderTypes[normalized(expectedFolder || "")];
    const candidates = (names.get(basename(name)) ?? []).filter(path => {
      if (accepted && !accepted.includes(typeOf(path))) return false;
      const owner = normalized(ownerOf(path) ?? "");
      if (key !== null && key !== owner) return false;
      const relative = normalized(path).slice(physicalOwner(path).length);
      return !(expectedFolder || name.includes("/")) || relative === requested;
    }).sort();
    const result = candidates.length === 1 ? { status: "resolved", path: candidates[0] } :
      candidates.length ? { status: "ambiguous", candidates } : { status: "missing" };
    return tile === undefined ? result : { ...result, tile };
  }

  function projectForMain(main) {
    const path = main.path ?? main.filename ?? "";
    const explicit = mainDirectory(path);
    if (explicit) return { status: "resolved", root: explicit };
    const opening = [["Boards", main.board], ["Chrs", main.character]].filter(([, value]) => value && !/^none$/i.test(value));
    const match = (root, [folder, value]) =>
      ["resolved", "ambiguous"].includes(resolve(value, { folder, projectRoot: root }).status);
    const available = opening.filter(anchor => [...roots.values()].some(root => match(root, anchor)));
    const anchors = available.length ? available : [["Prg", main.startup]].filter(([, value]) => value);
    // An opening binding found locally establishes ownership even if a
    // companion asset is missing. Never fill that gap from a sibling.
    if (anchors.some(anchor => match("", anchor))) return { status: "resolved", root: "" };
    const candidates = anchors.length ? [...roots.values()].filter(root => root &&
      anchors.every(anchor => match(root, anchor))).sort() : [];
    if (!candidates.length && available.length > 1) {
      const conflicting = [...roots.values()].filter(root => available.some(anchor => match(root, anchor))).sort();
      if (conflicting.length > 1) return { status: "ambiguous", candidates: conflicting };
    }
    if (candidates.length > 1) return { status: "ambiguous", candidates };
    return { status: "resolved", root: candidates[0] ?? "" };
  }

  const inventory = { paths, ownerOf, resolve, projectForMain };
  inventories.set(files, inventory);
  return inventory;
}
