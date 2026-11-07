// Read ZIP's central directory only. No inflation, execution or uploads.
export const ZIP_INDEX_LIMITS = Object.freeze({
  maxEntries: 2000,
  maxDirectoryBytes: 2 * 1024 * 1024,
  maxTailBytes: 22 + 65535,
});

function invalid(reason) {
  throw new Error("ZIP index unavailable: " + reason);
}

function safePath(name) {
  if (!name || name.includes("\0") || name.startsWith("/")
    || name.startsWith("\\") || /^[A-Za-z]:/u.test(name)) return false;
  const segments = name.replaceAll("\\", "/").split("/");
  return !segments.includes("..") && !segments.includes(".");
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

  if (diskNumber || directoryDisk || entriesOnDisk !== entryCount) {
    invalid("multi-volume archive not supported");
  }
  if (entryCount === 0xffff || directoryLength === 0xffffffff
    || directoryOffset === 0xffffffff) invalid("ZIP64 index not yet supported");
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

    const name = decoder.decode(central.subarray(offset + 46, offset + 46 + filenameLength));
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
