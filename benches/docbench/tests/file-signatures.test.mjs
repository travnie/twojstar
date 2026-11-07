import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectHeader, inspectLocalFile, signatureFormat, FILE_SIGNATURE_READ_LIMIT } from "../public/file-signatures.mjs";

const bytes = (...parts) => Uint8Array.from(parts.flat());
const fromText = (value) => new TextEncoder().encode(value);
const withAt = (length, offset, value) => {
  const buffer = new Uint8Array(length);
  buffer.set(value, offset);
  return buffer;
};

for (const [label, head, format] of [
  ["ZIP", bytes(0x50, 0x4b, 3, 4), "zip"],
  ["empty ZIP", bytes(0x50, 0x4b, 5, 6), "zip"],
  ["7z", bytes(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c), "sevenz"],
  ["RAR4", bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 7, 0), "rar"],
  ["RAR5", bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 7, 1, 0), "rar"],
  ["TAR", withAt(266, 257, fromText("ustar")), "tar"],
  ["gzip", bytes(0x1f, 0x8b, 8), "gzip"],
  ["bzip2", fromText("BZh9"), "bzip2"],
  ["xz", bytes(0xfd, 0x37, 0x7a, 0x58, 0x5a, 0), "xz"],
  ["zstd", bytes(0x28, 0xb5, 0x2f, 0xfd), "zstd"],
  ["PNG", bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10), "png"],
  ["JPEG", bytes(0xff, 0xd8, 0xff), "jpeg"],
  ["GIF", fromText("GIF89a"), "gif"],
  ["WebP", fromText("RIFF0000WEBP"), "webp"],
  ["raw JXL", bytes(0xff, 0x0a), "jxl"],
  ["container JXL", bytes(0, 0, 0, 12, 0x4a, 0x58, 0x4c, 0x20, 13, 10, 0x87, 10), "jxl"],
  ["AVIF", fromText("\0\0\0\u0018ftypavif\0\0\0\0avif"), "avif"],
  ["HEIC", fromText("\0\0\0\u0018ftypmif1\0\0\0\0heic"), "heic"],
  ["QOI", fromText("qoif"), "qoi"],
  ["TIFF", bytes(0x49, 0x49, 0x2a, 0), "tiff"],
  ["Ogg Opus", fromText(`OggS${"\0".repeat(30)}OpusHead`), "opus"],
  ["Ogg Vorbis", fromText(`OggS${"\0".repeat(30)}vorbis`), "vorbis"],
  ["plain Ogg", fromText(`OggS${"\0".repeat(30)}`), "ogg"],
  ["FLAC", fromText("fLaC"), "flac"],
  ["MP3 ID3", fromText("ID3\u0004\0"), "mp3"],
  ["MP3 frame", bytes(0xff, 0xfb, 0x90, 0x00), "mp3"],
  ["WAV", fromText("RIFF0000WAVE"), "wav"],
  ["AIFF", fromText("FORM0000AIFF"), "aiff"],
  ["M4A", fromText("\0\0\0\u0018ftypM4A \0\0\0\0isom"), "m4a"],
  ["MP4", fromText("\0\0\0\u0018ftypisom\0\0\0\0mp42"), "mp4"],
  ["WebM", bytes(0x1a, 0x45, 0xdf, 0xa3), "webm"],
  ["PDF", fromText("%PDF-1.7"), "pdf"],
  ["SVG", fromText('<?xml version="1.0"?><svg width="2">'), "svg"],
]) {
  test(`signature: ${label}`, () => assert.equal(signatureFormat(head), format));
}

test("actual bytes win over a deceptive extension", () => {
  const item = inspectHeader(bytes(0x50, 0x4b, 3, 4), { name: "photo.jpg", type: "image/jpeg" });
  assert.equal(item.format, "zip");
  assert.equal(item.evidence, "signature");
  assert.equal(item.mismatch, true);
  assert.equal(item.declaredMime, "image/jpeg");
});

test("DOCX reports its ZIP container without a false mismatch", () => {
  const item = inspectHeader(bytes(0x50, 0x4b, 3, 4), { name: "report.docx" });
  assert.equal(item.format, "zip");
  assert.equal(item.mismatch, false);
});

