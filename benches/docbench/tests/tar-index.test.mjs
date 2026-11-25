import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { paxRecord, tarFixture, tarRecord } from "./tar-fixture.mjs";
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

test("PAX uses UTF-8 byte lengths and the effective size when locating files", async () => {
  const body = "a".repeat(515);
  const longPath = "docs/" + "résumé-".repeat(25) + "notes.txt";
  const archive = new Blob([tarFixture(
    tarRecord("GlobalHead", paxRecord("path", "docs/global.txt") + paxRecord("mtime", "123.45"), { type: "g" }),
    tarRecord("ExtendedHead", paxRecord("path", "discarded.txt") + paxRecord("path", longPath)
      + paxRecord("size", body.length), { type: "x" }),
    tarRecord("fallback.txt", body, { size: 0 }),
    tarRecord("second.txt", "second"),
    tarRecord("GlobalHead", paxRecord("path", "docs/updated.txt"), { type: "g" }),
    tarRecord("third.txt", "third"),
  )]);
  const { entries } = await readTarIndex(archive);
  assert.deepEqual(entries.map(({ name }) => name), [longPath, "docs/global.txt", "docs/updated.txt"]);
  const expected = [body, "second", "third"];
  for (const [index, entry] of entries.entries()) {
    assert.equal(await archive.slice(entry.start, entry.start + entry.originalSize).text(), expected[index]);
  }
});

test("PAX applies path validation after overrides and consumes local headers on hidden entries", async () => {
  const { entries } = await readTarIndex(new Blob([tarFixture(
    tarRecord("GlobalHead", paxRecord("path", "docs/kept.txt"), { type: "g" }),
    tarRecord("ExtendedHead", paxRecord("path", "../outside.txt"), { type: "x" }),
    tarRecord("safe-fallback.txt", "bad"),
    tarRecord("ExtendedHead", paxRecord("path", ""), { type: "x" }),
    tarRecord("deleted-fallback.txt", "bad"),
    tarRecord("ExtendedHead", paxRecord("path", "link.txt"), { type: "x" }),
    tarRecord("link-placeholder", "hard link data", { type: "1" }),
    tarRecord("ExtendedHead", paxRecord("path", "binary-name.txt") + paxRecord("hdrcharset", "BINARY"), { type: "x" }),
    tarRecord("binary-placeholder", "bad"),
    tarRecord("following.txt", "ok"),
  )]));
  const tree = createZipTree(entries);
  assert.equal(tree.skipped, 4);
  assert.deepEqual(tree.list("docs").files.map(({ name }) => name), ["kept.txt"]);
});

test("PAX clears global values and falls back to the ustar size for empty local values", async () => {
  const archive = new Blob([tarFixture(
    tarRecord("GlobalHead", paxRecord("path", "global.txt") + paxRecord("size", "4"), { type: "g" }),
    tarRecord("first.txt", "four"),
    tarRecord("ExtendedHead", paxRecord("size", ""), { type: "x" }),
    tarRecord("local.txt", "bb"),
    tarRecord("GlobalHead", paxRecord("path", "") + paxRecord("size", ""), { type: "g" }),
    tarRecord("restored.txt", "ccc"),
    tarRecord("ExtendedHead", paxRecord("size", "0"), { type: "x" }),
    tarRecord("empty.txt", "", { size: 512 }),
  )]);
  const { entries } = await readTarIndex(archive);
  assert.deepEqual(entries.map(({ name, originalSize }) => [name, originalSize]),
    [["global.txt", 4], ["global.txt", 2], ["restored.txt", 3], ["empty.txt", 0]]);
  assert.equal(await archive.slice(entries[2].start, entries[2].start + entries[2].originalSize).text(), "ccc");
});

test("TAR directory size consumes no POSIX payload blocks", async () => {
  const body = "a".repeat(779);
  const archive = new Blob([tarFixture(
    tarRecord("GlobalHead", paxRecord("size", body.length), { type: "g" }),
    tarRecord("docs/", "", { size: 512, type: "5" }),
    tarRecord("docs/file.txt", body, { size: 0 }),
  )]);
  const { entries: [directory, file] } = await readTarIndex(archive);
  assert.equal(directory.originalSize, 0);
  assert.equal(file.name, "docs/file.txt");
  assert.equal(await archive.slice(file.start, file.start + file.originalSize).text(), body);
});

test("PAX rejects malformed, excessive and sparse metadata", async () => {
  const archive = (...records) => new Blob([tarFixture(...records)]);
  const extended = (data, type = "x") => tarRecord("ExtendedHead", data, { type });
  const file = tarRecord("file.txt", "ok");
  await assert.rejects(readTarIndex(archive(extended("999 path=wrong.txt\n"), file)), /PAX record length/u);
  await assert.rejects(readTarIndex(archive(extended("8 path=a"), file)), /malformed PAX record/u);
  await assert.rejects(readTarIndex(archive(extended(paxRecord("path", "orphan.txt")))), /no following entry/u);
  await assert.rejects(readTarIndex(archive(extended(paxRecord("size", "9007199254740993")), file)), /PAX file size/u);
  await assert.rejects(readTarIndex(archive(extended(paxRecord("size", "4096")), file)), /beyond archive/u);
  await assert.rejects(readTarIndex(archive(extended(paxRecord("GNU.sparse.major", "1")), file)), /sparse PAX/u);
  await assert.rejects(readTarIndex(archive(extended(paxRecord("comment", "a".repeat(65536))), file)), /PAX metadata limit/u);
  const bigGlobal = extended(paxRecord("comment", "a".repeat(64000)), "g");
  await assert.rejects(readTarIndex(archive(...Array(33).fill(bigGlobal), file)), /PAX metadata limit/u);
});

test("TAR fails closed on corrupt or truncated headers and unsupported extensions", async () => {
  const corrupt = tarRecord("hello.txt", "data");
  corrupt[0] ^= 1;
  await assert.rejects(readTarIndex(new Blob([tarFixture(corrupt)])), /header checksum mismatch/u);
  await assert.rejects(readTarIndex(new Blob([tarRecord("file", "data").subarray(0, 600)])), /beyond archive/u);
  await assert.rejects(readTarIndex(new Blob([Buffer.alloc(512)])), /invalid end blocks/u);
  for (const type of ["L", "K", "S"]) {
    const extended = new Blob([tarFixture(tarRecord("extended", "data", { type }))]);
    await assert.rejects(readTarIndex(extended), /extended, sparse or unknown/u);
  }
});

test("TAR bounds the header count and stops reading stale archives", async () => {
  const empty = tarRecord("./", "", { type: "5" });
  const archive = new Blob([tarFixture(...Array(2001).fill(empty))]);
  await assert.rejects(readTarIndex(archive), /entry limit exceeded/u);
  await assert.rejects(readTarIndex(archive, () => false), { name: "AbortError" });
  const metadata = tarRecord("PaxHeader", paxRecord("mtime", "123.456"), { type: "x" });
  const entries = Array.from({ length: 2000 }, (_, index) => [metadata, tarRecord(`file-${index}`)]);
  assert.equal((await readTarIndex(new Blob([tarFixture(...entries.flat())]))).entries.length, 2000);
  await assert.rejects(readTarIndex(new Blob([tarFixture(...entries.flat(), metadata)])), /header limit exceeded/u);
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
