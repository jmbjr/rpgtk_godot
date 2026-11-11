function normalizeZipPaths(zip) {
  const files = Object.create(null);
  for (const entry of Object.values(zip.files)) {
    const path = entry.name.replaceAll("\\", "/");
    if (path.split("/").includes("..") || Object.hasOwn(files, path)) {
      throw new Error("The game ZIP has an invalid or duplicate path after normalizing Windows separators.");
    }
    entry.name = path;
    files[path] = entry;
  }
  zip.files = files;
  return zip;
}

function compoundZip(bytes) {
  if (bytes.length < 16 || bytes[0] !== 77 || bytes[1] !== 90) return null;
  const footer = bytes.length - 12;
  if (String.fromCharCode(...bytes.subarray(footer, footer + 4)) !== "CMP1") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = view.getUint32(footer + 4, true);
  const length = view.getUint32(footer + 8, true);
  if (offset < 2 || length < 22 || offset + length !== footer || view.getUint32(offset, true) !== 0x04034b50) {
    throw new Error("The Toolkit compound game payload is invalid or truncated.");
  }
  return bytes.subarray(offset, footer);
}

export async function openGameArchive(bytes, loadZip) {
  let zip = normalizeZipPaths(await loadZip(bytes));

  // GitHub Actions artifact downloads wrap the uploaded game ZIP in another
  // ZIP. Unwrap exactly one ZIP entry; do not guess among multiple archives or
  // recursively unpack arbitrary nested files.
  const entries = Object.values(zip.files).filter(file => !file.dir);
  if (entries.length === 1 && /\.zip$/i.test(entries[0].name)) {
    const nested = entries[0];
    try {
      zip = normalizeZipPaths(await loadZip(await nested.async("uint8array")));
    } catch (error) {
      throw new Error(`Unable to read nested game ZIP "${nested.name}": ${error.message}`);
    }
  } else if (entries.length > 1 && entries.every(file => /\.zip$/i.test(file.name))) {
    throw new Error("This ZIP contains multiple game ZIPs. Extract it and open the game ZIP you want.");
  }

  const files = Object.values(zip.files);
  const wrapper = files.find(file => !file.dir && file.name.toLowerCase() === "zip.zip");
  const installer = files.some(file => !file.dir && file.name.toLowerCase() === "setup.inf");
  if (!wrapper || !installer || files.some(file => /\.(gam|prg)$/i.test(file.name))) return zip;

  const inner = normalizeZipPaths(await loadZip(await wrapper.async("uint8array")));
  const candidates = [];
  for (const file of Object.values(inner.files)) {
    if (file.dir || !/\.exe$/i.test(file.name)) continue;
    const payload = compoundZip(await file.async("uint8array"));
    if (payload) candidates.push(payload);
  }
  if (candidates.length !== 1) {
    throw new Error("The installer ZIP must contain exactly one readable Toolkit compound game.");
  }
  return normalizeZipPaths(await loadZip(candidates[0]));
}
