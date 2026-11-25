// TAR headers and slices. Inflate gzip containers within a separate byte budget.
const TAR_BLOCK_BYTES = 512;
const TAR_MAX_ENTRIES = 2000;
const PAX_HEADER_LIMIT = 64 * 1024;
const PAX_TOTAL_LIMIT = 2 * 1024 * 1024;
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

function paxDecimal(bytes, limit, reason) {
  if (bytes.length === 0) invalidTar(reason);
  let value = 0;
  for (const byte of bytes) {
    if (byte < 48 || byte > 57) invalidTar(reason);
    value = value * 10 + (byte - 48);
    if (value > limit) invalidTar(reason);
  }
  return value;
}

function readPaxFields(bytes, fields) {
  for (let offset = 0; offset < bytes.length;) {
    const space = bytes.indexOf(32, offset);
    if (space < 0) invalidTar("invalid PAX record length");
    const length = paxDecimal(bytes.subarray(offset, space), bytes.length - offset, "invalid PAX record length");
    const end = offset + length;
    if (end <= space + 3 || bytes[end - 1] !== 10) invalidTar("malformed PAX record");
    const record = bytes.subarray(space + 1, end - 1);
    const equals = record.indexOf(61);
    if (equals <= 0) invalidTar("malformed PAX keyword");
    const key = tarTextDecoder.decode(record.subarray(0, equals));
    const value = record.subarray(equals + 1);
    // Sparse formats change the interpretation of the stored file bytes.
    if (key.startsWith("GNU.sparse.") || key === "SCHILY.realsize" || key === "SUN.holesdata"
      || (key === "SCHILY.filetype" && tarTextDecoder.decode(value) === "sparse")) {
      invalidTar("sparse PAX entries are unsupported");
    }
    if (key === "path" || key === "size" || key === "hdrcharset") fields.set(key, value);
    offset = end;
  }
}

function tarPathField(bytes) {
  const end = bytes.indexOf(0);
  return tarTextDecoder.decode(end === -1 ? bytes : bytes.subarray(0, end));
}

function tarPath(header, posix, directory, paxPath, paxCharset) {
  try {
    let fullPath;
    if (paxPath !== undefined) {
      const charset = paxCharset && tarTextDecoder.decode(paxCharset);
      if (charset && charset !== "ISO-IR 10646 2000 UTF-8" && charset !== "UTF-8") return "";
      fullPath = tarTextDecoder.decode(paxPath);
    } else {
      const name = tarPathField(header.subarray(0, 100));
      if (!name) return "";
      const prefix = posix ? tarPathField(header.subarray(345, 500)) : "";
      fullPath = prefix ? `${prefix}/${name}` : name;
    }
    if (directory && (fullPath === "." || /^(?:\.\/)+$/u.test(fullPath))) return ".";
    const path = fullPath.replace(/^(?:\.\/)+/u, "");
    if (!path || path.startsWith("/") || /^[A-Za-z]:/u.test(path)
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
  const globalPax = new Map();
  let nextPax;
  let paxBytes = 0;
  let offset = 0;
  let headerCount = 0;
  while (offset + TAR_BLOCK_BYTES <= blob.size) {
    const header = new Uint8Array(await blob.slice(offset, offset + TAR_BLOCK_BYTES).arrayBuffer());
    if (!isCurrent()) throw new DOMException("TAR indexing canceled.", "AbortError");
    if (header.every((byte) => byte === 0)) {
      if (nextPax) invalidTar("PAX header has no following entry");
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
    const pax = posix && (kind === "x" || kind === "g");
    if (!pax && !"\x0001234567".includes(kind)) invalidTar("extended, sparse or unknown entry type");
    const paxSize = pax ? undefined : nextPax?.get("size") ?? globalPax.get("size");
    const size = paxSize === undefined ? tarOctal(header.subarray(124, 136))
      : paxDecimal(paxSize, Number.MAX_SAFE_INTEGER, "invalid PAX file size");
    const directory = kind === "5";
    const regular = kind === "0" || kind === "\x00";
    // PAX hard links can carry data. Skip it along with the link.
    const linkData = posix && kind === "1";
    if (size && !pax && !regular && !linkData && kind !== "7") invalidTar("nonzero size on a special entry");
    const start = offset + TAR_BLOCK_BYTES;
    offset = start + Math.ceil(size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    if (!Number.isSafeInteger(offset) || offset > blob.size) invalidTar("entry extends beyond archive");

    if (pax) {
      if (!size) invalidTar("empty PAX header");
      paxBytes += size;
      if (size > PAX_HEADER_LIMIT || paxBytes > PAX_TOTAL_LIMIT) invalidTar("PAX metadata limit exceeded");
      const data = new Uint8Array(await blob.slice(start, start + size).arrayBuffer());
      if (!isCurrent()) throw new DOMException("TAR indexing canceled.", "AbortError");
      const fields = kind === "g" ? globalPax : (nextPax ??= new Map());
      readPaxFields(data, fields);
      continue;
    }

    const paxPath = nextPax?.get("path") ?? globalPax.get("path");
    const paxCharset = nextPax?.get("hdrcharset") ?? globalPax.get("hdrcharset");
    nextPax = undefined;
    const name = regular || directory ? tarPath(header, posix, directory, paxPath, paxCharset) : "";
    if (directory && name === ".") continue;
    entries.push({ name, directory, safe: Boolean(name), originalSize: size, start });
  }
  invalidTar("end blocks missing");
}
