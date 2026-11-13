import assert from "node:assert/strict";
import test from "node:test";
import { Zip, ZipDeflate, ZipPassThrough, unzipSync } from "fflate";
import { readZipIndex } from "../public/zip-index.mjs";
import { ZIP_PACK_LIMITS, ZIP_PACK_PROFILES, zipCompressionFor,
  planZipEntries, createMemoryZipSink, packZip } from "../public/zip-pack.mjs";

const zipApi = { Zip, ZipDeflate, ZipPassThrough };
const source = (path, content, id = path) => {
  const file = new Blob([content]);
  return { id, path, file, size: file.size };
};

test("ZIP packs selected local files with folder paths and collision-safe names", async () => {
  const entries = [
    source("notes.txt", "first", "a"),
    source("notes.txt", "second", "b"),
    source("folder/zażółć.txt", "unicode"),
    source("folder/.env", "KEY=yes"),
    source("empty.txt", ""),
  ];
  const names = planZipEntries(entries).items.map((entry) => entry.path);
  assert.deepEqual(names, ["notes.txt", "notes (2).txt", "folder/zażółć.txt", "folder/.env", "empty.txt"]);

  const updates = [];
  const result = await packZip(entries, {
    zipApi, sink: createMemoryZipSink(), onProgress: (progress) => updates.push(progress),
  });
  assert.equal(result.files, entries.length);
  assert.equal(result.output.type, "application/zip");
  assert.ok(result.output.size > 0);
  const unpacked = unzipSync(new Uint8Array(await result.output.arrayBuffer()));
  for (const [name, expected] of [["notes.txt", "first"], ["notes (2).txt", "second"],
    ["folder/zażółć.txt", "unicode"], ["folder/.env", "KEY=yes"], ["empty.txt", ""]]) {
    assert.equal(new TextDecoder().decode(unpacked[name]), expected, name);
  }
  const index = await readZipIndex(result.output);
  assert.equal(index.count, 5);
  assert.ok(index.entries.every((entry) => entry.safe && !entry.encrypted));
  assert.equal(updates.at(-1).filesDone, 5);
});

test("ZIP compression profiles produce valid stored/DEFLATE output", async () => {
  const entries = [
    source("photo.jpg", new Uint8Array([1, 2, 3, 4])),
    source("note.txt", "A long line of text that should compress. ".repeat(200)),
  ];
  const choices = ["smart", "store", "fast", "balanced", "maximum"];
  assert.deepEqual(Object.keys(ZIP_PACK_PROFILES), choices);
  for (const profile of choices) {
    const output = await packZip(entries, {
      zipApi, sink: createMemoryZipSink(), profile,
    });
    const indexed = await readZipIndex(output.output);
    assert.equal(indexed.count, 2);
    assert.equal(indexed.entries[0].method, profile === "smart" || profile === "store" ? 0 : 8);
    assert.equal(indexed.entries[1].method, profile === "store" ? 0 : 8);
    const unpacked = unzipSync(new Uint8Array(await output.output.arrayBuffer()));
    assert.deepEqual(unpacked["photo.jpg"], new Uint8Array([1, 2, 3, 4]));
    assert.equal(new TextDecoder().decode(unpacked["note.txt"]),
      "A long line of text that should compress. ".repeat(200));
  }
  assert.equal(zipCompressionFor("image.webp", "smart").method, 0);
  assert.equal(zipCompressionFor("docs/data.json", "smart").level, 6);
  assert.throws(() => zipCompressionFor("x.txt", "__proto__"), /Unknown ZIP compression profile/);
  await assert.rejects(packZip(entries, {
    zipApi, sink: createMemoryZipSink(), profile: "not-real",
  }), /Unknown ZIP compression profile/);
});

test("ZIP streams multiple slices, respects sink backpressure", async () => {
  const bytes = new Uint8Array(300 * 1024);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251;
  const items = [source("large.dat", bytes)];
  const chunks = [];
  let activeWrites = 0;
  let sourceReads = 0;
  const actualSlice = items[0].file.slice.bind(items[0].file);
  items[0].file.slice = (start, end) => {
    sourceReads += 1;
    const blob = actualSlice(start, end);
    return {
      async arrayBuffer() {
        await new Promise((resolve) => setTimeout(resolve, 0));
        assert.equal(activeWrites, 0, "source read overlapped pending ZIP write");
        return blob.arrayBuffer();
      },
    };
  };
  const sink = {
    async write(chunk) {
      activeWrites += 1;
      assert.equal(activeWrites, 1);
      await new Promise((resolve) => setTimeout(resolve, 8));
      chunks.push(chunk.slice());
      activeWrites -= 1;
    },
    async close() { return new Blob(chunks); },
    async abort() { chunks.length = 0; },
  };
  const result = await packZip(items, { zipApi, sink });
  const decoded = unzipSync(new Uint8Array(await result.output.arrayBuffer()));
  assert.deepEqual(decoded["large.dat"], bytes);
  assert.ok(sourceReads >= 3);
});

