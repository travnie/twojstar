// Shared file-type routing for the Files shell. No UI or file reads.
const MAX_EDIT_BYTES = 32 * 1024 * 1024;

export function isTextFile(info) {
  if (!info) return false;
  if (info.format === "svg") return true;
  if (info.signature) return false;
  const documentFormats = globalThis.DocBenchTextFormats;
  return info.declaredMime.startsWith("text/")
    || Boolean(documentFormats?.formatHintFromFilename?.(info.name))
    || ["txt", "json"].includes(info.format);
}

export function resolveFileTool(info, size) {
  if (!info || !Number.isSafeInteger(size) || size < 0) return null;
  if (info.format === "pdf" && info.signature === "pdf") {
    return { mode: "pdf", event: "docbench:open-pdf-file", label: "Open in PDF tools" };
  }
  if (info.format === "zip" && info.signature === "zip"
    && info.extensionHint === "docx" && !info.mismatch && size <= MAX_EDIT_BYTES) {
    return { mode: "pdf", event: "docbench:convert-docx-file", label: "Convert DOCX to PDF" };
  }
  if (isTextFile(info) && size <= MAX_EDIT_BYTES) {
    return { mode: "document", event: "docbench:open-document-file", label: "Open in text editor" };
  }
  return null;
}
