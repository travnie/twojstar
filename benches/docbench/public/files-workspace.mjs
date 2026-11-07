import { inspectLocalFile } from "./file-signatures.mjs";
import { readZipIndex } from "./zip-index.mjs";

const $ = (selector) => document.querySelector(selector);
const { formatBytes, bindFileDrop } = globalThis.BenchLocalFiles;
const fileInput = $("#files-input");
const list = $("#files-list");
const metadata = $("#files-metadata");
const preview = $("#files-preview");
const heading = $("#files-selected");
const status = $("#files-status");
const count = $("#files-count");
const clearButton = $("#files-clear");
const removeButton = $("#files-remove");
const downloadButton = $("#files-download");

const MAX_FILES = 100;
const MAX_TEXT_BYTES = 128 * 1024;
const MAX_IMAGE_BYTES = 48 * 1024 * 1024;
const MAX_HEX_BYTES = 256;
const IMAGE_FORMATS = new Set(["jpeg", "png", "gif", "webp", "avif", "bmp", "ico", "jxl", "heic", "heif", "tiff", "qoi"]);
const AUDIO_FORMATS = new Set(["mp3", "opus", "vorbis", "flac", "wav", "aiff", "ogg", "m4a"]);
const VIDEO_FORMATS = new Set(["mp4", "webm", "mov", "matroska"]);
const TEXT_EXTENSIONS = /\.(?:txt|text|log|md|markdown|jsonc?|json5|jsonl|ndjson|ya?ml|xml|ini|conf|cfg|toml|env|csv|tsv|sh|ps1|bat|cmd|m3u8?|pls|css|js|ts|html?|py|rs|kt|java)$/iu;

const files = [];
let selectedIndex = -1;
let selectionRevision = 0;
let previewUrl = null;

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = String(value);
  return node;
}

function setStatus(message, failed = false) {
  status.textContent = message;
  status.classList.toggle("files-error", failed);
}

function releasePreview() {
  const media = preview.querySelector("audio, video");
  if (media) {
    media.pause();
    media.removeAttribute("src");
    media.load();
  }
  preview.replaceChildren();
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function emptyPreview(message) {
  preview.append(element("p", "files-empty", message));
}

function field(label, value) {
  const wrapper = element("div", "files-meta-field");
  wrapper.append(element("dt", "", label), element("dd", "", value === null || value === "" ? "Unknown" : value));
  return wrapper;
}

function appendMetadata(info, timeMs) {
  metadata.replaceChildren();
  const fields = [
    ["Name", info.name],
    ["Size", formatBytes(info.size) + " (" + info.size.toLocaleString("en-US") + " bytes)"],
    ["Detected", info.label + " · " + info.family],
    ["Evidence", info.evidence],
    ["Signature", info.signature || "None"],
    ["Extension", info.extensionHint || "None"],
    ["Browser MIME", info.declaredMime || "Unspecified"],
    ["MIME hint", info.mimeHint || "None"],
    ["Modified", info.lastModified ? new Date(info.lastModified).toLocaleString() : "Unknown"],
    ["Header read", formatBytes(info.bytesInspected)],
    ["Inspection", timeMs.toFixed(1) + " ms (local)"],
  ];
  for (const [label, value] of fields) metadata.append(field(label, value));
  if (info.mismatch) {
    metadata.prepend(field("Warning", "File signature disagrees with name or MIME. Trust the signature."));
  }
}

function renderList() {
  const fragment = document.createDocumentFragment();
  files.forEach((file, index) => {
    const button = element("button", "files-item");
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === selectedIndex));
    button.append(
      element("span", "files-item-name", file.name || "(unnamed)"),
      element("span", "files-item-size", formatBytes(file.size)),
    );
    button.addEventListener("click", () => void selectFile(index));
    fragment.append(button);
  });
  list.replaceChildren(fragment);
  count.textContent = String(files.length);
  clearButton.disabled = files.length === 0;
  removeButton.disabled = selectedIndex < 0;
  downloadButton.disabled = selectedIndex < 0;
}

async function showZipContents(file, revision) {
  const result = await readZipIndex(file);
  if (revision !== selectionRevision) return;
  const box = element("section", "files-zip");
  box.append(element("h3", "", "ZIP contents · " + result.count + " entries"));
  box.append(element("p", "files-note", "Index only. No decompression or automatic extraction."));
  const listNode = element("ol", "files-zip-list");
  for (const entry of result.entries) {
    const row = element("li", entry.safe ? "" : "files-unsafe");
    const name = element("span", "files-zip-name", entry.name);
    const detail = element("small", "", entry.directory ? "Directory"
      : formatBytes(entry.originalSize) + " · method " + entry.method
        + (entry.encrypted ? " · encrypted" : "")
        + (entry.zip64 ? " · ZIP64 sizes" : ""));
    row.append(name, detail);
    if (!entry.safe) row.append(element("strong", "files-unsafe-label", "Unsafe path"));
    listNode.append(row);
  }
  box.append(listNode);
  preview.append(box);
}

