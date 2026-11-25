import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import init, { Archive } from "@exav/unpack-wasm";
import { normalizeArchiveMembers, validateArchiveOutput, wasmArchiveEntryReason } from "../public/archive-engine.mjs";
import { createZipTree } from "../public/zip-tree.mjs";

// libarchive-generated 7z (two regular text files, solid LZMA).
const fixture = Buffer.from("N3q8ryccAAOymDQigQAAAAAAAAAgAAAAAAAAAB0Nma4ANBlJ7o3pCZ0jNGIZihR098KfD/TU65K///tQ4AAAAIEzB64Pz+swFA/r6p4BDWIDjdNMQj8OfFsxR7yJVgQHGCVhKoWKQNTsAUrckM6C8NnY1dGDa2WkyC1h0hRSHwL8FeiiL9ENtmrQ2/xuueXZ912c40yVy+nPM8C///2HQAAXBh4BCWMABwsBAAEjAwEBBV0AAIAADHIKAUsn8xsAAA==", "base64");
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
console.log("Docbench archive adapter checks passed.");