test("Object prototype names are not treated as file format hints", () => {
  for (const name of ["constructor", "notes.constructor", "__proto__", "toString"]) {
    const item = inspectHeader(new Uint8Array(), { name });
    assert.equal(item.format, null, name);
    assert.equal(item.evidence, "unknown", name);
  }
});

test("ftyp-compatible brands never leak into following boxes", () => {
  const ftyp = fromText("\0\0\0\u0014ftypisom\0\0\0\0mp42");
  const freeBox = fromText("\0\0\0\u000cfreeavif");
  const combined = new Uint8Array(ftyp.length + freeBox.length);
  combined.set(ftyp);
  combined.set(freeBox, ftyp.length);
  assert.equal(signatureFormat(combined), "mp4");
});

test("an unknown signature is never invented from raw text", () => {
  const item = inspectHeader(fromText("just content"), { name: "file" });
  assert.equal(item.format, null);
  assert.equal(item.evidence, "unknown");
});

test("file suffix remains a low-confidence hint", () => {
  const item = inspectHeader(new Uint8Array(), { name: "photo.jxl" });
  assert.equal(item.format, "jxl");
  assert.equal(item.evidence, "extension");
});

test("a bare EBML header is reported as a WebM container", () => {
  const item = inspectHeader(bytes(0x1a, 0x45, 0xdf, 0xa3), { name: "talk.webm" });
  assert.equal(item.format, "webm");
  assert.equal(item.family, "media");
});

test("recognized MIME conflicts are independent of filename extensions", () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10);
  assert.equal(inspectHeader(png, { name: "picture.png", type: "image/jpeg" }).mismatch, true);
  assert.equal(inspectHeader(png, { name: "picture.jpg", type: "image/png" }).mismatch, true);
  assert.equal(inspectHeader(png, { name: "picture.png", type: "application/octet-stream" }).mismatch, false);
});

test("Ogg/Opus and MP4/M4A compatible containers do not conflict", () => {
  const opus = fromText(`OggS${"\0".repeat(30)}OpusHead`);
  assert.equal(inspectHeader(opus, { name: "voice.ogg", type: "audio/ogg" }).mismatch, false);
  const mp4 = fromText("\0\0\0\u0018ftypisom\0\0\0\0mp42");
  assert.equal(inspectHeader(mp4, { name: "voice.m4a", type: "audio/mp4" }).mismatch, false);
});

test("dotless filenames do not become extension hints", () => {
  for (const name of ["pdf", "mp3", ".jxl"]) {
    assert.equal(inspectHeader(new Uint8Array(), { name }).format, null, name);
  }
});

test("generic HEIF and QuickTime brands are not mislabeled MP4", () => {
  const heif = fromText("\0\0\0\u0018ftypmif1\0\0\0\0mif1");
  const quickTime = fromText("\0\0\0\u0018ftypqt  \0\0\0\0qt  ");
  const unknown = fromText("\0\0\0\u0018ftypzzzz\0\0\0\0zzzz");
  assert.equal(signatureFormat(heif), "heif");
  assert.equal(signatureFormat(quickTime), "mov");
  assert.equal(signatureFormat(unknown), "isobmff");
});

test("free-format MP3 frames remain detectable", () => {
  assert.equal(signatureFormat(bytes(0xff, 0xfb, 0x00, 0x00)), "mp3");
});

test("file inspection reads only a capped prefix", async () => {
  let requestedEnd = -1;
  const file = {
    name: "recording.opus",
    type: "audio/ogg",
    size: 2 ** 33,
    lastModified: 1234,
    slice(start, end) {
      assert.equal(start, 0);
      requestedEnd = end;
      return new Blob([fromText(`OggS${"\0".repeat(30)}OpusHead`)]);
    },
  };
  const result = await inspectLocalFile(file);
  assert.equal(FILE_SIGNATURE_READ_LIMIT, 4096);
  assert.equal(requestedEnd, 4096);
  assert.equal(result.format, "opus");
  assert.equal(result.size, 2 ** 33);
  assert.equal(result.lastModified, 1234);
});
