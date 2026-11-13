import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8, Zip, ZipDeflate } from "fflate";
import { readZipIndex } from "../public/zip-index.mjs";
import { packZip, createMemoryZipSink } from "../public/zip-pack.mjs";
import { ZIP_EXTRACT_LIMITS, zipEntryEligibility, planZipExtraction,
  extractZipEntry, createMemoryExtractSink, createVerifySink } from "../public/zip-extract.mjs";

const zipApi = await import("fflate");
const data = (files, opts) => new Blob([zipSync(files, opts)]);
const extract = async (archive, entry, options = {}) => {
  const index = await readZipIndex(archive);
  const target = entry ?? index.entries[0];
  return extractZipEntry(archive, target, {
    zipApi, directoryOffset: index.directoryOffset, sink: createMemoryExtractSink(),
    ...options,
  });
};

test("ZIP selectively extracts stored and DEFLATE entries with CRC validation", async () => {
  const original = strToU8("one\nwith unicode: zażółć");
  const deflated = data({ "folder/note.txt": original, "ignored.dat": strToU8("ignore") });
  const zip = await readZipIndex(deflated);
  assert.equal(zip.entries.length, 2);
  assert.equal(zip.entries[0].crc32 > 0, true);
  const result = await extract(deflated, zip.entries[0]);
  assert.equal(result.verified, true);
  assert.deepEqual(new Uint8Array(await result.output.arrayBuffer()), original);
  assert.equal(result.path, "folder/note.txt");

  const stored = data({ "raw.bin": [original, { level: 0 }] });
  const storedIndex = await readZipIndex(stored);
  assert.equal(storedIndex.entries[0].method, 0);
  const unpacked = await extract(stored, storedIndex.entries[0]);
  assert.deepEqual(new Uint8Array(await unpacked.output.arrayBuffer()), original);
});

test("ZIP extraction supports data-descriptor archives written by fflate streaming writer", async () => {
  const original = new Blob([strToU8("streamed data")]);
  const packed = await packZip([{
    id: "a", path: "streamed.txt", name: "streamed.txt", size: original.size, file: original,
  }], { zipApi: { Zip, ZipDeflate }, sink: createMemoryZipSink() });
  const index = await readZipIndex(packed.output);
  assert.ok(index.entries[0].flags & 8);
  const result = await extract(packed.output);
  assert.equal(await result.output.text(), "streamed data");
});

test("ZIP rejects a corrupted stored payload before publishing output", async () => {
  const bytes = new Uint8Array(zipSync({ "test.txt": [strToU8("hello"), { level: 0 }] }));
  const index = await readZipIndex(new Blob([bytes]));
  const entry = index.entries[0];
  const localName = new DataView(bytes.buffer).getUint16(26, true);
  bytes[30 + localName] ^= 1;
  let closed = false;
  let aborted = false;
  const sink = {
    async write() {},
    async close() { closed = true; },
    async abort() { aborted = true; },
  };
  await assert.rejects(extractZipEntry(new Blob([bytes]), entry, {
    zipApi, sink, directoryOffset: index.directoryOffset,
  }), /CRC-32 mismatch/u);
  assert.equal(closed, false);
  assert.equal(aborted, true);
});

test("ZIP rejects altered local name and local method mismatch", async () => {
  const bytes = new Uint8Array(zipSync({ "a.txt": strToU8("abc") }));
  const index = await readZipIndex(new Blob([bytes]));
  bytes[30] ^= 1;
  await assert.rejects(extract(new Blob([bytes]), index.entries[0], {
    directoryOffset: index.directoryOffset,
  }), /filename differs/u);
  const changed = new Uint8Array(zipSync({ "a.txt": strToU8("abc") }));
  const ix = await readZipIndex(new Blob([changed]));
  new DataView(changed.buffer).setUint16(8, 0, true);
  await assert.rejects(extract(new Blob([changed]), ix.entries[0], {
    directoryOffset: ix.directoryOffset,
  }), /header mismatch/u);
});

test("ZIP extraction blocks traversal, encryption, symlinks, unsupported methods and bombs", async () => {
  const archive = data({ "safe.txt": strToU8("ok") });
  const { entries, directoryOffset } = await readZipIndex(archive);
  const e = entries[0];
  for (const bad of [
    { ...e, safe: false }, { ...e, name: "../outside" }, { ...e, name: "a/\u202etxt" },
    { ...e, encrypted: true }, { ...e, symlink: true },
    { ...e, zip64: true }, { ...e, method: 99 },
    { ...e, originalSize: 65 * 1024 * 1024 },
    { ...e, compressedSize: 70 * 1024 * 1024 },
    { ...e, diskStart: 1 },
  ]) {
    assert.ok(zipEntryEligibility(bad), JSON.stringify(bad));
    await assert.rejects(extractZipEntry(archive, bad, {
      zipApi, directoryOffset, sink: createVerifySink(),
    }));
  }
  assert.throws(() => planZipExtraction([e, e]), /Duplicate/u);
  assert.throws(() => planZipExtraction([]), /Select/u);
  assert.equal(ZIP_EXTRACT_LIMITS.maxEntryBytes, 64 * 1024 * 1024);
});

test("ZIP abort never publishes incomplete output", async () => {
  const zipped = data({ "large.txt": strToU8("hello".repeat(12000)) });
  const index = await readZipIndex(zipped);
  const controller = new AbortController();
  let closed = false;
  let aborted = false;
  await assert.rejects(extractZipEntry(zipped, index.entries[0], {
    zipApi, directoryOffset: index.directoryOffset,
    signal: controller.signal,
    sink: {
      async write() {},
      async close() { closed = true; },
      async abort() { aborted = true; },
    },
    onProgress: () => controller.abort(),
  }), { name: "AbortError" });
  assert.equal(closed, false);
  assert.equal(aborted, true);
});

test("ZIP verification requires no output allocation and preserves integrity", async () => {
  const zipped = data({ "zero.txt": strToU8(""), "test.txt": strToU8("ABC") });
  const index = await readZipIndex(zipped);
  for (const entry of index.entries) {
    const result = await extractZipEntry(zipped, entry, {
      zipApi, directoryOffset: index.directoryOffset, sink: createVerifySink(),
    });
    assert.equal(result.output, null);
    assert.equal(result.verified, true);
  }
});
