// Browser-local ZIP writer. Source File slices stay bounded.
export const ZIP_PACK_LIMITS = Object.freeze({
  maxEntries: 100,
  maxSourceBytes: 512 * 1024 * 1024,
  maxMemoryBytes: 64 * 1024 * 1024,
  maxStreamBytes: 600 * 1024 * 1024,
  chunkBytes: 128 * 1024,
  maxPathBytes: 1024,
});

function abortIfRequested(signal) {
  if (signal?.aborted) throw new DOMException("ZIP packing canceled.", "AbortError");
}

function pathSegments(raw) {
  if (typeof raw !== "string" || !raw || raw.startsWith("/")
    || raw.includes("\\") || /^[a-z]:/iu.test(raw)
    || new TextEncoder().encode(raw).length > ZIP_PACK_LIMITS.maxPathBytes) {
    throw new Error("Unsafe ZIP path.");
  }
  const segments = raw.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === ".."
      || /[\x00-\x1f\x7f<>:"|?*]/u.test(segment)
      || /[. ]$/u.test(segment)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(segment)) {
      throw new Error("Unsafe ZIP path: " + raw);
    }
  }
  return segments;
}

export function planZipEntries(entries, { maxSourceBytes = ZIP_PACK_LIMITS.maxSourceBytes } = {}) {
  if (!Array.isArray(entries) || !entries.length || entries.length > ZIP_PACK_LIMITS.maxEntries) {
    throw new Error("Select between 1 and 100 local files.");
  }
  const used = new Set();
  const folders = new Map();
  const planned = [];
  let totalBytes = 0;

  for (const entry of entries) {
    const file = entry?.file;
    const size = file?.size;
    if (!file || typeof file.slice !== "function"
      || !Number.isSafeInteger(size) || size < 0 || size > ZIP_PACK_LIMITS.maxSourceBytes) {
      throw new Error("A selected source is missing or too large.");
    }
    const parts = pathSegments(entry.path || entry.name || file.name);
    for (let i = 1; i < parts.length; i += 1) {
      const folder = parts.slice(0, i).join("/");
      const key = folder.toLowerCase();
      if (used.has(key) || (folders.has(key) && folders.get(key) !== folder)) {
        throw new Error("Conflicting ZIP folder path: " + folder);
      }
      folders.set(key, folder);
    }
    const parent = parts.slice(0, -1).join("/");
    const filename = parts.at(-1);
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : "";
    let candidate = parts.join("/");
    let suffix = 2;
    while (used.has(candidate.toLowerCase()) || folders.has(candidate.toLowerCase())) {
      candidate = (parent ? parent + "/" : "") + stem + " (" + suffix++ + ")" + ext;
      if (new TextEncoder().encode(candidate).length > ZIP_PACK_LIMITS.maxPathBytes) {
        throw new Error("ZIP path exceeds length limit.");
      }
    }
    used.add(candidate.toLowerCase());
    totalBytes += size;
    if (totalBytes > maxSourceBytes) throw new Error("Selected files exceed ZIP size limit.");
    planned.push(Object.freeze({ id: entry.id, path: candidate, file, size }));
  }
  return Object.freeze({ items: planned, totalBytes });
}

export function createMemoryZipSink({ maxBytes = ZIP_PACK_LIMITS.maxMemoryBytes } = {}) {
  const chunks = [];
  let size = 0;
  return {
    async write(bytes) {
      if (size + bytes.length > maxBytes) throw new Error("ZIP exceeds browser memory export limit.");
      chunks.push(bytes.slice());
      size += bytes.length;
    },
    async close() {
      return new Blob(chunks, { type: "application/zip" });
    },
    async abort() {
      chunks.length = 0;
      size = 0;
    },
  };
}

export async function packZip(entries, {
  zipApi,
  sink,
  signal,
  maxSourceBytes = ZIP_PACK_LIMITS.maxSourceBytes,
  maxOutputBytes = ZIP_PACK_LIMITS.maxStreamBytes,
  onProgress = () => {},
} = {}) {
  const plan = planZipEntries(entries, { maxSourceBytes });
  if (!zipApi?.Zip || !zipApi?.ZipDeflate) throw new Error("ZIP compression engine unavailable.");
  if (typeof sink?.write !== "function" || typeof sink.close !== "function"
    || typeof sink.abort !== "function") throw new TypeError("ZIP output sink required.");

  let outputBytes = 0;
  let readBytes = 0;
  let completed = false;
  let zipError = null;
  let writing = Promise.resolve();
  let archive;

  try {
    abortIfRequested(signal);
    archive = new zipApi.Zip((error, bytes, final) => {
      if (error) {
        zipError = error;
        return;
      }
      if (bytes?.length && !zipError) {
        outputBytes += bytes.length;
        if (outputBytes > maxOutputBytes) {
          zipError = new Error("ZIP exceeds output size limit.");
          return;
        }
        writing = writing.then(() => sink.write(bytes));
      }
      if (final) completed = true;
    });

    for (const [index, item] of plan.items.entries()) {
      abortIfRequested(signal);
      const stream = new zipApi.ZipDeflate(item.path, { level: 3 });
      archive.add(stream);
      for (let offset = 0; offset < item.size; offset += ZIP_PACK_LIMITS.chunkBytes) {
        abortIfRequested(signal);
        const end = Math.min(item.size, offset + ZIP_PACK_LIMITS.chunkBytes);
        const bytes = new Uint8Array(await item.file.slice(offset, end).arrayBuffer());
        if (bytes.length !== end - offset) throw new Error("Source changed during ZIP packing.");
        abortIfRequested(signal);
        stream.push(bytes, false);
        await writing;
        if (zipError) throw zipError;
        readBytes += bytes.length;
        onProgress({ filesDone: index, filesTotal: plan.items.length,
          bytesDone: readBytes, bytesTotal: plan.totalBytes, path: item.path });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      stream.push(new Uint8Array(0), true);
      await writing;
      if (zipError) throw zipError;
      onProgress({ filesDone: index + 1, filesTotal: plan.items.length,
        bytesDone: readBytes, bytesTotal: plan.totalBytes, path: item.path });
    }
    archive.end();
    await writing;
    if (zipError) throw zipError;
    abortIfRequested(signal);
    if (!completed) throw new Error("ZIP writer did not finish.");
    const output = await sink.close();
    return { output, outputBytes, sourceBytes: plan.totalBytes, files: plan.items.length };
  } catch (error) {
    archive?.terminate?.();
    try { await sink.abort(); } catch { /* Preserve original error. */ }
    throw error;
  }
}
