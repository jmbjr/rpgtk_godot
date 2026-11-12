// Synthetic, *renderable* companion images for the Toolkit 2 test archive.
// Source-owned diagnostic media, not claims about historical Toolkit authors.
import { deflateSync } from "node:zlib";

const width = 16;
const height = 16;
const rgb = (x, y) => {
  if (x === 0 && y === 0) return [255, 70, 70]; // top-left red
  if (x === width - 1 && y === 0) return [75, 209, 113]; // top-right green
  if (x === 0 && y === height - 1) return [73, 160, 255]; // bottom-left blue
  if (x === width - 1 && y === height - 1) return [255, 213, 67]; // bottom-right yellow
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return [200, 128, 245];
  if ((x === 7 || x === 8) && y >= 4 && y <= 11) return [255, 255, 255];
  if ((y === 7 || y === 8) && x >= 4 && x <= 11) return [255, 255, 255];
  return (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? [35, 49, 72] : [177, 205, 226];
};

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const kind = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([kind, data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}
const pngHeader = Buffer.alloc(13);
pngHeader.writeUInt32BE(width, 0);
pngHeader.writeUInt32BE(height, 4);
pngHeader[8] = 8; // 8 bits per channel
pngHeader[9] = 2; // RGB; no alpha
const pngRaw = Buffer.alloc(height * (1 + width * 3));
for (let y = 0; y < height; y++) {
  const offset = y * (1 + width * 3);
  pngRaw[offset] = 0; // no PNG row filter
  for (let x = 0; x < width; x++)
    Buffer.from(rgb(x, y)).copy(pngRaw, offset + 1 + 3 * x);
}
export const diagnosticPng = Buffer.concat([
  Buffer.from("89504e470d0a1a0a", "hex"),
  pngChunk("IHDR", pngHeader),
  pngChunk("IDAT", deflateSync(pngRaw)),
  pngChunk("IEND", Buffer.alloc(0)),
]);

const stride = (width * 3 + 3) & ~3;
const diagnosticBmpBuffer = Buffer.alloc(54 + stride * height);
diagnosticBmpBuffer.write("BM", 0);
diagnosticBmpBuffer.writeUInt32LE(diagnosticBmpBuffer.length, 2);
diagnosticBmpBuffer.writeUInt32LE(54, 10); // pixel data offset
diagnosticBmpBuffer.writeUInt32LE(40, 14); // BITMAPINFOHEADER
diagnosticBmpBuffer.writeInt32LE(width, 18);
diagnosticBmpBuffer.writeInt32LE(height, 22); // positive => bottom-up rows
diagnosticBmpBuffer.writeUInt16LE(1, 26); // one color plane
diagnosticBmpBuffer.writeUInt16LE(24, 28); // BGR24
diagnosticBmpBuffer.writeUInt32LE(stride * height, 34);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const [r, g, b] = rgb(x, y);
    const at = 54 + (height - 1 - y) * stride + x * 3;
    diagnosticBmpBuffer[at] = b;
    diagnosticBmpBuffer[at + 1] = g;
    diagnosticBmpBuffer[at + 2] = r;
  }
export const diagnosticBmp = diagnosticBmpBuffer;

export const mediaFixtureSignature = {
  width, height, pngColorType: 2, bmpBitsPerPixel: 24,
  corners: {
    topLeft: [255, 70, 70], topRight: [75, 209, 113],
    bottomLeft: [73, 160, 255], bottomRight: [255, 213, 67],
  },
};
