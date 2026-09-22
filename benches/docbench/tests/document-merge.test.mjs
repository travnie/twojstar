import assert from "node:assert/strict";
import {
  isMergeTextFilename,
  mergeTextDocuments,
} from "../public/document-merge.mjs";

assert.equal(isMergeTextFilename("notes.txt"), true);
assert.equal(isMergeTextFilename("README.MD"), true);
assert.equal(isMergeTextFilename("chapter.markdown"), true);
assert.equal(isMergeTextFilename("data.json"), false);

assert.deepEqual(
  mergeTextDocuments([
    { name: "first.txt", text: "alpha" },
    { name: "second.txt", text: "beta\n" },
  ]),
  {
    filename: "merged.txt",
    format: "txt",
    text: "alpha\n\nbeta\n",
  },
);

assert.deepEqual(
  mergeTextDocuments([
    { name: "intro.txt", text: "intro" },
    { name: "chapter.md", text: "# Chapter" },
    { name: "tail.markdown", text: "tail" },
  ]),
  {
    filename: "merged.md",
    format: "md",
    text: "intro\n\n# Chapter\n\ntail",
  },
);

assert.throws(
  () => mergeTextDocuments([{ name: "only.txt", text: "one" }]),
  /at least two/i,
);
assert.throws(
  () => mergeTextDocuments([
    { name: "okay.txt", text: "one" },
    { name: "nope.json", text: "{}" },
  ]),
  /only \.txt, \.md and \.markdown/i,
);

console.log("Doc Bench text merge tests passed.");
