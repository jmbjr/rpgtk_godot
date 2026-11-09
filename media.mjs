function tag(bytes, offset, length = 4) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function requireBytes(condition, message) {
  if (!condition) throw new Error(message);
}

function view(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function readGif(bytes) {
  const data = view(bytes);
  const signature = tag(bytes, 0, 6);
  requireBytes(bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(signature), "Invalid GIF header.");
  const width = data.getUint16(6, true);
  const height = data.getUint16(8, true);
  const paletteSize = flags => flags & 0x80 ? 2 ** ((flags & 7) + 1) : 0;
  const globalColors = paletteSize(bytes[10]);
  let offset = 13 + globalColors * 3;
  const frames = [];
  let graphicControl;
  function skipBlocks() {
    while (offset < bytes.length) {
      const size = bytes[offset++];
      if (!size) return;
      offset += size;
    }
    throw new Error("Truncated GIF data blocks.");
  }
  while (offset < bytes.length) {
    const block = bytes[offset++];
    if (block === 0x3b) return { signature, width, height, globalColors, frames };
    if (block === 0x21) {
      const extension = bytes[offset++];
      if (extension === 0xf9) {
        requireBytes(bytes[offset] === 4 && offset + 6 <= bytes.length, "Invalid GIF graphic control extension.");
        graphicControl = {
          delayCentiseconds: data.getUint16(offset + 2, true),
          disposalMethod: (bytes[offset + 1] >>> 2) & 7,
          transparentIndex: bytes[offset + 1] & 1 ? bytes[offset + 4] : null,
        };
      }
      skipBlocks();
      if (extension === 1) graphicControl = undefined;
      continue;
    }
    requireBytes(block === 0x2c && offset + 9 <= bytes.length, "Invalid GIF image descriptor.");
    const flags = bytes[offset + 8];
    const localColors = paletteSize(flags);
    frames.push({
      x: data.getUint16(offset, true), y: data.getUint16(offset + 2, true),
      width: data.getUint16(offset + 4, true), height: data.getUint16(offset + 6, true),
      interlaced: Boolean(flags & 0x40), localColors, ...graphicControl,
    });
    graphicControl = undefined;
    offset += 10 + localColors * 3; // Descriptor, optional palette, LZW code size.
    skipBlocks();
  }
  throw new Error("Missing GIF trailer.");
}

const jpegFrames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
export function readJpeg(bytes) {
  const data = view(bytes);
  requireBytes(bytes[0] === 0xff && bytes[1] === 0xd8, "Invalid JPEG signature.");
  for (let offset = 2; offset < bytes.length;) {
    requireBytes(bytes[offset++] === 0xff, "Invalid JPEG marker.");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    requireBytes(offset + 2 <= bytes.length, "Truncated JPEG segment.");
    const length = data.getUint16(offset);
    requireBytes(length >= 2 && offset + length <= bytes.length, "Invalid JPEG segment length.");
    if (jpegFrames.has(marker)) {
      requireBytes(length >= 8, "Truncated JPEG frame.");
      const componentCount = bytes[offset + 7];
      requireBytes(length === 8 + componentCount * 3, "Invalid JPEG component count.");
      return {
        width: data.getUint16(offset + 5), height: data.getUint16(offset + 3),
        precisionBits: bytes[offset + 2], frameMarker: `0x${marker.toString(16)}`,
        components: Array.from({ length: componentCount }, (_, i) => {
          const at = offset + 8 + i * 3;
          return { id: bytes[at], horizontalSampling: bytes[at + 1] >>> 4,
            verticalSampling: bytes[at + 1] & 15, quantizationTable: bytes[at + 2] };
        }),
      };
    }
    offset += length;
  }
  throw new Error("No JPEG frame header was found.");
}

export function readWave(bytes) {
  const data = view(bytes);
  requireBytes(bytes.length >= 12 && tag(bytes, 0) === "RIFF" && tag(bytes, 8) === "WAVE", "Invalid RIFF/WAVE header.");
  const end = 8 + data.getUint32(4, true);
  requireBytes(end <= bytes.length && end >= 12, "Invalid RIFF length.");
  let format;
  let audioBytes = 0;
  const chunks = [];
  for (let offset = 12; offset < end;) {
    requireBytes(offset + 8 <= end, "Truncated WAVE chunk header.");
    const id = tag(bytes, offset);
    const size = data.getUint32(offset + 4, true);
    const payload = offset + 8;
    requireBytes(payload + size <= end, "Truncated WAVE chunk.");
    chunks.push({ id, size, offset: payload });
    if (id === "fmt ") {
      requireBytes(size >= 16, "Truncated WAVE format.");
      format = {
        encodingTag: data.getUint16(payload, true),
        channels: data.getUint16(payload + 2, true),
        sampleRateHz: data.getUint32(payload + 4, true),
        bytesPerSecond: data.getUint32(payload + 8, true),
        blockAlign: data.getUint16(payload + 12, true),
        bitsPerSample: data.getUint16(payload + 14, true),
      };
    }
    if (id === "data") audioBytes += size;
    offset = payload + size + (size & 1);
  }
  requireBytes(format && chunks.some(chunk => chunk.id === "data"), "WAVE format or data chunk missing.");
  const pcm = [1, 3].includes(format.encodingTag) && format.blockAlign > 0 && format.sampleRateHz > 0;
  const sampleFrames = pcm ? Math.floor(audioBytes / format.blockAlign) : null;
  return { ...format, audioBytes, sampleFrames, durationSeconds: pcm ? sampleFrames / format.sampleRateHz : null, chunks };
}

function midiTrack(bytes) {
  let offset = 0;
  let tick = 0;
  let running = 0;
  let events = 0;
  let noteOnEvents = 0;
  const names = [];
  const instruments = [];
  const tempos = [];
  const channels = new Set();
  const decoder = new TextDecoder("windows-1252");
  function byte() {
    requireBytes(offset < bytes.length, "Truncated MIDI event.");
    return bytes[offset++];
  }
  function variable() {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const part = byte();
      value = value * 128 + (part & 127);
      if (part < 128) return value;
    }
    throw new Error("Invalid MIDI variable length quantity.");
  }
  function payload(length) {
    requireBytes(offset + length <= bytes.length, "Truncated MIDI event payload.");
    const start = offset;
    offset += length;
    return bytes.subarray(start, offset);
  }
  while (offset < bytes.length) {
    tick += variable();
    let status = byte();
    if (status < 128) {
      requireBytes(running, "MIDI event has no running status.");
      offset--;
      status = running;
    }
    events++;
    if (status < 0xf0) {
      running = status;
      channels.add((status & 15) + 1);
      const command = status >>> 4;
      const args = payload(command === 0xc || command === 0xd ? 1 : 2);
      requireBytes(args.every(value => value < 128), "Invalid MIDI channel event data.");
      if (command === 9 && args[1] > 0) noteOnEvents++;
      continue;
    }
    running = 0;
    if (status === 0xff) {
      const kind = byte();
      const value = payload(variable());
      if (kind === 3) names.push(decoder.decode(value));
      if (kind === 4) instruments.push(decoder.decode(value));
      if (kind === 0x51 && value.length === 3) {
        tempos.push({ tick, microsecondsPerQuarter: value[0] * 65536 + value[1] * 256 + value[2] });
      }
      if (kind === 0x2f) break;
    } else if (status === 0xf0 || status === 0xf7) {
      payload(variable());
    } else {
      throw new Error("Unsupported MIDI system event.");
    }
  }
  return { ticks: tick, events, noteOnEvents, channels: [...channels].sort((a, b) => a - b), names, instruments, tempos };
}

