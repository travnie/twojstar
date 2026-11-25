import assert from "node:assert/strict";
import createSevenZip from "sevenzip-wasm";
import { runSevenZipOperation, parseSevenZipListing } from "../public/archive-7zip-core.mjs";
import { normalizeArchiveMembers, validateArchiveOutput, validateArchiveBatch,
  wasmArchiveEntryReason, wasmArchiveBatchReason } from "../public/archive-engine.mjs";
import { sevenzFixture, sevenzEdgeFixtures, rarFixtures } from "./archive-fixture.mjs";
import { createZipTree } from "../public/zip-tree.mjs";
const run = (base64, operation, options = {}) => runSevenZipOperation(createSevenZip, new Uint8Array(Buffer.from(base64, "base64")), operation, options);
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
console.log("Docbench 7-Zip archive adapter checks passed.");
