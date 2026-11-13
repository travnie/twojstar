// Local ZIP extraction: central-directory metadata, bounded raw DEFLATE, CRC-32.
// No filesystem traversal, implicit overwrite, network requests or ZIP64 claims.
export const ZIP_EXTRACT_LIMITS = Object.freeze({
  maxEntryBytes: 64 * 1024 * 1024,
  maxCompressedBytes: 64 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxRatio: 500,
  maxEntries: 100,
  chunkBytes: 64 * 1024,
  memoryBytes: 48 * 1024 * 1024,
});

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? value >>> 1 ^ 0xedb88320 : value >>> 1;
  }
  return value >>> 0;
});

function updateCrc(previous, bytes) {
  let crc = previous;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ crc >>> 8;
  return crc >>> 0;
}

function abortIfRequested(signal) {
  if (signal?.aborted) throw new DOMException("ZIP extraction canceled.", "AbortError");
}

function validDestinationPath(path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.startsWith("\\")
    || /^[a-z]:/iu.test(path) || path.length > 2048) return false;
  const segments = path.replaceAll("\\", "/").split("/");
  return segments.length <= 20 && segments.every((segment) =>
    segment && segment !== "." && segment !== ".."
      && !/[\x00-\x1f\x7f<>:"|?*\p{Bidi_Control}\u200b-\u200d\u2060\ufeff]/u.test(segment)
      && !/[. ]$/u.test(segment)
      && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment));
}

export function zipEntryEligibility(entry, limits = ZIP_EXTRACT_LIMITS) {
  if (!entry || entry.directory || !entry.safe || !validDestinationPath(entry.name)) {
    return "Unsafe or non-file archive entry.";
  }
  if (entry.zip64 || entry.localHeaderOffset === 0xffffffff) return "ZIP64 is not supported.";
  if (entry.encrypted || entry.flags & 1) return "Encrypted ZIP entries are not supported.";
  if (entry.symlink) return "Symbolic links cannot be extracted.";
  if (entry.diskStart) return "Multi-volume ZIP is not supported.";
  if (entry.flags & (0x0040 | 0x2000)) return "Unsupported ZIP encryption flags.";
  if (![0, 8].includes(entry.method)) return "Unsupported ZIP compression method.";
  if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0
    || entry.originalSize > limits.maxEntryBytes
    || !Number.isSafeInteger(entry.compressedSize) || entry.compressedSize < 0
    || entry.compressedSize > limits.maxCompressedBytes) return "ZIP entry size limit exceeded.";
  if (entry.originalSize > 0 && !entry.compressedSize) return "Invalid compressed size.";
  if (entry.originalSize > 1024 * 1024
    && entry.originalSize > entry.compressedSize * limits.maxRatio) {
    return "ZIP compression ratio exceeds safety limit.";
  }
  if (!Number.isSafeInteger(entry.localHeaderOffset) || entry.localHeaderOffset < 0
    || !Number.isSafeInteger(entry.nameBytesLength)
    || !Number.isSafeInteger(entry.nameCrc32)
    || !Number.isSafeInteger(entry.crc32)) return "Incomplete ZIP index.";
  return null;
}

export function planZipExtraction(entries, { limits = ZIP_EXTRACT_LIMITS } = {}) {
  if (!Array.isArray(entries) || !entries.length || entries.length > limits.maxEntries) {
    throw new Error("Select between 1 and 100 ZIP entries.");
  }
  let total = 0;
  const names = new Set();
  for (const entry of entries) {
    const reason = zipEntryEligibility(entry, limits);
    if (reason) throw new Error(reason + " " + (entry?.name || ""));
    const key = entry.name.replaceAll("\\", "/").normalize("NFC").toLowerCase();
    if (names.has(key)) throw new Error("Duplicate ZIP destination path.");
    names.add(key);
    total += entry.originalSize;
    if (total > limits.maxTotalBytes) throw new Error("ZIP extraction total limit exceeded.");
  }
  return Object.freeze({ entries: [...entries], totalBytes: total });
}

export function createMemoryExtractSink({ maxBytes = ZIP_EXTRACT_LIMITS.memoryBytes } = {}) {
  const chunks = [];
  let count = 0;
  return {
    async write(bytes) {
      if (count + bytes.length > maxBytes) throw new Error("ZIP download memory limit exceeded.");
      chunks.push(bytes.slice());
      count += bytes.length;
    },
    async close() { return new Blob(chunks); },
    async abort() { chunks.length = 0; count = 0; },
  };
}

export function createVerifySink() {
  return Object.freeze({
    async write() {},
    async close() { return null; },
    async abort() {},
  });
}

