const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const TEXT_EXTENSIONS = new Set(["txt", ...MARKDOWN_EXTENSIONS]);

function extension(name) {
  const filename = String(name || "");
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function isMergeTextFilename(name) {
  return TEXT_EXTENSIONS.has(extension(name));
}

export function mergeTextDocuments(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new Error("Choose at least two TXT or Markdown files to merge.");
  }

  let markdown = false;
  const texts = documents.map((document, index) => {
    const name = String(document?.name || `file-${index + 1}.txt`);
    const ext = extension(name);
    if (!TEXT_EXTENSIONS.has(ext)) {
      throw new Error(`${name}: only .txt, .md and .markdown files can be merged.`);
    }
    if (MARKDOWN_EXTENSIONS.has(ext)) markdown = true;
    return String(document?.text ?? "");
  });

  return {
    filename: markdown ? "merged.md" : "merged.txt",
    format: markdown ? "md" : "txt",
    text: texts.join("\n\n"),
  };
}
