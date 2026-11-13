import assert from "node:assert/strict";
import test from "node:test";
import { createZipTree, ZIP_TREE_LIMITS } from "../public/zip-tree.mjs";

const file = (name, attrs = {}) => ({
  name, safe: true, directory: false, method: 8,
  originalSize: 12, compressedSize: 8, encrypted: false, zip64: false, ...attrs,
});

test("ZIP index exposes nested folders without decompressing source data", () => {
  const source = [
    file("deep/nested/one.txt"),
    file("deep/nested/two.txt", { compressedSize: 4, encrypted: true }),
    file("deep/readme.md"),
    file("empty/", { directory: true }),
    file("root.txt"),
  ];
  const tree = createZipTree(source);
  assert.equal(tree.total, 5);
  assert.equal(tree.indexedFiles, 4);
  assert.deepEqual(tree.list("").folders.map((f) => f.name), ["deep", "empty"]);
  assert.deepEqual(tree.list("deep").folders.map((f) => f.name), ["nested"]);
  assert.deepEqual(tree.list("deep").files.map((f) => f.name), ["readme.md"]);
  const nested = tree.list("deep/nested");
  assert.equal(nested.parentPath, "deep");
  assert.deepEqual(nested.files.map((f) => f.name), ["one.txt", "two.txt"]);
  assert.equal(nested.files[1].encrypted, true);
  assert.equal(nested.files[0].originalSize, 12);
  assert.equal(tree.list("missing"), null);
});

test("ZIP tree hides unsafe and ambiguous archive entries", () => {
  const tree = createZipTree([
    file("a/ok.txt"),
    file("../secret.txt", { safe: false }),
    file("a/OK.txt"),
    file("a/sub\\windows.txt"),
    file("folder", {}),
    file("folder/child.txt"),
    file("a/../bad.txt", { safe: false }),
    file("A/variant.txt"),
  ]);
  assert.equal(tree.indexedFiles, 3);
  assert.equal(tree.skipped, 5);
  assert.deepEqual(tree.list("a").files.map((x) => x.name), ["ok.txt"]);
  assert.deepEqual(tree.list("a/sub").files.map((x) => x.name), ["windows.txt"]);
  assert.equal(tree.list("folder"), null);
  assert.equal(tree.list("a/.."), null);
});

test("ZIP tree rejects excessive depth and entry count", () => {
  const deep = "x/".repeat(ZIP_TREE_LIMITS.maxDepth) + "payload.dat";
  const tree = createZipTree([file(deep), file("normal.txt")]);
  assert.equal(tree.skipped, 1);
  assert.equal(tree.list("").files.length, 1);
  assert.throws(() => createZipTree(Array.from({ length: ZIP_TREE_LIMITS.maxEntries + 1 }, () => file("x"))), /limit/);
});
