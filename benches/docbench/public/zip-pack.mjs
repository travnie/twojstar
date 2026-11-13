// Browser-local ZIP writer. Source File slices stay bounded.
export const ZIP_PACK_LIMITS = Object.freeze({
  maxEntries: 100,
  maxSourceBytes: 512 * 1024 * 1024,
  maxMemoryBytes: 64 * 1024 * 1024,
  maxMemorySourceBytes: 56 * 1024 * 1024,
  maxStreamBytes: 600 * 1024 * 1024,
  chunkBytes: 128 * 1024,
  yieldEveryChunks: 16,
  maxPathBytes: 1024,
});

export const ZIP_PACK_PROFILES = Object.freeze({
  smart: Object.freeze({ level: 6, label: "Smart" }),
  store: Object.freeze({ level: null, label: "Store" }),
  fast: Object.freeze({ level: 1, label: "Fast" }),
  balanced: Object.freeze({ level: 3, label: "Balanced" }),
  maximum: Object.freeze({ level: 9, label: "Maximum" }),
});

const ALREADY_COMPRESSED = /\.(?:7z|aab|apk|avi|avif|br|bz2|cbz|crx|docm|docx|epub|flac|gif|gz|heic|heif|ipa|jar|jpe?g|m4a|mkv|mov|mp3|mp4|odp|ods|odt|ogg|opus|pdf|pkpass|png|pptm|pptx|rar|vsix|webm|webp|xlsm|xlsx|xpi|xz|zip|zst)$/iu;

export function zipCompressionFor(path, profile = "smart") {
  const selected = ZIP_PACK_PROFILES[profile];
  if (!Object.hasOwn(ZIP_PACK_PROFILES, profile) || !selected) {
    throw new Error("Unknown ZIP compression profile.");
  }
  const stored = selected.level === null
    || profile === "smart" && ALREADY_COMPRESSED.test(path);
  return Object.freeze({ method: stored ? 0 : 8,
    level: stored ? null : selected.level });
}

function zipMtime(file) {
  const oldest = new Date(1980, 0, 1).getTime();
  const newest = new Date(2099, 11, 31, 23, 59, 58).getTime();
  const recorded = Number.isSafeInteger(file.lastModified) && file.lastModified > 0
    ? file.lastModified : oldest;
  return new Date(Math.max(oldest, Math.min(newest, recorded)));
}

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
    if (folders.has(candidate.toLowerCase())) {
      throw new Error("Conflicting ZIP file and folder path: " + candidate);
    }
    while (used.has(candidate.toLowerCase())) {
      candidate = (parent ? parent + "/" : "") + stem + " (" + suffix++ + ")" + ext;
      if (folders.has(candidate.toLowerCase())) {
        throw new Error("Conflicting ZIP file and folder path: " + candidate);
      }
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
  profile = "smart",
  maxSourceBytes = ZIP_PACK_LIMITS.maxSourceBytes,
  maxOutputBytes = ZIP_PACK_LIMITS.maxStreamBytes,
  onProgress = () => {},
} = {}) {
  const plan = planZipEntries(entries, { maxSourceBytes });
  zipCompressionFor("", profile);
  if (!zipApi?.Zip || !zipApi?.ZipDeflate) {
    throw new Error("ZIP compression engine unavailable.");
  }
  if (typeof sink?.write !== "function" || typeof sink.close !== "function"
    || typeof sink.abort !== "function") throw new TypeError("ZIP output sink required.");

  let outputBytes = 0;
  let readBytes = 0;
  let chunksRead = 0;
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
      const compression = zipCompressionFor(item.path, profile);
      if (compression.method === 0 && !zipApi.ZipPassThrough) {
        throw new Error("ZIP store encoder unavailable.");
      }
      const stream = compression.method === 0
        ? new zipApi.ZipPassThrough(item.path)
        : new zipApi.ZipDeflate(item.path, { level: compression.level });
      stream.mtime = zipMtime(item.file);
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
        if (++chunksRead % ZIP_PACK_LIMITS.yieldEveryChunks === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
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
    onProgress({ phase: "committing", filesDone: plan.items.length,
      filesTotal: plan.items.length, bytesDone: readBytes, bytesTotal: plan.totalBytes });
    const output = await sink.close();
    return { output, outputBytes, sourceBytes: plan.totalBytes, files: plan.items.length };
  } catch (error) {
    archive?.terminate?.();
    try { await sink.abort(); } catch { /* Preserve original error. */ }
    throw error;
  }
}
