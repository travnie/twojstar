// Bounded, read-only file signature inspection. No uploads or full-file reads.
const HEAD_LIMIT = 4096;

const formats = Object.freeze({
  zip: ["archive", "ZIP"], sevenz: ["archive", "7z"], rar: ["archive", "RAR"],
  tar: ["archive", "TAR"], gzip: ["archive", "gzip"], bzip2: ["archive", "bzip2"],
  xz: ["archive", "XZ"], zstd: ["archive", "Zstandard"],
  jpeg: ["image", "JPEG"], png: ["image", "PNG"], gif: ["image", "GIF"],
  webp: ["image", "WebP"], avif: ["image", "AVIF"], heic: ["image", "HEIC"],
  heif: ["image", "HEIF"],
  jxl: ["image", "JPEG XL"], qoi: ["image", "QOI"], bmp: ["image", "BMP"],
  tiff: ["image", "TIFF"], ico: ["image", "ICO"], svg: ["image", "SVG"],
  opus: ["audio", "Opus"], vorbis: ["audio", "Vorbis"],
  flac: ["audio", "FLAC"], mp3: ["audio", "MP3"], wav: ["audio", "WAV"],
  aiff: ["audio", "AIFF"], m4a: ["media", "M4A/MP4"],
  ogg: ["media", "Ogg"], webm: ["media", "WebM"], mp4: ["media", "MP4"],
  mov: ["media", "QuickTime"], isobmff: ["media", "ISO-BMFF"],
  pdf: ["document", "PDF"], docx: ["document", "DOCX"],
  txt: ["document", "Text"], json: ["document", "JSON"],
});

const extensionHints = Object.freeze({
  zip: "zip", cbz: "zip", jar: "zip", apk: "zip", epub: "zip",
  "7z": "sevenz", rar: "rar", tar: "tar", tgz: "gzip", gz: "gzip",
  bz2: "bzip2", tbz2: "bzip2", xz: "xz", txz: "xz", zst: "zstd",
  zstd: "zstd", jpeg: "jpeg", jpg: "jpeg", jpe: "jpeg",
  png: "png", apng: "png", gif: "gif", webp: "webp", avif: "avif",
  heic: "heic", heif: "heif", jxl: "jxl", qoi: "qoi",
  bmp: "bmp", tif: "tiff", tiff: "tiff", ico: "ico", svg: "svg",
  opus: "opus", oga: "ogg", ogg: "ogg", flac: "flac",
  mp3: "mp3", wav: "wav", wave: "wav", aif: "aiff", aiff: "aiff",
  m4a: "m4a", m4b: "m4a", mp4: "mp4", mov: "mov", webm: "webm",
  pdf: "pdf", docx: "docx", txt: "txt", json: "json",
});

function starts(bytes, values, offset = 0) {
  return offset + values.length <= bytes.length
    && values.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes, start, length) {
  if (start + length > bytes.length) return "";
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function hasAscii(bytes, needle, max = HEAD_LIMIT) {
  const limit = Math.min(bytes.length, max);
  for (let i = 0; i + needle.length <= limit; i += 1) {
    if (ascii(bytes, i, needle.length) === needle) return true;
  }
  return false;
}

function mp3Frame(bytes) {
  if (bytes.length < 4) return false;
  const layer = (bytes[1] >>> 1) & 3;
  const bitrateIndex = (bytes[2] >>> 4) & 15;
  const sampleRateIndex = (bytes[2] >>> 2) & 3;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
    && (bytes[1] & 0x18) !== 0x08 && layer !== 0
    && bitrateIndex !== 15 && sampleRateIndex !== 3;
}

export function signatureFormat(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (starts(bytes, [0x50, 0x4b, 3, 4]) || starts(bytes, [0x50, 0x4b, 5, 6])
    || starts(bytes, [0x50, 0x4b, 7, 8])) return "zip";
  if (starts(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "sevenz";
  if (starts(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 7, 0])) return "rar";
  if (starts(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 7, 1, 0])) return "rar";
  if (ascii(bytes, 257, 5) === "ustar") return "tar";
  if (starts(bytes, [0x1f, 0x8b, 8])) return "gzip";
  if (ascii(bytes, 0, 3) === "BZh" && bytes[3] >= 0x31 && bytes[3] <= 0x39) return "bzip2";
  if (starts(bytes, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0])) return "xz";
  if (starts(bytes, [0x28, 0xb5, 0x2f, 0xfd])) return "zstd";
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])) return "png";
  if (starts(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (starts(bytes, [0xff, 0x0a])) return "jxl";
  if (starts(bytes, [0, 0, 0, 12, 0x4a, 0x58, 0x4c, 0x20, 13, 10, 0x87, 10])) return "jxl";
  if (ascii(bytes, 0, 4) === "qoif") return "qoi";
  if (ascii(bytes, 0, 2) === "BM") return "bmp";
  if (starts(bytes, [0x49, 0x49, 0x2a, 0]) || starts(bytes, [0x4d, 0x4d, 0, 0x2a])
    || starts(bytes, [0x49, 0x49, 0x2b, 0]) || starts(bytes, [0x4d, 0x4d, 0, 0x2b])) return "tiff";
  if (starts(bytes, [0, 0, 1, 0])) return "ico";
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === "ftyp") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const declaredSize = view.getUint32(0, false);
    let brandOffset = 8;
    let boxSize = declaredSize;
    if (declaredSize === 1) {
      if (bytes.length < 24) return "mp4";
      const extendedSize = view.getBigUint64(8, false);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return "mp4";
      boxSize = Number(extendedSize);
      brandOffset = 16;
    }
    if (boxSize !== 0 && boxSize < brandOffset + 8) return "mp4";
    const boxEnd = Math.min(bytes.length, boxSize || bytes.length, 512);
    const brands = [];
    for (let index = brandOffset; index + 4 <= boxEnd; index += 4) {
      if (index !== brandOffset + 4) brands.push(ascii(bytes, index, 4));
    }
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "avif";
    if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis"].includes(brand))) return "heic";
    if (brands.some((brand) => ["mif1", "msf1", "hevm", "hevs"].includes(brand))) return "heif";
    if (brands.some((brand) => brand === "M4A " || brand === "M4B ")) return "m4a";
    if (brands.includes("qt  ")) return "mov";
    if (brands.some((brand) => ["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "].includes(brand))) return "mp4";
    return "isobmff";
  }
  if (ascii(bytes, 0, 4) === "OggS") {
    if (hasAscii(bytes, "OpusHead", 512)) return "opus";
    if (hasAscii(bytes, "vorbis", 512)) return "vorbis";
    return "ogg";
  }
  if (ascii(bytes, 0, 4) === "fLaC") return "flac";
  if (ascii(bytes, 0, 3) === "ID3" || mp3Frame(bytes)) return "mp3";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") return "wav";
  if (ascii(bytes, 0, 4) === "FORM" && ["AIFF", "AIFC"].includes(ascii(bytes, 8, 4))) return "aiff";
  if (starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (ascii(bytes, 0, 5) === "%PDF-") return "pdf";
  const text = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^\uFEFF/u, "").trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/iu.test(text)) return "svg";
  return null;
}

