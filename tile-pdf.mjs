import { basename, tilePixels } from "./artifacts.mjs";
import { artifactRecord } from "./records.mjs";
import { projectTileCards, orderedTileCards } from "./experiments/dodge-tiles/card-scene.mjs";
import { projectTiles, sha256Text } from "./experiments/dodge-tiles/project.mjs";

const pointsPerInch = 72;
const cardsPerPage = 6;
const ink = "#1c302c";

function label(pdf, text, size, style, x, y, maxWidth) {
  pdf.setFont("helvetica", style).setFontSize(size).setTextColor(ink);
  const firstLine = pdf.splitTextToSize(text, maxWidth)[0];
  const truncated = firstLine !== text;
  let line = firstLine;
  while (truncated && pdf.getTextWidth(line + "...") > maxWidth) line = line.slice(0, -1);
  pdf.text(truncated ? line + "..." : line, x, y);
}

function cropMarks(pdf, x, y, width, height) {
  pdf.setDrawColor(ink).setLineWidth(0.4);
  for (const [cx, dx] of [[x, -1], [x + width, 1]]) {
    for (const [cy, dy] of [[y, -1], [y + height, 1]]) {
      pdf.line(cx + dx * 2, cy, cx + dx * 7, cy);
      pdf.line(cx, cy + dy * 2, cx, cy + dy * 7);
    }
  }
}

function tileArt(tileset, number) {
  const rgba = tilePixels(tileset, number);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] !== 0) continue;
    const pixel = offset / 4;
    const gray = (Math.floor(pixel % 32 / 4) + Math.floor(pixel / 128)) % 2 ? 233 : 249;
    rgba.set([gray, gray, gray, 255], offset);
  }
  return { data: rgba, width: 32, height: 32 };
}

export async function tilesetPdf(tileset, graph) {
  const source = artifactRecord(tileset, graph);
  const { dodge, sidecar } = await projectTiles([source]);
  const scene = projectTileCards(dodge, tileset.path, await sha256Text(JSON.stringify(sidecar)));
  const cards = orderedTileCards(scene, sidecar.tileBindings);
  const { jsPDF } = await import("./vendor/jspdf/jspdf.mjs");
  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true, putOnlyUsedFonts: true });
  const name = basename(tileset.path);
  const pages = Math.ceil(cards.length / cardsPerPage);
  pdf.setProperties({ title: `${name} - Toolkit tile cards` });

  for (const [index, { tileNumber, dimensions }] of cards.entries()) {
    const slot = index % cardsPerPage;
    if (slot === 0) {
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        pdf.addPage();
      }
      label(pdf, "Toolkit tile reference cards", 20, "bold", 24, 40, 564);
      label(pdf, tileset.path, 11, "normal", 24, 58, 564);
      label(pdf, "US Letter / Actual size (100%) / Trim at the crop marks", 10, "normal", 24, 75, 564);
      label(pdf, `Page ${Math.floor(index / cardsPerPage) + 1} of ${pages}`, 10, "normal", 24, 757, 564);
    }

    const width = dimensions.width * pointsPerInch;
    const height = dimensions.height * pointsPerInch;
    const x = 18 + (slot % 3) * (width + 18);
    const y = 105 + Math.floor(slot / 3) * (height + 24);
    pdf.setFillColor("#fbf6e9").rect(x, y, width, height, "F");
    pdf.setFillColor(ink).rect(x, y, width, 6, "F");
    label(pdf, "RPG TOOLKIT 2 / TILE REFERENCE", 7, "normal", x + 12, y + 22, width - 24);
    label(pdf, `Tile ${tileNumber}`, 19, "bold", x + 12, y + 45, width - 24);
    const artSize = width - 30;
    pdf.setFillColor(ink).rect(x + 14, y + 64, artSize + 2, artSize + 2, "F");
    pdf.addImage(tileArt(tileset, tileNumber), "RGBA", x + 15, y + 65, artSize, artSize, `tile-${tileNumber}`);
    label(pdf, name, 9, "normal", x + 12, y + height - 15, width - 24);
    cropMarks(pdf, x, y, width, height);
  }
  return pdf.output("blob");
}