export function readMidi(bytes) {
  const data = view(bytes);
  requireBytes(bytes.length >= 14 && tag(bytes, 0) === "MThd", "Invalid MIDI header.");
  const headerLength = data.getUint32(4);
  requireBytes(headerLength >= 6 && 8 + headerLength <= bytes.length, "Invalid MIDI header length.");
  const format = data.getUint16(8);
  const trackCount = data.getUint16(10);
  const division = data.getUint16(12);
  requireBytes(format <= 2 && trackCount > 0 && division > 0, "Invalid MIDI format, tracks, or time division.");
  const timeDivision = division & 0x8000 ?
    { framesPerSecondCode: -data.getInt8(12), ticksPerFrame: bytes[13] } : { ticksPerQuarter: division };
  const tracks = [];
  for (let offset = 8 + headerLength; offset < bytes.length && tracks.length < trackCount;) {
    requireBytes(offset + 8 <= bytes.length, "Truncated MIDI chunk header.");
    const size = data.getUint32(offset + 4);
    const end = offset + 8 + size;
    requireBytes(end <= bytes.length, "Truncated MIDI track.");
    if (tag(bytes, offset) === "MTrk") {
      tracks.push({ number: tracks.length + 1, size, ...midiTrack(bytes.subarray(offset + 8, end)) });
    }
    offset = end;
  }
  requireBytes(tracks.length === trackCount, "MIDI track count does not match the header.");
  return { format, trackCount, timeDivision, tracks };
}

const compoundSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const endOfChain = 0xfffffffe;
export function readCompoundDocument(bytes) {
  const data = view(bytes);
  requireBytes(bytes.length >= 512 && compoundSignature.every((value, i) => bytes[i] === value), "Invalid compound document signature.");
  const minor = data.getUint16(24, true);
  const major = data.getUint16(26, true);
  const sectorShift = data.getUint16(30, true);
  requireBytes(data.getUint16(28, true) === 0xfffe && ((major === 3 && sectorShift === 9) || (major === 4 && sectorShift === 12)),
    "Unsupported compound document header.");
  const sectorSize = 2 ** sectorShift;
  const fatSectorCount = data.getUint32(44, true);
  const directoryFirstSector = data.getUint32(48, true);
  const miniStreamCutoff = data.getUint32(56, true);
  const directory = [];
  if (fatSectorCount > 109) {
    return { container: "CFB", major, minor, sectorSize, fatSectorCount, miniStreamCutoff,
      directoryStatus: "extended DIFAT outside supported layout" };
  }
  function sector(id) {
    const start = (id + 1) * sectorSize;
    requireBytes(start + sectorSize <= bytes.length, "Invalid compound document sector.");
    return start;
  }
  const entriesPerSector = sectorSize / 4;
  const fat = Array.from({ length: fatSectorCount }, (_, i) => sector(data.getUint32(76 + i * 4, true)));
  const seen = new Set();
  const decoder = new TextDecoder("utf-16le");
  let id = directoryFirstSector;
  while (id !== endOfChain) {
    requireBytes(!seen.has(id), "Compound document directory chain contains a loop.");
    seen.add(id);
    const start = sector(id);
    for (let entry = start; entry < start + sectorSize; entry += 128) {
      const type = bytes[entry + 66];
      if (!type) continue;
      const nameLength = data.getUint16(entry + 64, true);
      requireBytes(nameLength >= 2 && nameLength <= 64 && nameLength % 2 === 0, "Invalid compound document entry name.");
      const name = decoder.decode(bytes.subarray(entry, entry + nameLength - 2));
      const size = major === 3 ? data.getUint32(entry + 120, true) : Number(data.getBigUint64(entry + 120, true));
      directory.push({ name, type, size });
    }
    const fatOffset = fat[Math.floor(id / entriesPerSector)];
    requireBytes(fatOffset !== undefined, "Compound document sector is missing from the FAT.");
    id = data.getUint32(fatOffset + (id % entriesPerSector) * 4, true);
  }
  return { container: "CFB", major, minor, sectorSize, fatSectorCount, miniStreamCutoff, directory };
}