function filenameHint(filename) {
  const name = String(filename || "").replaceAll("\\", "/").split("/").at(-1).toLowerCase();
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : "";
  return Object.hasOwn(extensionHints, extension) ? extensionHints[extension] : null;
}

const mimeHints = Object.freeze({
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-7z-compressed": "sevenz",
  "application/vnd.rar": "rar",
  "application/x-rar-compressed": "rar",
  "image/jpeg": "jpeg", "image/png": "png", "image/gif": "gif",
  "image/webp": "webp", "image/avif": "avif", "image/heic": "heic",
  "image/heif": "heif", "image/jxl": "jxl", "image/svg+xml": "svg",
  "audio/mpeg": "mp3", "audio/flac": "flac", "audio/x-flac": "flac",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
  "application/ogg": "ogg", "audio/opus": "opus", "audio/webm": "webm",
  "video/webm": "webm", "video/mp4": "mp4", "audio/mp4": "m4a",
});

function compatibleFormat(signature, hint) {
  if (!signature || !hint || signature === hint) return true;
  if (signature === "zip" && hint === "docx") return true;
  if (["opus", "vorbis"].includes(signature) && hint === "ogg") return true;
  if (signature === "ogg" && ["opus", "vorbis"].includes(hint)) return true;
  if (["mp4", "m4a"].includes(signature) && ["mp4", "m4a"].includes(hint)) return true;
  if (["heic", "heif"].includes(signature) && ["heic", "heif"].includes(hint)) return true;
  if (signature === "isobmff" && ["mp4", "m4a", "mov", "heic", "heif", "avif"].includes(hint)) return true;
  return false;
}

export function inspectHeader(input, { name = "", type = "" } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const signature = signatureFormat(bytes);
  const hint = filenameHint(name);
  const selected = signature || hint || null;
  const declaredMime = String(type || "");
  const normalizedMime = declaredMime.split(";", 1)[0].trim().toLowerCase();
  const mimeHint = Object.hasOwn(mimeHints, normalizedMime) ? mimeHints[normalizedMime] : null;
  return {
    format: selected,
    family: selected ? formats[selected][0] : "unknown",
    label: selected ? formats[selected][1] : "Unknown",
    evidence: signature ? "signature" : hint ? "extension" : "unknown",
    signature,
    extensionHint: hint,
    declaredMime,
    mimeHint,
    mismatch: Boolean(signature && (!compatibleFormat(signature, hint)
      || !compatibleFormat(signature, mimeHint))),
    bytesInspected: bytes.length,
  };
}

export async function inspectLocalFile(file) {
  if (!file || typeof file.slice !== "function") {
    throw new TypeError("Expected a File or Blob with slice()");
  }
  const head = new Uint8Array(await file.slice(0, HEAD_LIMIT).arrayBuffer());
  return {
    ...inspectHeader(head, { name: file.name, type: file.type }),
    name: String(file.name || ""),
    size: Number(file.size),
    lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null,
  };
}

export const FILE_SIGNATURE_READ_LIMIT = HEAD_LIMIT;