async function locateData(blob, entry, directoryOffset, signal) {
  abortIfRequested(signal);
  if (entry.localHeaderOffset + 30 > directoryOffset) throw new Error("Invalid ZIP local header offset.");
  const header = new Uint8Array(await blob.slice(entry.localHeaderOffset,
    entry.localHeaderOffset + 30).arrayBuffer());
  if (header.length !== 30) throw new Error("Truncated ZIP local header.");
  const data = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (data.getUint32(0, true) !== 0x04034b50) throw new Error("Invalid ZIP local header signature.");
  const flags = data.getUint16(6, true);
  const method = data.getUint16(8, true);
  const nameLength = data.getUint16(26, true);
  const extraLength = data.getUint16(28, true);
  if (flags !== entry.flags || method !== entry.method || nameLength !== entry.nameBytesLength) {
    throw new Error("ZIP central/local header mismatch.");
  }
  const nameStart = entry.localHeaderOffset + 30;
  const start = nameStart + nameLength + extraLength;
  if (!Number.isSafeInteger(start) || start + entry.compressedSize > directoryOffset) {
    throw new Error("ZIP data exceeds the central directory boundary.");
  }
  const nameBytes = new Uint8Array(await blob.slice(nameStart,
    nameStart + nameLength).arrayBuffer());
  if (nameBytes.length !== nameLength
    || (updateCrc(0xffffffff, nameBytes) ^ 0xffffffff) >>> 0 !== entry.nameCrc32) {
    throw new Error("ZIP local filename differs from index.");
  }
  return start;
}

export async function extractZipEntry(blob, entry, {
  zipApi, sink = createVerifySink(), signal, directoryOffset, onProgress = () => {},
  limits = ZIP_EXTRACT_LIMITS,
} = {}) {
  const plan = planZipExtraction([entry], { limits });
  if (!blob || typeof blob.slice !== "function" || !Number.isSafeInteger(blob.size)) {
    throw new TypeError("Expected a local ZIP Blob.");
  }
  if (!Number.isSafeInteger(directoryOffset) || directoryOffset < 0 || directoryOffset > blob.size) {
    throw new Error("ZIP index directory boundary missing.");
  }
  if (entry.method === 8 && typeof zipApi?.Inflate !== "function") {
    throw new Error("ZIP DEFLATE decoder unavailable.");
  }
  if (typeof sink?.write !== "function" || typeof sink.close !== "function"
    || typeof sink.abort !== "function") throw new TypeError("ZIP output sink required.");

  let writing = Promise.resolve();
  let outputBytes = 0;
  let inputBytes = 0;
  let crc = 0xffffffff;
  let finalized = entry.method === 0;
  let decoderError = null;
  let committed = false;

  function emit(bytes) {
    if (!bytes?.length || decoderError) return;
    outputBytes += bytes.length;
    if (outputBytes > entry.originalSize || outputBytes > limits.maxEntryBytes) {
      decoderError = new Error("ZIP decompressed size exceeds the declared limit.");
      return;
    }
    crc = updateCrc(crc, bytes);
    writing = writing.then(() => sink.write(bytes));
  }

  try {
    const offset = await locateData(blob, entry, directoryOffset, signal);
    let inflater;
    if (entry.method === 8) {
      inflater = new zipApi.Inflate((bytes, final) => {
        emit(bytes);
        if (final) finalized = true;
      });
    }
    for (let pos = 0; pos < entry.compressedSize; pos += limits.chunkBytes) {
      abortIfRequested(signal);
      const length = Math.min(limits.chunkBytes, entry.compressedSize - pos);
      const input = new Uint8Array(await blob.slice(offset + pos,
        offset + pos + length).arrayBuffer());
      if (input.length !== length) throw new Error("Truncated ZIP compressed data.");
      abortIfRequested(signal);
      if (entry.method === 0) emit(input);
      else inflater.push(input, pos + length === entry.compressedSize);
      await writing;
      if (decoderError) throw decoderError;
      inputBytes += length;
      onProgress({ path: entry.name, inputBytes, inputTotal: entry.compressedSize,
        outputBytes, outputTotal: plan.totalBytes });
      if (pos / limits.chunkBytes % 16 === 15) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    if (entry.method === 8 && !entry.compressedSize) throw new Error("Empty DEFLATE stream.");
    if (!finalized || outputBytes !== entry.originalSize) {
      throw new Error("ZIP entry decompressed size mismatch.");
    }
    const actualCrc = (crc ^ 0xffffffff) >>> 0;
    if (actualCrc !== entry.crc32) throw new Error("ZIP CRC-32 mismatch.");
    abortIfRequested(signal);
    onProgress({ phase: "committing", path: entry.name, inputBytes,
      inputTotal: entry.compressedSize, outputBytes, outputTotal: plan.totalBytes });
    committed = true;
    const output = await sink.close();
    return Object.freeze({ output, verified: true, crc32: actualCrc,
      size: outputBytes, path: entry.name });
  } catch (error) {
    if (!committed) {
      try { await writing; } catch { /* Keep original error. */ }
      try { await sink.abort(); } catch { /* Keep original error. */ }
    }
    throw error;
  }
}