function mediaPreview(file, tag, revision) {
  previewUrl = URL.createObjectURL(file);
  const media = element(tag, "files-media");
  media.src = previewUrl;
  if (tag === "img") {
    media.alt = "Preview of " + (file.name || "local image");
    media.decoding = "async";
  } else {
    media.controls = true;
    media.preload = "metadata";
    if (tag === "video") media.playsInline = true;
  }
  const fallback = element("p", "files-note", "Native browser preview. Codec availability varies.");
  media.addEventListener("error", () => {
    if (revision === selectionRevision) fallback.textContent = "This browser cannot decode the preview. The original file is unchanged.";
  }, { once: true });
  preview.append(media, fallback);
}

function isTextFile(info) {
  if (info.format === "svg") return true;
  if (info.signature && info.family !== "document") return false;
  return info.declaredMime.startsWith("text/")
    || TEXT_EXTENSIONS.test(info.name)
    || ["txt", "json"].includes(info.format);
}

async function renderPreview(file, info, revision) {
  releasePreview();
  if (info.format === "zip") {
    try {
      await showZipContents(file, revision);
    } catch (error) {
      if (revision === selectionRevision) emptyPreview(error.message || "ZIP index unavailable.");
    }
    return;
  }
  if (IMAGE_FORMATS.has(info.format)) {
    if (file.size > MAX_IMAGE_BYTES) {
      emptyPreview("Image preview disabled above " + formatBytes(MAX_IMAGE_BYTES) + " to protect browser memory.");
    } else {
      mediaPreview(file, "img", revision);
    }
    return;
  }
  if (AUDIO_FORMATS.has(info.format)) {
    mediaPreview(file, "audio", revision);
    return;
  }
  if (VIDEO_FORMATS.has(info.format)) {
    mediaPreview(file, "video", revision);
    return;
  }
  if (isTextFile(info)) {
    const source = await file.slice(0, MAX_TEXT_BYTES).text();
    if (revision !== selectionRevision) return;
    const box = element("pre", "files-text", source);
    preview.append(box);
    if (file.size > MAX_TEXT_BYTES) {
      preview.prepend(element("p", "files-note", "Text preview limited to " + formatBytes(MAX_TEXT_BYTES) + "."));
    }
    if (info.format === "svg") {
      preview.prepend(element("p", "files-note", "SVG shown as source only; external references are not loaded."));
    }
    return;
  }
  if (info.format === "pdf" || info.format === "docx") {
    emptyPreview("Use the PDF workspace for document operations. This inspector leaves the file untouched.");
    return;
  }
  const bytes = new Uint8Array(await file.slice(0, MAX_HEX_BYTES).arrayBuffer());
  if (revision !== selectionRevision) return;
  if (!bytes.length) {
    emptyPreview("Empty file.");
    return;
  }
  const lines = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...chunk].map((byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".").join("");
    lines.push(offset.toString(16).padStart(6, "0") + "  " + hex.padEnd(47) + "  " + ascii);
  }
  preview.append(element("p", "files-note", "Hex header, first " + formatBytes(bytes.length) + ". No decoder selected."), element("pre", "files-hex", lines.join("\n")));
}

async function selectFile(index) {
  selectedIndex = index >= 0 && index < files.length ? index : -1;
  const revision = ++selectionRevision;
  renderList();
  releasePreview();
  metadata.replaceChildren();
  if (selectedIndex < 0) {
    heading.textContent = "Choose a file";
    setStatus("Files remain on this device.");
    emptyPreview("Open files or drop them here to inspect their headers.");
    return;
  }

  const file = files[selectedIndex];
  heading.textContent = file.name || "(unnamed)";
  setStatus("Inspecting…");
  const start = performance.now();
  try {
    const info = await inspectLocalFile(file);
    if (revision !== selectionRevision) return;
    appendMetadata(info, performance.now() - start);
    setStatus(info.mismatch ? "Signature mismatch" : info.label, info.mismatch);
    await renderPreview(file, info, revision);
  } catch (error) {
    if (revision !== selectionRevision) return;
    setStatus("Inspection failed", true);
    emptyPreview(error.message || "Could not read the file.");
  }
}

function addFiles(input) {
  const added = Array.from(input || []).filter((file) => file && typeof file.slice === "function");
  if (!added.length) return;
  const capacity = MAX_FILES - files.length;
  if (capacity <= 0) {
    setStatus("The " + MAX_FILES + "-file queue limit is reached.", true);
    return;
  }
  const start = files.length;
  files.push(...added.slice(0, capacity));
  void selectFile(start);
  if (added.length > capacity) {
    setStatus("Only " + capacity + " files added; limit " + MAX_FILES + ".", true);
  }
}

$("#files-open").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});
clearButton.addEventListener("click", () => {
  files.length = 0;
  void selectFile(-1);
});
removeButton.addEventListener("click", () => {
  if (selectedIndex < 0) return;
  const next = selectedIndex;
  files.splice(selectedIndex, 1);
  void selectFile(files.length ? Math.min(next, files.length - 1) : -1);
});
downloadButton.addEventListener("click", () => {
  if (selectedIndex < 0) return;
  const file = files[selectedIndex];
  const href = URL.createObjectURL(file);
  const link = element("a");
  link.href = href;
  link.download = file.name || "download";
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
});

bindFileDrop($("#files-drop-zone"), addFiles);
bindFileDrop($("#files-list"), addFiles);
window.addEventListener("pagehide", releasePreview);
void selectFile(-1);
