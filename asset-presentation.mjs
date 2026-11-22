// Presentation uses decoded format/status and resolver outcomes, never game identity.
const names = {
  prg: "RPGCode program", brd: "Board", tst: "Tileset", gph: "Tile artwork",
  tan: "Animated tile", anm: "Animation", tem: "Character", ene: "Enemy",
  itm: "Item", bkg: "Battle background", tbm: "Tile bitmap", gam: "Game configuration",
  wav: "Wave audio", mid: "MIDI music", png: "Image", bmp: "Image", gif: "Image",
  jpg: "Image", jpeg: "Image", fnt: "Font", spc: "Special move", ste: "Status effect",
  sav: "Saved game", dll: "Plugin metadata", doc: "Compound document",
};
export function assetIdentity(asset) {
  if (!asset) return { kind: "No selection", support: "Choose a file in the archive browser." };
  const kind = names[asset.type] ?? "Archive file";
  let support;
  if (asset.error) support = "This file could not be decoded. Its recorded error, archive location and indexed connections remain available below.";
  else if (asset.type === "prg") support = "Source inspection available. Command highlighting covers legacy # syntax; Connections includes recognized legacy and native file references. Inspection does not establish gameplay compatibility.";
  else if (asset.sourceFormat?.supported === false) support = "This file layout is not verified as supported. Any available inspection is partial; use its format notes, decoded record and connections as evidence.";
  else if (asset.decodeStatus === "unidentified") support = "No decoder or preview is available for this format. You can inspect its archive record and any indexed connections.";
  else if (["dll", "sav", "doc", "gam", "spc", "ste", "___"].includes(asset.type)) support = "Record inspection available. Decoding these fields does not run this file or establish original Toolkit parity.";
  else support = "Preview available for supported content. Missing dependencies or format limits are explained with the preview and technical details.";
  return { kind, support };
}
export function referenceExplanation(edge) {
  if (edge.to) return "The resolver found this target in the archive. Follow the evidence to inspect the exact source line or numbered tile where recorded.";
  const status = (edge.status ?? "").toLowerCase().replaceAll(" ", "-");
  if (status === "dynamic") return "The target is computed by the program. Static inspection cannot determine its value without execution; the expression and source location remain available.";
  if (status === "ambiguous") return "More than one file matches this reference. Inspect the candidates below; no target has been chosen automatically.";
  if (status === "foreign-only") return "Matching files belong to another project in this archive. They are evidence, not a resolved target for this project.";
  if (status === "unindexed") return "This reference is recognized, but its target kind is not indexed. This does not establish that the file is missing. Inspect the recorded value and source location.";
  if (status === "missing") return "No matching target was found in this project's indexed archive files. The file may be absent or named differently. The recorded value and source location are preserved.";
  return "A target could not be established from the indexed fields. Inspect the recorded value, resolution status and source location below.";
}
