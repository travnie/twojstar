import assert from "node:assert/strict";
import createSevenZip from "sevenzip-wasm";
import { readFile } from "node:fs/promises";
import { runSevenZipOperation, parseSevenZipListing } from "../public/archive-7zip-core.mjs";
import { normalizeArchiveMembers, validateArchiveOutput, validateArchiveBatch,
  wasmArchiveEntryReason, wasmArchiveBatchReason } from "../public/archive-engine.mjs";
import { sevenzFixture, sevenzEdgeFixtures, rarFixtures } from "./archive-fixture.mjs";
import { createZipTree } from "../public/zip-tree.mjs";
const wasmModule = await WebAssembly.compile(await readFile(new URL("sevenzip-wasm.wasm", import.meta.resolve("sevenzip-wasm"))));
const run = async (base64, operation, options = {}) => {
  const previous = process.exitCode;
  try {
    return await runSevenZipOperation(createSevenZip, new Uint8Array(Buffer.from(base64, "base64")), operation, { ...options, wasmModule });
  } finally {
    // The Emscripten Node shim sets process.exitCode even on expected bad input.
    process.exitCode = previous;
  }
};
const list = async (base64, password) => normalizeArchiveMembers(await run(base64, "list", { password })).entries;
const text = new TextDecoder();
const entries = await list(sevenzFixture);
const tree = createZipTree(entries);
assert.equal(tree.indexedFiles, 2);
assert.equal(tree.list("folder").files[0].name, "hello.txt");
const hello = entries.find(member => member.name === "folder/hello.txt");
assert.equal(wasmArchiveEntryReason(hello), null);
assert.equal(text.decode(validateArchiveOutput(hello, await run(sevenzFixture, "extract", { index: hello.index }))), "hello Docbench\n");
assert.equal(validateArchiveBatch(entries, await run(sevenzFixture, "extractAll")).length, 2);
for (const sample of ["mixed", "onlyempty"]) {
  const archive = sevenzEdgeFixtures[sample];
  const indexed = await list(archive);
  assert.equal(indexed.length, sample === "mixed" ? 3 : 2);
  const empty = indexed.find(entry => entry.name === "empty.txt");
  const directory = indexed.find(entry => entry.name === "empty-dir");
  assert.equal(empty.originalSize, 0);
  assert.equal(empty.directory, false);
  assert.equal(directory.directory, true);
  assert.equal(wasmArchiveBatchReason(indexed), null);
  const outputs = validateArchiveBatch(indexed, await run(archive, "extractAll"));
  assert.equal(outputs[empty.index].length, 0);
  assert.equal(outputs[directory.index], null);
}
const links = await list(sevenzEdgeFixtures.link);
const link = links.find(entry => entry.name === "latest.txt");
assert.equal(link.special, true);
assert.equal(link.safe, false);
assert.ok(wasmArchiveEntryReason(link));
assert.ok(wasmArchiveBatchReason(links));
await assert.rejects(run(sevenzEdgeFixtures.link, "extract", { index: link.index }));
await assert.rejects(run(sevenzEdgeFixtures.link, "extractAll"));
await assert.rejects(run(sevenzEdgeFixtures.corrupt, "extract", { index: 0 }));
await assert.rejects(run(sevenzEdgeFixtures.corrupt, "extractAll"));
for (const sample of rarFixtures) {
  const indexed = await list(sample.base64, sample.password);
  const member = indexed.find(entry => entry.name === "stest2.txt");
  assert.ok(member, sample.name + " member missing");
  const decoded = await run(sample.base64, "extract", { index: member.index, password: sample.password });
  assert.equal(validateArchiveOutput(member, decoded).length, 2048, sample.name);
  assert.equal(validateArchiveBatch(indexed, await run(sample.base64, "extractAll", { password: sample.password })).length, 2);
  if (sample.password) await assert.rejects(run(sample.base64, "extract", { index: member.index, password: "wrong-password" }));
}
assert.throws(() => normalizeArchiveMembers([{ name: "<limit>", unsupported: "limit" }]));
assert.equal(normalizeArchiveMembers([{ name: "../escape", index: 0, uncompressedSize: 1 }]).entries[0].safe, false);
assert.throws(() => parseSevenZipListing("Path = test\nPath = duplicate\n"));
// Generate a large valid batch and an archive with metadata disabled.
async function generatedArchive(attributeFree) {
  const zip = await createSevenZip({
    instantiateWasm(imports, receive) {
      receive(new WebAssembly.Instance(wasmModule, imports), wasmModule);
    },
    print() {}, printErr() {}, stdin: () => null,
  });
  zip.FS.mkdir("/source");
  zip.FS.mkdir("/source/empty-dir");
  zip.FS.writeFile("/source/empty.txt", new Uint8Array(0));
  zip.FS.writeFile("/source/readme.txt", "hello");
  if (!attributeFree) {
    let path = "/source";
    for (let i = 0; i < 4; i++) {
      path += "/" + String(i) + "x".repeat(43);
      zip.FS.mkdir(path);
    }
    for (let i = 0; i < 90; i++) zip.FS.writeFile(path + "/file-" + i + ".txt", "abc");
  }
  assert.equal(zip.callMain(["a", "-t7z", "-bsp0", ...(attributeFree ? ["-mtr=off"] : []),
    "/test.7z", "/source/*"]), 0);
  return Buffer.from(zip.FS.readFile("/test.7z")).toString("base64");
}
const attributeFree = await generatedArchive(true);
const noAttrs = await list(attributeFree);
assert.equal(noAttrs.find(entry => entry.name === "empty-dir").directory, true);
assert.equal(noAttrs.find(entry => entry.name === "empty.txt").directory, false);
assert.equal(validateArchiveBatch(noAttrs, await run(attributeFree, "extractAll")).length, 3);

const longPaths = await generatedArchive(false);
const longEntries = await list(longPaths);
assert.ok(longEntries.length >= 93 && longEntries.length <= 100);
assert.equal(wasmArchiveBatchReason(longEntries), null);
const longOutputs = validateArchiveBatch(longEntries, await run(longPaths, "extractAll"));
assert.equal(longOutputs.filter(data => data && text.decode(data) === "abc").length, 90);

console.log("Docbench 7-Zip archive adapter checks passed.");
