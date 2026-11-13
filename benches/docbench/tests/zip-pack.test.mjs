import assert from "node:assert/strict";
import test from "node:test";
import { Zip, ZipDeflate, unzipSync } from "fflate";
import { readZipIndex } from "../public/zip-index.mjs";
import { ZIP_PACK_LIMITS, planZipEntries, createMemoryZipSink, packZip } from "../public/zip-pack.mjs";

const zipApi = { Zip, ZipDeflate };
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

test("ZIP streams multiple slices, respects sink backpressure", async () => {
  const bytes = new Uint8Array(300 * 1024);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251;
  const items = [source("large.dat", bytes)];
  const chunks = [];
  let activeWrites = 0;
  const sink = {
    async write(chunk) {
      activeWrites += 1;
      assert.equal(activeWrites, 1);
      await new Promise((resolve) => setTimeout(resolve, 1));
      chunks.push(chunk.slice());
      activeWrites -= 1;
    },
    async close() { return new Blob(chunks); },
    async abort() { chunks.length = 0; },
  };
  const result = await packZip(items, { zipApi, sink });
  const decoded = unzipSync(new Uint8Array(await result.output.arrayBuffer()));
  assert.deepEqual(decoded["large.dat"], bytes);
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
