import assert from "node:assert/strict";
import test from "node:test";
import { inspectHeader } from "../public/file-signatures.mjs";
import { isTextFile, resolveFileTool } from "../public/file-routing.mjs";

const header = (name, bytes = [], type = "") =>
  ({ ...inspectHeader(new Uint8Array(bytes), { name, type }), name });

test("PDF signature routes to the existing PDF tools", () => {
  const info = header("report.pdf", [37, 80, 68, 70, 45]);
  assert.equal(resolveFileTool(info, 10)?.event, "docbench:open-pdf-file");
});

test("DOCX ZIP container routes to converter, not the archive viewer", () => {
  const info = header("report.docx", [80, 75, 3, 4]);
  assert.equal(info.format, "zip");
  assert.equal(info.extensionHint, "docx");
  assert.equal(resolveFileTool(info, 10)?.event, "docbench:convert-docx-file");
  assert.equal(resolveFileTool(header("report.zip", [80, 75, 3, 4]), 10), null);
});

test("A spoofed DOCX extension cannot force conversion", () => {
  const png = header("report.docx", [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(resolveFileTool(png, 10), null);
  assert.equal(resolveFileTool(header("broken.docx"), 10), null);
});

test("Text and SVG source use the existing text editor", () => {
  const markdown = header("notes.md");
  assert.equal(isTextFile(markdown), true);
  assert.equal(resolveFileTool(markdown, 1024)?.mode, "document");
  assert.equal(resolveFileTool(header("icon.svg"), 1024)?.mode, "document");
});

test("Unknown binary and oversized documents remain inspect-only", () => {
  assert.equal(resolveFileTool(header("unknown.bin"), 4), null);
  assert.equal(resolveFileTool(header("notes.md"), 33 * 1024 * 1024), null);
  assert.equal(resolveFileTool(header("report.docx", [80, 75, 3, 4]), 33 * 1024 * 1024), null);
});
