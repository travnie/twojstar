const $ = (selector) => document.querySelector(selector);

const button = $("#docx-to-pdf-button");
const input = $("#docx-to-pdf-input");
const pdfStatus = $("#pdf-status");
const MAX_DOCX_BYTES = 32 * 1024 * 1024;

let runtimePromise;
let wasmModulePromise;

function asset(name, fallback) {
  return globalThis.__docbenchDocxAssets?.[name] || fallback;
}

function setStatus(message, bad = false) {
  pdfStatus.textContent = message;
  pdfStatus.classList.toggle("bad", bad);
}

async function ensureRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(asset(
      "moduleUrl",
      "/vendor/docx-to-pdf/index.js",
    )).catch((error) => {
      runtimePromise = undefined;
      throw error;
    });
  }
  return runtimePromise;
}

async function ensureWasmModule() {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const response = await fetch(asset(
        "wasmUrl",
        "/vendor/docx-to-pdf/docx-to-pdf.wasm",
      ));
      if (!response.ok) {
        throw new Error(`Could not load DOCX converter (${response.status}).`);
      }
      return WebAssembly.compile(await response.arrayBuffer());
    })().catch((error) => {
      wasmModulePromise = undefined;
      throw error;
    });
  }
  return wasmModulePromise;
}

function isZip(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && bytes[2] === 0x03
    && bytes[3] === 0x04;
}

function isPdf(bytes) {
  return bytes.length >= 5
    && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-";
}

function outputFilename(name) {
  const base = String(name || "document")
    .replace(/\.docx$/i, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return `${base || "document"}.pdf`;
}

function downloadPdf(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function convertDocx(file) {
  if (!file) return;
  if (file.size > MAX_DOCX_BYTES) {
    throw new Error("DOCX is larger than the 32 MiB local conversion limit.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isZip(bytes)) {
    throw new Error("This file does not look like a DOCX package.");
  }

  button.disabled = true;
  setStatus(`Loading local DOCX converter for ${file.name}…`);
  try {
    const [runtime, wasmModule] = await Promise.all([
      ensureRuntime(),
      ensureWasmModule(),
    ]);
    setStatus(`Converting ${file.name} locally…`);
    const pdfBytes = await runtime.convertToPdf(wasmModule, bytes);
    if (!isPdf(pdfBytes)) {
      throw new Error("DOCX converter returned an invalid PDF.");
    }

    const filename = outputFilename(file.name);
    const event = new CustomEvent("docbench:open-pdf-bytes", {
      cancelable: true,
      detail: {
        bytes: pdfBytes,
        filename,
        sourceName: file.name,
        sourceKind: "docx",
      },
    });
    const handled = !document.dispatchEvent(event);
    if (!handled) {
      downloadPdf(pdfBytes, filename);
      setStatus(`Converted ${file.name} · downloaded ${filename}`);
    }
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", () => input.click());
input.addEventListener("change", async () => {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    await convertDocx(file);
  } catch (error) {
    console.error(error);
    setStatus(error?.message || String(error), true);
  }
});
