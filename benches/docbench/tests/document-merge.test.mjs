import assert from "node:assert/strict";
import {
  isMergeFilename,
  isMergeTextFilename,
  mergeDocuments,
  mergeFamilyForFilename,
  mergeJsonDocuments,
  mergeJsonlDocuments,
  mergeTextDocuments,
} from "../public/document-merge.mjs";

assert.equal(isMergeTextFilename("notes.txt"), true);
assert.equal(isMergeTextFilename("README.MD"), true);
assert.equal(isMergeTextFilename("chapter.markdown"), true);
assert.equal(isMergeTextFilename("data.json"), false);
assert.equal(isMergeFilename("data.json"), true);
assert.equal(isMergeFilename("settings.JSONC"), true);
assert.equal(isMergeFilename("records.ndjson"), true);
assert.equal(isMergeFilename("config.json5"), false);
assert.equal(mergeFamilyForFilename("data.json"), "json");
assert.equal(mergeFamilyForFilename("records.jsonl"), "jsonl");

assert.deepEqual(
  mergeTextDocuments([
    { name: "first.txt", text: "alpha" },
    { name: "second.txt", text: "beta\n" },
  ]),
  {
    filename: "merged.txt",
    format: "txt",
    text: "alpha\n\nbeta\n",
    conflictCount: 0,
    conflicts: [],
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
    conflictCount: 0,
    conflicts: [],
  },
);

const smart = mergeJsonDocuments([
  {
    name: "base.json",
    text: '{"name":"bird","nested":{"left":1},"items":[1],"id":900719925474099312345}',
  },
  {
    name: "overlay.jsonc",
    text: '{// comment\n"name":"bird","nested":{"right":2},"items":[2,3],"id":900719925474099312346,}',
  },
]);
assert.equal(smart.filename, "merged.json");
assert.equal(smart.format, "json");
assert.equal(smart.conflictCount, 1);
assert.deepEqual(smart.conflicts, ["$.id"]);
assert.equal(
  smart.text,
  [
    "{",
    '  "name": "bird",',
    '  "nested": {',
    '    "left": 1,',
    '    "right": 2',
    "  },",
    '  "items": [',
    "    1,",
    "    2,",
    "    3",
    "  ],",
    '  "id": 900719925474099312346',
    "}",
    "",
  ].join("\n"),
);
assert.match(smart.text, /900719925474099312346/);

const arrays = mergeJsonDocuments([
  { name: "one.json", text: "[1, 900719925474099312345]" },
  { name: "two.json", text: "[2]" },
]);
assert.equal(arrays.conflictCount, 0);
assert.equal(arrays.text, "[\n  1,\n  900719925474099312345,\n  2\n]\n");

assert.throws(
  () => mergeJsonDocuments([
    { name: "object.json", text: '{"x":1}' },
    { name: "array.json", text: "[2]" },
  ]),
  /cannot mix object roots with array roots/i,
);

assert.throws(
  () => mergeJsonDocuments([
    { name: "duplicate.json", text: '{"x":1,"x":2}' },
    { name: "other.json", text: '{"y":3}' },
  ]),
  /duplicate key/i,
);

const jsonl = mergeJsonlDocuments([
  { name: "one.jsonl", text: '{"id":900719925474099312345}\n{"id":2}\n' },
  { name: "two.ndjson", text: '{"id":3}\n' },
]);
assert.equal(jsonl.filename, "merged.jsonl");
assert.equal(jsonl.text, '{"id":900719925474099312345}\n{"id":2}\n{"id":3}\n');

assert.throws(
  () => mergeJsonlDocuments([
    { name: "one.jsonl", text: '{"ok":1}\n' },
    { name: "bad.ndjson", text: '{"broken":}\n' },
  ]),
  /bad\.ndjson: invalid JSON record on line 1/i,
);

assert.equal(
  mergeDocuments([
    { name: "a.json", text: '{"a":1}' },
    { name: "b.json", text: '{"b":2}' },
  ]).text,
  '{\n  "a": 1,\n  "b": 2\n}\n',
);

assert.throws(
  () => mergeDocuments([
    { name: "a.md", text: "a" },
    { name: "b.json", text: '{"b":2}' },
  ]),
  /same family/i,
);

assert.throws(
  () => mergeTextDocuments([{ name: "only.txt", text: "one" }]),
  /at least two/i,
);

console.log("Doc Bench document merge checks passed.");
