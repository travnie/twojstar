import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { convertToPdf } from "docx-to-pdf-wasm";
import { strToU8, zipSync } from "fflate";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const xml = String.raw;
const files = {
  "[Content_Types].xml": xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  "_rels/.rels": xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  "word/_rels/document.xml.rels": xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  "word/styles.xml": xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
</w:styles>`,
  "word/document.xml": xml`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter One</w:t></w:r></w:p>
    <w:p><w:r><w:t>Body text for chapter one.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section A</w:t></w:r></w:p>
    <w:p><w:r><w:t>Nested section text.</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`,
};

const docx = zipSync(Object.fromEntries(
  Object.entries(files).map(([name, value]) => [name, strToU8(value)]),
));

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("docx-to-pdf-wasm/wasm");
const wasmModule = await WebAssembly.compile(await readFile(wasmPath));
const pdfBytes = await convertToPdf(wasmModule, docx);

assert.equal(new TextDecoder("ascii").decode(pdfBytes.slice(0, 5)), "%PDF-");
const pdf = await pdfjs.getDocument({
  data: pdfBytes,
  enableScripting: false,
  isEvalSupported: false,
}).promise;
try {
  assert.ok(pdf.numPages >= 1);
  const outline = await pdf.getOutline();
  assert.deepEqual(outline?.map((item) => ({
    title: item.title,
    children: item.items?.map((child) => child.title) || [],
  })) || [], [{
    title: "Chapter One",
    children: ["Section A"],
  }]);
} finally {
  await pdf.destroy?.();
}

console.log("Doc Bench DOCX conversion smoke test passed.");