test("ZIP rejects traversal, device paths, collisions with folders and oversized sources", () => {
  for (const path of ["../secret.txt", "/etc/passwd", "C:/disk.txt", "a//b.txt",
    "dir/./file.txt", "dir/../file.txt", "a\\b.txt", "CON.txt", "trailing./file"]) {
    assert.throws(() => planZipEntries([source(path, "x")]), /Unsafe ZIP path/);
  }
  assert.throws(() => planZipEntries([
    source("folder/file.txt", "x"), source("FOLDER/another.txt", "y"),
  ]), /Conflicting ZIP folder/);
  assert.throws(() => planZipEntries([source("big.bin", "12")], { maxSourceBytes: 1 }), /size limit/);
  assert.throws(() => planZipEntries([]), /Select between/);
  assert.equal(ZIP_PACK_LIMITS.maxEntries, 100);
  assert.equal(ZIP_PACK_LIMITS.maxMemorySourceBytes, 56 * 1024 * 1024);
  assert.equal(ZIP_PACK_LIMITS.yieldEveryChunks, 16);
  assert.throws(() => planZipEntries([
    source("folder/file.txt", "x"), source("folder", "y"),
  ]), /Conflicting ZIP file and folder path/);
  assert.throws(() => planZipEntries([
    source("folder", "x"), source("folder/file.txt", "y"),
  ]), /Conflicting ZIP folder path/);
});

test("ZIP preserves source modified dates within classic DOS bounds", async () => {
  const lastModified = new Date(2023, 4, 6, 12, 34, 56).getTime();
  const dated = source("dated.txt", "date");
  dated.file.lastModified = lastModified;
  const result = await packZip([dated], { zipApi, sink: createMemoryZipSink() });
  const bytes = new Uint8Array(await result.output.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let central = -1;
  for (let i = 0; i + 46 <= bytes.length; i += 1) {
    if (view.getUint32(i, true) === 0x02014b50) { central = i; break; }
  }
  assert.ok(central >= 0);
  const dosTime = view.getUint16(central + 12, true);
  const dosDate = view.getUint16(central + 14, true);
  assert.equal(1980 + (dosDate >>> 9), 2023);
  assert.equal((dosDate >>> 5) & 15, 5);
  assert.equal(dosDate & 31, 6);
  assert.equal(dosTime >>> 11, 12);
  assert.equal((dosTime >>> 5) & 63, 34);
  assert.equal((dosTime & 31) * 2, 56);

  const older = source("before.txt", "old");
  older.file.lastModified = new Date(1970, 0, 1).getTime();
  const newer = source("after.txt", "future");
  newer.file.lastModified = new Date(2200, 0, 1).getTime();
  const bounded = await packZip([older, newer], { zipApi, sink: createMemoryZipSink() });
  const boundedBytes = new Uint8Array(await bounded.output.arrayBuffer());
  const boundedView = new DataView(boundedBytes.buffer);
  const years = [];
  for (let i = 0; i + 46 <= boundedBytes.length; i += 1) {
    if (boundedView.getUint32(i, true) === 0x02014b50) {
      years.push(1980 + (boundedView.getUint16(i + 14, true) >>> 9));
    }
  }
  assert.deepEqual(years, [1980, 2099]);
});

test("ZIP signals the irreversible output commit phase", async () => {
  const controller = new AbortController();
  let publishing = false;
  const result = await packZip([source("note.txt", "contents")], {
    zipApi, sink: createMemoryZipSink(), signal: controller.signal,
    onProgress: ({ phase }) => {
      if (phase === "committing") {
        publishing = true;
        controller.abort();
      }
    },
  });
  assert.equal(publishing, true);
  assert.ok(result.output.size > 0);
});

test("ZIP cancel aborts sink without publishing incomplete output", async () => {
  const cancel = new AbortController();
  let aborted = false;
  const sink = createMemoryZipSink();
  const originalAbort = sink.abort.bind(sink);
  sink.abort = async () => { aborted = true; await originalAbort(); };
  await assert.rejects(packZip([source("long.bin", new Uint8Array(400 * 1024))], {
    zipApi, sink, signal: cancel.signal,
    onProgress: () => cancel.abort(),
  }), { name: "AbortError" });
  assert.equal(aborted, true);
});

test("ZIP sink enforces a bounded fallback output", async () => {
  await assert.rejects(packZip([source("notes.txt", "contents")], {
    zipApi, sink: createMemoryZipSink({ maxBytes: 8 }),
  }), /memory export limit/);
});
