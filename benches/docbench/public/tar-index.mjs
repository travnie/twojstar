// TAR headers and slices. Inflate gzip containers within a separate byte budget.
const TAR_BLOCK_BYTES = 512;
const TAR_MAX_ENTRIES = 2000;
const TAR_GZIP_LIMIT = 32 * 1024 * 1024;
const TAR_GZIP_CHUNK = 8 * 1024;
const tarTextDecoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export async function decompressGzipTar(blob, signal) {
  if (blob.size > TAR_GZIP_LIMIT) throw new Error("Compressed TAR exceeds the 32 MiB input limit.");
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open gzip-compressed TAR.");
  signal?.throwIfAborted();

  let offset = 0;
  const source = new ReadableStream({
    async pull(controller) {
      if (offset === blob.size) {
        controller.close();
        return;
      }
      // Bound input per native inflate call, including before output accounting.
      const end = Math.min(offset + TAR_GZIP_CHUNK, blob.size);
      const bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
      offset = end;
      if (!signal?.aborted) controller.enqueue(bytes);
    },
  });
  const reader = source.pipeThrough(new DecompressionStream("gzip"), { signal }).getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read().catch(() => {
        signal?.throwIfAborted();
        throw new Error("Gzip decoding failed. The stream is damaged or unsupported.");
      });
      signal?.throwIfAborted();
      if (done) return new Blob(chunks);
      total += value.byteLength;
      if (total > TAR_GZIP_LIMIT) throw new Error("Expanded TAR exceeds the 32 MiB output limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function invalidTar(reason) {
  throw new Error(`TAR index unavailable: ${reason}`);
}

function tarOctal(bytes) {
  const value = String.fromCharCode(...bytes);
  if (!/^ *[0-7]+[\x00 ]*$/u.test(value)) invalidTar("invalid octal header field");
  return Number.parseInt(value, 8);
}

function tarPathField(bytes) {
  const end = bytes.indexOf(0);
  return tarTextDecoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

function tarPath(header, posix, directory) {
  try {
    const prefix = posix ? tarPathField(header.subarray(345, 500)) : "";
    const name = tarPathField(header.subarray(0, 100));
    const fullPath = prefix ? `${prefix}/${name}` : name;
    if (directory && (fullPath === "." || /^(?:\.\/)+$/u.test(fullPath))) return ".";
    const path = fullPath.replace(/^(?:\.\/)+/u, "");
    if (!name || !path || path.startsWith("/") || /^[A-Za-z]:/u.test(path)
      || /(?:^|\/)\.{1,2}(?:\/|$)/u.test(path) || path.includes("//")
      || /[\\\u0000-\u001f\u007f]/u.test(path) || (!directory && path.endsWith("/"))) return "";
    return path;
  } catch {
    return "";
  }
}

export async function readTarIndex(blob, isCurrent = () => true) {
  if (!(blob instanceof Blob) || !Number.isSafeInteger(blob.size)) throw new TypeError("Expected a local Blob.");
  const entries = [];
  let offset = 0;
  let headerCount = 0;
  while (offset + TAR_BLOCK_BYTES <= blob.size) {
    const header = new Uint8Array(await blob.slice(offset, offset + TAR_BLOCK_BYTES).arrayBuffer());
    if (!isCurrent()) throw new DOMException("TAR indexing canceled.", "AbortError");
    if (header.every((byte) => byte === 0)) {
      const next = new Uint8Array(await blob.slice(offset + TAR_BLOCK_BYTES, offset + 2 * TAR_BLOCK_BYTES).arrayBuffer());
      if (next.length !== TAR_BLOCK_BYTES || next.some((byte) => byte !== 0)) invalidTar("invalid end blocks");
      return { entries };
    }
    if (++headerCount > TAR_MAX_ENTRIES) invalidTar("entry limit exceeded");

    const marker = String.fromCharCode(...header.subarray(257, 265));
    const posix = marker === "ustar\x0000";
    if (!posix && marker !== "ustar  \x00") invalidTar("expected a POSIX ustar or GNU TAR header");
    const checksum = header.reduce((sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    if (tarOctal(header.subarray(148, 156)) !== checksum) invalidTar("header checksum mismatch");

    const kind = String.fromCharCode(header[156]);
    if (!"\x0001234567".includes(kind)) invalidTar("extended, sparse or unknown entry type");
    const size = tarOctal(header.subarray(124, 136));
    const directory = kind === "5";
    const regular = kind === "0" || kind === "\x00";
    if (size && !regular && kind !== "7") invalidTar("nonzero size on a special entry");
    const start = offset + TAR_BLOCK_BYTES;
    offset = start + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (!Number.isSafeInteger(offset) || offset > blob.size) invalidTar("entry extends beyond archive");

    const name = regular || directory ? tarPath(header, posix, directory) : "";
    if (directory && name === ".") continue;
    entries.push({ name, directory, safe: Boolean(name), originalSize: size, start });
  }
  invalidTar("end blocks missing");
}
