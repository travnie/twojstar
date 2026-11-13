// Shared file-type routing for the Files shell. No UI or file reads.
/**
 * @typedef {{
 *   name: string,
 *   format: string | null,
 *   signature: string | null,
 *   extensionHint: string | null,
 *   declaredMime: string,
 *   mismatch: boolean
 * }} InspectedFile
 */

/** @typedef {{ mode: 'pdf' | 'document', event: string, label: string }} FileRoute */
const MAX_EDIT_BYTES = 32 * 1024 * 1024;

/**
 * @param {InspectedFile | null | undefined} info
 * @returns {boolean}
 */
export function isTextFile(info) {
  if (!info) return false;
  if (info.format === "svg") return true;
  if (info.signature) return false;
  const documentFormats = /** @type {{ DocBenchTextFormats?: { formatHintFromFilename?: (name: string) => string | null } }} */ (globalThis).DocBenchTextFormats;
  return info.declaredMime.startsWith("text/")
    || Boolean(documentFormats?.formatHintFromFilename?.(info.name))
    || (info.format !== null && ["txt", "json"].includes(info.format));
}

/**
 * @param {InspectedFile | null | undefined} info
 * @param {number} size
 * @returns {FileRoute | null}
 */
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
