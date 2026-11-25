// Bounded read adapter for 7z/RAR. A disposable worker per operation.
export const WASM_ARCHIVE_LIMITS = Object.freeze({
  maxInputBytes: 32 * 1024 * 1024,
  maxBufferBytes: 32 * 1024 * 1024,
  maxExtractedBytes: 128 * 1024 * 1024,
  maxMembers: 2000,
  maxBatchBytes: 32 * 1024 * 1024,
  maxBatchEntries: 100,
  timeoutMs: 30000,
});

export function normalizeArchiveMembers(members) {
  if (!Array.isArray(members) || members.length > WASM_ARCHIVE_LIMITS.maxMembers
    || members.some((m, i) => !m || m.unsupported || m.index !== i
      || typeof m.name !== "string" || !Number.isSafeInteger(m.uncompressedSize))) {
    throw new Error("Archive index incomplete, damaged or over its limits.");
  }
  const names = new Map();
  let total = 0;
  const entries = members.map(member => {
    const directory = member.directory === true;
    const name = directory ? member.name.replace(/\/$/u, "") : member.name;
    const safe = !member.special && name.length > 0 && name.length <= 2048
      && !name.startsWith("/") && !name.includes("\\") && !/^[A-Za-z]:/u.test(name)
      && !/[\x00-\x1f\x7f<>:"|?*\p{Bidi_Control}\u200b-\u200d\u2060\ufeff]/u.test(name)
      && name.split("/").length <= 20 && name.split("/").every(part =>
        part && part !== ".." && part !== "." && !/[. ]$/u.test(part)
        && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part));
    const entry = {
      index: member.index, name, directory, safe, special: Boolean(member.special),
      originalSize: member.uncompressedSize, compressedSize: member.compressedSize,
      encrypted: Boolean(member.encrypted), crc: member.crc || "", checksum: Boolean(member.checksum),
    };
    if (entry.originalSize < 0) throw new Error("Unknown archive member size.");
    total += entry.originalSize;
    if (total > WASM_ARCHIVE_LIMITS.maxExtractedBytes) throw new Error("Archive expanded size exceeds 128 MiB.");
    const key = name.normalize("NFC").toLowerCase();
    if (names.has(key)) { entry.safe = false; names.get(key).safe = false; }
    names.set(key, entry);
    return entry;
  });
  return { entries };
}

export function wasmArchiveEntryReason(entry, maxBytes = WASM_ARCHIVE_LIMITS.maxBufferBytes) {
  if (!entry?.safe || entry.directory) return "Not a safe file entry.";
  if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0) return "Unknown entry size.";
  if (entry.originalSize > maxBytes) return "Entry exceeds the decoder limit.";
  if (entry.originalSize && !entry.checksum) return "Entry has no supported integrity checksum.";
  return null;
}

export function validateArchiveOutput(entry, result) {
  if (!result || result.unsupported || result.name !== entry.name
    || !(result.data instanceof Uint8Array) || result.data.byteLength !== entry.originalSize) {
    throw new Error("Entry could not be decoded completely. Check password, format and limits.");
  }
  return result.data;
}

export function wasmArchiveBatchReason(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > WASM_ARCHIVE_LIMITS.maxBatchEntries) {
    return "Batch extraction supports up to 100 entries.";
  }
  let size = 0;
  for (const entry of entries) {
    if (!entry.safe || (!entry.directory && wasmArchiveEntryReason(entry))) return "Unsafe or unsupported archive entry.";
    if (!entry.directory) size += entry.originalSize;
  }
  return size > WASM_ARCHIVE_LIMITS.maxBatchBytes ? "Batch output exceeds 32 MiB." : null;
}

export function validateArchiveBatch(entries, result) {
  if (!Array.isArray(result) || result.length !== entries.length) throw new Error("Archive batch is incomplete.");
  return entries.map((entry, i) => {
    if (entry.directory) {
      if (result[i]?.name !== entry.name || result[i]?.unsupported) throw new Error("Archive directory mismatch.");
      return null;
    }
    return validateArchiveOutput(entry, result[i]);
  });
}

export async function runWasmArchiveJob(file, operation, { entry, entries, password = "", signal } = {}) {
  if (file.size > WASM_ARCHIVE_LIMITS.maxInputBytes) throw new Error("Archive exceeds the 32 MiB input limit.");
  if (operation === "extract" && wasmArchiveEntryReason(entry)) throw new Error(wasmArchiveEntryReason(entry));
  if (operation === "extractAll" && wasmArchiveBatchReason(entries)) throw new Error(wasmArchiveBatchReason(entries));
  signal?.throwIfAborted();
  let worker;
  let blobUrl;
  try {
    if (globalThis.__docbenchArchiveWorkerSource) {
      blobUrl = URL.createObjectURL(new Blob([globalThis.__docbenchArchiveWorkerSource], { type: "text/javascript" }));
    }
    worker = new Worker(blobUrl || "/archive-worker.mjs", { type: "module" });
    const result = await new Promise((resolve, reject) => {
      const finish = (callback, value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        callback(value);
      };
      const abort = () => finish(reject, new DOMException("Canceled.", "AbortError"));
      const timer = setTimeout(() => finish(reject, new Error("Archive decoder timed out.")), WASM_ARCHIVE_LIMITS.timeoutMs);
      signal?.addEventListener("abort", abort, { once: true });
      worker.onmessage = ({ data }) => data.ok
        ? finish(resolve, data.value)
        : finish(reject, new Error(data.error || "Archive decoder failed."));
      worker.onerror = () => finish(reject, new Error("Archive worker failed."));
      worker.onmessageerror = () => finish(reject, new Error("Invalid archive worker response."));
      try {
        const wasmBinary = globalThis.__docbenchArchiveWasmBase64
          ? Uint8Array.from(atob(globalThis.__docbenchArchiveWasmBase64), char => char.charCodeAt(0))
          : undefined;
        worker.postMessage({ file, operation, index: entry?.index, password, wasmBinary },
          wasmBinary ? [wasmBinary.buffer] : []);
      }
      catch (error) { finish(reject, error); }
    });
    signal?.throwIfAborted();
    if (operation === "list") return normalizeArchiveMembers(result);
    if (operation === "extractAll") return validateArchiveBatch(entries, result);
    return validateArchiveOutput(entry, result);
  } finally {
    worker?.terminate();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}
