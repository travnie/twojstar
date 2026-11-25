import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import init, { Archive } from "@exav/unpack-wasm";
import { normalizeArchiveMembers, validateArchiveOutput, wasmArchiveEntryReason, validateArchiveBatch, wasmArchiveBatchReason } from "../public/archive-engine.mjs";
import { sevenzFixture, rarFixtures } from "./archive-fixture.mjs";
import { createZipTree } from "../public/zip-tree.mjs";

// libarchive-generated 7z (two regular text files, solid LZMA).
const fixture = Buffer.from(sevenzFixture, "base64");
const wasm = new URL("../pkg/exav_unpack_wasm_bg.wasm", import.meta.resolve("@exav/unpack-wasm"));
await init({ module_or_path: await readFile(wasm) });
const archive = await Archive.open(new Uint8Array(fixture), { allowedFormats: ["SevenZip"], maxMembers: 2000 });
try {
  const index = normalizeArchiveMembers(await archive.list());
  const tree = createZipTree(index.entries);
  assert.equal(tree.indexedFiles, 2);
  assert.equal(tree.list("folder").files[0].name, "hello.txt");
  const entry = index.entries.find((m) => m.name === "folder/hello.txt");
  assert.equal(wasmArchiveEntryReason(entry), null);
  const output = await archive.extract(entry.index);
  assert.equal(new TextDecoder().decode(validateArchiveOutput(entry, { ...output, data: output.bytes })), "hello Docbench\n");
  assert.throws(() => validateArchiveOutput(entry, { ...output, data: new Uint8Array(0) }));
} finally {
  await archive.close();
}
assert.throws(() => normalizeArchiveMembers([{ name: "<limit>", unsupported: "limit" }]));
const unsafe = normalizeArchiveMembers([{ name: "../escape", index: 0, uncompressedSize: 1 }]).entries[0];
assert.equal(unsafe.safe, false);
assert.ok(wasmArchiveEntryReason(unsafe));
const batchArchive = await Archive.open(new Uint8Array(fixture), { allowedFormats: ["SevenZip"] });
try {
  const { entries } = normalizeArchiveMembers(await batchArchive.list());
  assert.equal(wasmArchiveBatchReason(entries), null);
  const result = (await batchArchive.extractAll()).map((entry) => ({ ...entry, data: entry.bytes }));
  const outputs = validateArchiveBatch(entries, result);
  assert.equal(outputs.filter(Boolean).length, 2);
  assert.throws(() => validateArchiveBatch(entries, result.slice(1)));
} finally { await batchArchive.close(); }

for (const sample of rarFixtures) {
  const rar = await Archive.open(new Uint8Array(Buffer.from(sample.base64, "base64")), { allowedFormats: ["Rar"] });
  try {
    const passwords = sample.password ? [sample.password] : [];
    const { entries } = normalizeArchiveMembers(await rar.list(passwords));
    const member = entries.find((entry) => entry.name === "stest2.txt");
    assert.ok(member, sample.name + " member missing");
    const decoded = await rar.extract(member.index, passwords);
    assert.equal(validateArchiveOutput(member, { ...decoded, data: decoded.bytes }).length, 2048, sample.name);
    if (sample.password) {
      await assert.rejects(async () => {
        const bad = await rar.extract(member.index, ["wrong-password"]);
        validateArchiveOutput(member, { ...bad, data: bad.bytes });
      });
    }
  } finally { await rar.close(); }
}
console.log("Docbench archive adapter checks passed.");
