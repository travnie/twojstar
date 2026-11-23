import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { tarFixture, tarRecord } from "./tar-fixture.mjs";
import { decompressGzipTar, readTarIndex } from "../public/tar-index.mjs";
import { createZipTree } from "../public/zip-tree.mjs";

test("TAR index skips payload reads and returns exact regular-file slices", async () => {
  const archive = new Blob([tarFixture(
    tarRecord("./", "", { type: "5", gnu: true }),
    tarRecord("empty/", "", { type: "5" }),
    tarRecord("résumé.txt", "a".repeat(2049), { prefix: "docs/sub" }),
    tarRecord("./docs/gnu.txt", "second", { gnu: true }),
  )]);
  const reads = [];
  const slice = archive.slice.bind(archive);
  archive.slice = (start, end) => {
    reads.push([start, end]);
    return slice(start, end);
  };
  const { entries } = await readTarIndex(archive);
  assert.deepEqual(reads, [0, 512, 1024, 4096, 5120, 5632].map((start) => [start, start + 512]));
  assert.deepEqual(entries.map(({ name }) => name), ["empty/", "docs/sub/résumé.txt", "docs/gnu.txt"]);
  assert.deepEqual(createZipTree(entries).list().folders.map(({ name }) => name), ["docs", "empty"]);
  const second = entries[2];
  assert.equal(await slice(second.start, second.start + second.originalSize).text(), "second");
});

test("TAR omits unsafe paths, links and special files", async () => {
  const { entries } = await readTarIndex(new Blob([tarFixture(
    tarRecord("./docs/ok.txt", "ok"),
    tarRecord("./../escape.txt", "bad"),
    tarRecord("/absolute.txt", "bad"),
    tarRecord("C:drive.txt", "bad"),
    tarRecord("docs\\backslash.txt", "bad"),
    tarRecord("docs/link", "", { type: "2" }),
    tarRecord("docs/hard-link", "", { type: "1" }),
    tarRecord("docs/device", "", { type: "3" }),
    tarRecord("docs/OK.txt", "duplicate"),
  )]));
  const tree = createZipTree(entries);
  assert.equal(tree.skipped, 8);
  assert.deepEqual(tree.list("docs").files.map(({ name }) => name), ["ok.txt"]);
});

test("TAR fails closed on corrupt or truncated headers and unsupported extensions", async () => {
  const corrupt = tarRecord("hello.txt", "data");
  corrupt[0] ^= 1;
  await assert.rejects(readTarIndex(new Blob([tarFixture(corrupt)])), /header checksum mismatch/u);
  await assert.rejects(readTarIndex(new Blob([tarRecord("file", "data").subarray(0, 600)])), /beyond archive/u);
  await assert.rejects(readTarIndex(new Blob([Buffer.alloc(512)])), /invalid end blocks/u);
  for (const type of ["x", "g", "L", "K", "S"]) {
    const extended = new Blob([tarFixture(tarRecord("extended", "data", { type }))]);
    await assert.rejects(readTarIndex(extended), /extended, sparse or unknown/u);
  }
});

test("TAR bounds the header count and stops reading stale archives", async () => {
  const empty = tarRecord("./", "", { type: "5" });
  const archive = new Blob([tarFixture(...Array(2001).fill(empty))]);
  await assert.rejects(readTarIndex(archive), /entry limit exceeded/u);
  await assert.rejects(readTarIndex(archive, () => false), { name: "AbortError" });
});

test("gzip TAR only returns after validating the complete stream", async () => {
  const fixture = tarFixture(tarRecord("docs/readme.txt", "compressed TAR"));
  const gzip = gzipSync(fixture);
  const expanded = await decompressGzipTar(new Blob([gzip]));
  assert.deepEqual(Buffer.from(await expanded.arrayBuffer()), fixture);
  const { entries } = await readTarIndex(expanded);
  assert.equal(entries[0].name, "docs/readme.txt");

  await assert.rejects(decompressGzipTar(new Blob([gzip.subarray(0, -1)])), /Gzip decoding failed/u);
  for (const offset of [gzip.length - 8, gzip.length - 4]) {
    const corrupt = Buffer.from(gzip);
    corrupt[offset] ^= 1;
    await assert.rejects(decompressGzipTar(new Blob([corrupt])), /Gzip decoding failed/u);
  }
});

test("gzip TAR caps input and expansion and cancels a pending read", async () => {
  const limit = 32 * 1024 * 1024;
  const oversized = { size: limit + 1, slice() { assert.fail("Read oversized gzip input"); } };
  await assert.rejects(decompressGzipTar(oversized), /input limit/u);
  const compressed = new Blob([gzipSync(Buffer.alloc(limit + 1))]);
  await assert.rejects(decompressGzipTar(compressed), /output limit/u);

  const controller = new AbortController();
  const input = new Blob([gzipSync(Buffer.from("local data"))]);
  const read = input.slice.bind(input);
  input.slice = (...args) => {
    controller.abort();
    return read(...args);
  };
  await assert.rejects(decompressGzipTar(input, controller.signal), { name: "AbortError" });
});
