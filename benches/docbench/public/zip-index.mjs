// Read ZIP's central directory only. No inflation, execution or uploads.
export const ZIP_INDEX_LIMITS = Object.freeze({
  maxEntries: 2000,
  maxDirectoryBytes: 2 * 1024 * 1024,
  maxTailBytes: 22 + 65535,
});

function invalid(reason) {
  throw new Error(`ZIP index unavailable: ${reason}`);
}

function safePath(name) {
  if (!name || /[\u0000-\u001f\u007f]/u.test(name) || name.startsWith("/")
    || name.startsWith("\\") || /^[A-Za-z]:/u.test(name)) return false;
  const segments = name.replaceAll("\\", "/").split("/");
  return !segments.includes("..") && !segments.includes(".");
}

const CP437_HIGH = "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";

function decodeCp437(bytes) {
  return Array.from(bytes, (byte) => byte < 128
    ? String.fromCharCode(byte) : CP437_HIGH[byte - 128]).join("");
}

function nameChecksum(bytes) {
  let result = 0xffffffff;
  for (const byte of bytes) {
    result ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      result = result & 1 ? (result >>> 1) ^ 0xedb88320 : result >>> 1;
    }
  }
  return (result ^ 0xffffffff) >>> 0;
}

function unicodePathExtra(bytes, rawName) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let position = 0; position + 4 <= bytes.length;) {
    const id = view.getUint16(position, true);
    const length = view.getUint16(position + 2, true);
    position += 4;
    if (position + length > bytes.length) return null;
    if (id === 0x7075 && length >= 5 && bytes[position] === 1
      && view.getUint32(position + 1, true) === nameChecksum(rawName)) {
      try {
        return new TextDecoder("utf-8", { fatal: true })
          .decode(bytes.subarray(position + 5, position + length));
      } catch {
        return null;
      }
    }
    position += length;
  }
  return null;
}

export async function readZipIndex(blob) {
  if (!blob || typeof blob.slice !== "function" || !Number.isSafeInteger(blob.size)) {
    throw new TypeError("Expected a local Blob.");
  }
  if (blob.size < 22) invalid("end record missing");

  const tailLength = Math.min(blob.size, ZIP_INDEX_LIMITS.maxTailBytes);
  const tail = new Uint8Array(await blob.slice(blob.size - tailLength).arrayBuffer());
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let endIndex = -1;

  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) !== 0x06054b50) continue;
    const commentLength = view.getUint16(index + 20, true);
    if (index + 22 + commentLength === tail.length) {
      endIndex = index;
      break;
    }
  }
  if (endIndex < 0) invalid("end record missing or trailing data");

  const diskNumber = view.getUint16(endIndex + 4, true);
  const directoryDisk = view.getUint16(endIndex + 6, true);
  const entriesOnDisk = view.getUint16(endIndex + 8, true);
  const entryCount = view.getUint16(endIndex + 10, true);
  const directoryLength = view.getUint32(endIndex + 12, true);
  const directoryOffset = view.getUint32(endIndex + 16, true);

  if (entryCount === 0xffff || entriesOnDisk === 0xffff
    || directoryLength === 0xffffffff || directoryOffset === 0xffffffff) {
    invalid("ZIP64 index not yet supported");
  }
  if (diskNumber || directoryDisk || entriesOnDisk !== entryCount) {
    invalid("multi-volume archive not supported");
  }
  if (entryCount > ZIP_INDEX_LIMITS.maxEntries) invalid("entry limit exceeded");
  if (directoryLength > ZIP_INDEX_LIMITS.maxDirectoryBytes) invalid("directory size limit exceeded");
  const eocdOffset = blob.size - tailLength + endIndex;
  if (directoryOffset + directoryLength > eocdOffset) invalid("invalid central directory offset");

  const central = new Uint8Array(await blob.slice(
    directoryOffset, directoryOffset + directoryLength,
  ).arrayBuffer());
  if (central.length !== directoryLength) invalid("truncated central directory");

  const data = new DataView(central.buffer, central.byteOffset, central.byteLength);
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const entries = [];
  let offset = 0;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (offset + 46 > central.length || data.getUint32(offset, true) !== 0x02014b50) {
      invalid("malformed central directory");
    }
    const flags = data.getUint16(offset + 8, true);
    const method = data.getUint16(offset + 10, true);
    const compressedSize = data.getUint32(offset + 20, true);
    const originalSize = data.getUint32(offset + 24, true);
    const filenameLength = data.getUint16(offset + 28, true);
    const extraLength = data.getUint16(offset + 30, true);
    const commentLength = data.getUint16(offset + 32, true);
    const entryEnd = offset + 46 + filenameLength + extraLength + commentLength;
    if (entryEnd > central.length || !filenameLength) invalid("invalid entry fields");

    const rawName = central.subarray(offset + 46, offset + 46 + filenameLength);
    const extras = central.subarray(offset + 46 + filenameLength, offset + 46 + filenameLength + extraLength);
    const name = unicodePathExtra(extras, rawName)
      || (flags & 0x800 ? decoder.decode(rawName) : decodeCp437(rawName));
    entries.push({
      name,
      directory: name.endsWith("/"),
      safe: safePath(name),
      encrypted: Boolean(flags & 1),
      utf8: Boolean(flags & 0x800),
      method,
      compressedSize,
      originalSize,
      zip64: compressedSize === 0xffffffff || originalSize === 0xffffffff,
    });
    offset = entryEnd;
  }
  if (offset !== central.length) invalid("central directory length mismatch");
  return { entries, count: entries.length, indexedBytes: tail.length + central.length };
}
