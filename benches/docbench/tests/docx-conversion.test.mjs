import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { convertToPdf } from "docx-to-pdf-wasm";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readPdfOutline } from "../public/pdf-core.mjs";
import { convertPdfStateToDocx } from "../public/pdf-to-docx.mjs";

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
globalThis.fflate = { zipSync, strToU8 };
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

  const normalizedOutline = await readPdfOutline(pdf);
  const roundTripDocx = await convertPdfStateToDocx({
    sources: [{ pdf }],
    plan: Array.from({ length: pdf.numPages }, (_, pageIndex) => ({
      sourceId: 0,
      pageIndex,
    })),
    outline: normalizedOutline,
    metadata: { title: "Round trip" },
  });
  const roundTripFiles = unzipSync(roundTripDocx);
  const roundTripDocument = strFromU8(roundTripFiles["word/document.xml"]);
  const roundTripStyles = strFromU8(roundTripFiles["word/styles.xml"]);
  const roundTripRelationships = strFromU8(
    roundTripFiles["word/_rels/document.xml.rels"],
  );

  assert.match(roundTripDocument, /w:pStyle w:val="Heading1"/);
  assert.match(roundTripDocument, />Chapter One</);
  assert.match(roundTripDocument, /w:name="Chapter_One_1"/);
  assert.match(roundTripDocument, /w:pStyle w:val="Heading2"/);
  assert.match(roundTripDocument, />Section A</);
  assert.match(roundTripDocument, /w:name="Section_A_2"/);
  assert.match(roundTripDocument, /Body text for chapter one\./);
  assert.match(roundTripStyles, /w:styleId="Heading1"/);
  assert.match(roundTripStyles, /w:styleId="Heading2"/);
  assert.match(
    roundTripRelationships,
    /officeDocument\/2006\/relationships\/styles/,
  );

  const regeneratedPdfBytes = await convertToPdf(wasmModule, roundTripDocx);
  assert.equal(
    new TextDecoder("ascii").decode(regeneratedPdfBytes.slice(0, 5)),
    "%PDF-",
  );
  const regeneratedPdf = await pdfjs.getDocument({
    data: regeneratedPdfBytes,
    enableScripting: false,
    isEvalSupported: false,
  }).promise;
  try {
    const regeneratedOutline = await regeneratedPdf.getOutline();
    assert.deepEqual(regeneratedOutline?.map((item) => ({
      title: item.title,
      children: item.items?.map((child) => child.title) || [],
    })) || [], [{
      title: "Chapter One",
      children: ["Section A"],
    }]);
  } finally {
    await regeneratedPdf.destroy?.();
  }
} finally {
  await pdf.destroy?.();
}

const fakePdf = {
  async getPage(pageNumber) {
    return {
      async getTextContent() {
        return {
          items: [{
            str: pageNumber === 1 ? "First page\u0000 text" : "Second page text",
            transform: [1, 0, 0, 12, 40, 700],
            width: 120,
            hasEOL: true,
          }],
        };
      },
    };
  },
};
const reordered = await convertPdfStateToDocx({
  sources: [{ pdf: fakePdf }],
  plan: [
    { sourceId: 0, pageIndex: 1 },
    { sourceId: 0, pageIndex: 0 },
  ],
  outline: [{
    title: "Container",
    target: null,
    children: [{
      title: "Second page text",
      target: {
        kind: "page",
        pageIndex: 0,
        view: { type: "Fit", args: [] },
      },
      children: [],
    }],
  }],
  metadata: {},
});
const reorderedDocument = strFromU8(unzipSync(reordered)["word/document.xml"]);
assert.ok(
  reorderedDocument.indexOf("Second page text") < reorderedDocument.indexOf("First page text"),
);
assert.match(reorderedDocument, /w:br w:type="page"/);
assert.match(reorderedDocument, /w:pStyle w:val="Heading1"[^>]*|w:styleId="Heading1"/);
assert.match(reorderedDocument, />Container</);
assert.match(reorderedDocument, /w:pStyle w:val="Heading2"/);
assert.doesNotMatch(reorderedDocument, /\u0000/);

console.log("Doc Bench DOCX conversion smoke test passed.");
