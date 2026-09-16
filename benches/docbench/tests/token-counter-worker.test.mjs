import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const counter = await readFile("public/token-counter.mjs", "utf8");
const worker = await readFile("public/token-counter-worker.mjs", "utf8");
const portable = await readFile("public/portable.html", "utf8");

assert.match(counter, /new Worker\(/);
assert.match(counter, /statsRevision/);
assert.match(counter, /tokenRevision/);
assert.match(worker, /countDocumentStats/);
assert.match(worker, /encoder\.encode/);
assert.ok(
  portable.includes("__docbenchTokenWorkerSource"),
  "portable build must embed the document-analysis worker source",
);

console.log("DocBench document-analysis worker checks passed.");
