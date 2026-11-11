import { inspectLocalFile } from "./file-signatures.mjs";
import { readZipIndex } from "./zip-index.mjs";
import { createFileStore, adjacentVisibleId } from "./file-store.mjs";
import { isTextFile, resolveFileTool } from "./file-routing.mjs";

const getNode = (selector) => document.querySelector(selector);
const { formatBytes, bindFileDrop } = globalThis.BenchLocalFiles;
const fileInput = getNode("#files-input");
const list = getNode("#files-list");
const metadata = getNode("#files-metadata");
const preview = getNode("#files-preview");
const heading = getNode("#files-selected");
const status = getNode("#files-status");
const count = getNode("#files-count");
const clearButton = getNode("#files-clear");
const removeButton = getNode("#files-remove");
const previewButton = getNode("#files-preview-open");
const toolButton = getNode("#files-open-tool");
const toolActions = getNode("#files-inspector-actions");
const folderInput = getNode("#files-folder-input");
const folderSelect = getNode("#files-folder-filter");
const search = getNode("#files-search");
const sort = getNode("#files-sort");
const viewList = getNode("#files-view-list");
const viewGrid = getNode("#files-view-grid");
const selectVisible = getNode("#files-select-visible");
const dialog = getNode("#files-preview-dialog");
const dialogBody = getNode("#files-dialog-body");
const dialogHeading = getNode("#files-dialog-name");
const dialogPrevious = getNode("#files-dialog-previous");
const dialogNext = getNode("#files-dialog-next");
const dialogPosition = getNode("#files-dialog-position");

const MAX_FILES = 100;
const MAX_TEXT_BYTES = 128 * 1024;
const MAX_IMAGE_BYTES = 48 * 1024 * 1024;
const MAX_HEX_BYTES = 256;
const IMAGE_FORMATS = new Set(["jpeg", "png", "gif", "webp", "avif", "bmp", "ico", "jxl", "heic", "heif", "tiff", "qoi"]);
const AUDIO_FORMATS = new Set(["mp3", "opus", "vorbis", "flac", "wav", "aiff", "ogg", "m4a"]);
const VIDEO_FORMATS = new Set(["mp4", "webm", "mov", "matroska"]);

const store = createFileStore({ limit: 100 });
const previewUrls = new Map();
let selectionRevision = 0;
let viewMode = "list";
let query = "";
let folder = "";
let sortBy = "name";
let activeRendered = null;
let activeTool = null;
let dialogIds = [];
let dialogId = null;
let dialogRevision = 0;
let dialogFocusReturn = null;

function isCurrentPreview(target, revision) {
  return target === dialogBody
    ? dialog.open && revision === dialogRevision
    : revision === selectionRevision;
}

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

function releasePreview(target = preview) {
  const media = target.querySelector("audio, video");
  if (media) {
    media.pause();
    media.removeAttribute("src");
    media.load();
  }
  target.replaceChildren();
  const url = previewUrls.get(target);
  if (url) URL.revokeObjectURL(url);
  previewUrls.delete(target);
}

function emptyPreview(message, target = preview) {
  target.append(element("p", "files-empty", message));
}

function field(label, value) {
  const wrapper = element("div", "files-meta-field");
  const body = element("dd", "", value === null || value === "" ? "Unknown" : value);
  body.dataset.i18nSkip = "";
  wrapper.append(element("dt", "", label), body);
  return wrapper;
}

function appendMetadata(info, timeMs) {
  metadata.replaceChildren();
  const fields = [
    ["Name", info.name],
    ["Size", `${formatBytes(info.size)} (${info.size.toLocaleString("en-US")} bytes)`],
    ["Detected", `${info.label} · ${info.family}`],
    ["Evidence", info.evidence],
    ["Signature", info.signature || "None"],
    ["Extension", info.extensionHint || "None"],
    ["Browser MIME", info.declaredMime || "Unspecified"],
    ["MIME hint", info.mimeHint || "None"],
    ["Modified", info.lastModified ? new Date(info.lastModified).toLocaleString() : "Unknown"],
    ["Header read", formatBytes(info.bytesInspected)],
    ["Inspection", `${timeMs.toFixed(1)} ms (local)`],
  ];
  for (const [label, value] of fields) metadata.append(field(label, value));
  if (info.mismatch) {
    metadata.prepend(field("Warning", "File signature disagrees with name or MIME. Trust the signature."));
  }
}

function currentVisible() {
  return store.visible({ query, folder, sort: sortBy });
}

function iconFor(entry) {
  const name = entry.name.toLowerCase();
  if (/\.(?:png|jpe?g|gif|webp|avif|jxl|heic|qoi)$/u.test(name)) return "▧";
  if (/\.(?:mp3|opus|ogg|flac|wav|m4a)$/u.test(name)) return "♫";
  if (/\.(?:mp4|webm|mov|mkv)$/u.test(name)) return "▶";
  if (/\.(?:zip|rar|7z|tar|gz|xz)$/u.test(name)) return "▣";
  return "▤";
}

function renderList() {
  if (folder && !store.folders().includes(folder)) folder = "";
  const entries = currentVisible();
  const ids = entries.map((entry) => entry.id);
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const row = element("div", "files-row");
    row.classList.toggle("files-row-active", entry.active);
    row.classList.toggle("files-row-selected", entry.selected);
    const checkbox = element("input", "files-checkbox");
    checkbox.type = "checkbox";
    checkbox.checked = entry.selected;
    checkbox.setAttribute("aria-label", "Select " + entry.name);
    checkbox.addEventListener("change", () => {
      store.choose(entry.id, { toggle: true, focus: false });
    });
    const button = element("button", "files-item");
    button.type = "button";
    button.setAttribute("aria-current", entry.active ? "true" : "false");
    const name = element("span", "files-item-name", entry.name);
    name.dataset.i18nSkip = "";
    button.append(
      element("span", "files-item-icon", iconFor(entry)),
      name,
      element("span", "files-item-size", formatBytes(entry.size)),
    );
    if (entry.folder) {
      const pathLabel = element("small", "files-item-path", entry.folder);
      pathLabel.dataset.i18nSkip = "";
      button.append(pathLabel);
    }
    button.addEventListener("click", (event) => store.choose(entry.id, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
      visibleIds: ids,
    }));
    button.addEventListener("dblclick", () => openDialog());
    row.append(checkbox, button);
    fragment.append(row);
  }
  if (!entries.length) {
    fragment.append(element("p", "files-note", store.count()
      ? "No files match the current filters." : "Add files to begin."));
  }
  list.replaceChildren(fragment);
  list.classList.toggle("files-list-grid", viewMode === "grid");
  const selectedCount = store.selectedIds().length;
  count.textContent = store.count() + " · " + selectedCount + " selected";
  clearButton.disabled = store.count() === 0;
  removeButton.disabled = selectedCount === 0;
  previewButton.disabled = !store.activeId();
  selectVisible.disabled = !ids.length;

  const available = store.folders();
  const requested = folder;
  folderSelect.replaceChildren(new Option("All folders", ""));
  for (const path of available) {
    const option = new Option(path, path);
    option.dataset.i18nSkip = "";
    folderSelect.add(option);
  }
  if (requested && !available.includes(requested)) folder = "";
  folderSelect.value = folder;
  viewList.setAttribute("aria-pressed", String(viewMode === "list"));
  viewGrid.setAttribute("aria-pressed", String(viewMode === "grid"));
}

async function showZipContents(file, revision, target = preview) {
  const result = await readZipIndex(file);
  if (!isCurrentPreview(target, revision)) return;
  const box = element("section", "files-zip");
  box.append(element("h3", "", `ZIP contents · ${result.count} entries`));
  box.append(element("p", "files-note", "Index only. No decompression or automatic extraction."));
  const listNode = element("ol", "files-zip-list");
  for (const entry of result.entries) {
    const row = element("li", entry.safe ? "" : "files-unsafe");
    const name = element("span", "files-zip-name", entry.name);
    name.dataset.i18nSkip = "";
    const detail = element("small", "", entry.zip64 ? "ZIP64 sizes · unsupported"
      : entry.directory ? "Directory"
        : `${formatBytes(entry.originalSize)} · method ${entry.method}${entry.encrypted ? " · encrypted" : ""}`);
    row.append(name, detail);
    if (!entry.safe) row.append(element("strong", "files-unsafe-label", "Unsafe path"));
    listNode.append(row);
  }
  box.append(listNode);
  target.append(box);
}

const MEDIA_MIME = Object.freeze({
  jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", bmp: "image/bmp",
  ico: "image/x-icon", jxl: "image/jxl", heic: "image/heic",
  heif: "image/heif", tiff: "image/tiff", qoi: "image/qoi",
  mp3: "audio/mpeg", opus: "audio/ogg", vorbis: "audio/ogg",
  flac: "audio/flac", wav: "audio/wav", aiff: "audio/aiff",
  ogg: "audio/ogg", m4a: "audio/mp4",
  mp4: "video/mp4", webm: "video/webm",
  mov: "video/quicktime", matroska: "video/x-matroska",
});

function mediaPreview(file, format, revision, target = preview) {
  // Passive MIME + concrete media element. Never embed SVG or active documents.
  const blob = file.slice(0, file.size, MEDIA_MIME[format]);
  const url = URL.createObjectURL(blob);
  previewUrls.set(target, url);
  const fallback = element("p", "files-note", "Native browser preview. Codec availability varies.");
  const onError = () => {
    if (isCurrentPreview(target, revision)) {
      fallback.textContent = "This browser cannot decode the preview. The original file is unchanged.";
    }
  };
  if (IMAGE_FORMATS.has(format)) {
    const image = document.createElement("img");
    image.className = "files-media";
    image.alt = `Preview of ${file.name || "local image"}`;
    image.decoding = "async";
    image.addEventListener("error", onError, { once: true });
    image.src = url;
    target.append(image, fallback);
    return;
  }
  if (AUDIO_FORMATS.has(format)) {
    const audio = document.createElement("audio");
    audio.className = "files-media";
    audio.controls = true;
    audio.preload = "metadata";
    audio.addEventListener("error", onError, { once: true });
    audio.src = url;
    target.append(audio, fallback);
    return;
  }
  const video = document.createElement("video");
  video.className = "files-media";
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.addEventListener("error", onError, { once: true });
  video.src = url;
  target.append(video, fallback);
}

async function renderPreview(file, info, revision, target = preview) {
  releasePreview(target);
  if (info.format === "zip") {
    try {
      await showZipContents(file, revision, target);
    } catch (error) {
      if (isCurrentPreview(target, revision)) emptyPreview(error.message || "ZIP index unavailable.", target);
    }
    return;
  }
  if (IMAGE_FORMATS.has(info.format)) {
    if (file.size > MAX_IMAGE_BYTES) {
      emptyPreview(`Image preview disabled above ${formatBytes(MAX_IMAGE_BYTES)} to protect browser memory.`, target);
    } else {
      mediaPreview(file, info.format, revision, target);
    }
    return;
  }
  if (AUDIO_FORMATS.has(info.format)) {
    mediaPreview(file, info.format, revision, target);
    return;
  }
  if (VIDEO_FORMATS.has(info.format)) {
    mediaPreview(file, info.format, revision, target);
    return;
  }
  if (isTextFile(info)) {
    const source = await file.slice(0, MAX_TEXT_BYTES).text();
    if (!isCurrentPreview(target, revision)) return;
    const box = element("pre", "files-text", source);
    target.append(box);
    if (file.size > MAX_TEXT_BYTES) {
      target.prepend(element("p", "files-note", `Text preview limited to ${formatBytes(MAX_TEXT_BYTES)}.`));
    }
    if (info.format === "svg") {
      target.prepend(element("p", "files-note", "SVG shown as source only; external references are not loaded."));
    }
    return;
  }
  if (info.format === "pdf" || info.format === "docx") {
    emptyPreview("Use the PDF workspace for document operations. This inspector leaves the file untouched.", target);
    return;
  }
  const bytes = new Uint8Array(await file.slice(0, MAX_HEX_BYTES).arrayBuffer());
  if (!isCurrentPreview(target, revision)) return;
  if (!bytes.length) {
    emptyPreview("Empty file.", target);
    return;
  }
  const lines = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const chunk = bytes.subarray(offset, offset + 16);
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...chunk].map((byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".").join("");
    lines.push(`${offset.toString(16).padStart(6, "0")}  ${hex.padEnd(47)}  ${ascii}`);
  }
  target.append(element("p", "files-note", `Hex header, first ${formatBytes(bytes.length)}. No decoder selected.`), element("pre", "files-hex", lines.join("\n")));
}

function updateTool(entry, info) {
  activeTool = null;
  toolActions.hidden = true;
  if (!entry || !info) return;

  const action = resolveFileTool(info, entry.size);
  if (!action) return;
  activeTool = { ...action, id: entry.id };
  toolButton.textContent = action.label;
  toolActions.hidden = false;
}

let openingTool = false;
async function openInTool() {
  const entry = store.get(store.activeId());
  if (openingTool || !activeTool || !entry || activeTool.id !== entry.id) return;
  const action = { ...activeTool };
  openingTool = true;
  toolButton.disabled = true;
  setStatus("Opening in specialist tool…");
  try {
    const request = new CustomEvent(action.event, {
      cancelable: true,
      detail: { file: entry.file, openPromise: null },
    });
    if (document.dispatchEvent(request)) {
      setStatus("The selected tool is not ready. Try again.", true);
      return;
    }
    if (!request.detail.openPromise) {
      setStatus("The selected tool did not acknowledge opening.", true);
      return;
    }
    const result = await request.detail.openPromise;
    if (!result?.ok) {
      setStatus(result?.error || "File opening was canceled.", !result?.cancelled);
      return;
    }
    document.dispatchEvent(new CustomEvent("docbench:activate-workspace", {
      detail: { mode: action.mode },
    }));
  } catch (error) {
    setStatus(error?.message || "Could not open this file.", true);
  } finally {
    openingTool = false;
    toolButton.disabled = false;
  }
}

async function showActive() {
  const activeId = store.activeId();
  updateTool(null, null);
  if (activeRendered !== activeId) {
    if (dialog.open) dialog.close();
    releasePreview(dialogBody);
    activeRendered = activeId;
  }
  const revision = ++selectionRevision;
  releasePreview();
  metadata.replaceChildren();
  if (!activeId) {
    heading.removeAttribute("data-i18n-skip");
    heading.textContent = "Choose a file";
    setStatus("Files remain on this device.");
    emptyPreview("Open files or drop them here to inspect their headers.");
    return;
  }

  const entry = store.get(activeId);
  if (!entry) return;
  const file = entry.file;
  heading.dataset.i18nSkip = "";
  heading.textContent = entry.path;
  setStatus("Inspecting…");
  const start = performance.now();
  try {
    const info = await inspectLocalFile(file);
    if (revision !== selectionRevision) return;
    appendMetadata(info, performance.now() - start);
    updateTool(entry, info);
    metadata.prepend(field("Virtual path", entry.path));
    setStatus(info.mismatch ? "Signature mismatch" : info.label, info.mismatch);
    await renderPreview(file, info, revision);
  } catch (error) {
    if (revision !== selectionRevision) return;
    setStatus("Inspection failed", true);
    emptyPreview(error.message || "Could not read the file.");
  }
}

function updateDialogNavigation() {
  const index = dialogIds.indexOf(dialogId);
  dialogPrevious.disabled = index <= 0;
  dialogNext.disabled = index < 0 || index >= dialogIds.length - 1;
  dialogPosition.textContent = index >= 0 ? `${index + 1} / ${dialogIds.length}` : "";
}

async function showDialogEntry(id) {
  if (!dialog.open) return;
  const entry = store.get(id);
  if (!entry) {
    dialog.close();
    return;
  }
  const revision = ++dialogRevision;
  dialogId = id;
  dialogHeading.dataset.i18nSkip = "";
  dialogHeading.textContent = entry.path;
  updateDialogNavigation();
  releasePreview(dialogBody);
  emptyPreview("Preparing preview…", dialogBody);
  try {
    const info = await inspectLocalFile(entry.file);
    if (!isCurrentPreview(dialogBody, revision)) return;
    await renderPreview(entry.file, info, revision, dialogBody);
  } catch (error) {
    if (!isCurrentPreview(dialogBody, revision)) return;
    releasePreview(dialogBody);
    emptyPreview(error.message || "Preview unavailable.", dialogBody);
  }
}

function navigateDialog(step) {
  const next = adjacentVisibleId(dialogIds, dialogId, step);
  if (next) void showDialogEntry(next);
}

function openDialog() {
  if (dialog.open) return;
  const currentId = store.activeId();
  if (!currentId || !store.get(currentId)) return;
  dialogIds = currentVisible().map((entry) => entry.id);
  if (!dialogIds.includes(currentId)) dialogIds = [currentId];
  dialogFocusReturn = document.activeElement;
  dialog.showModal();
  void showDialogEntry(currentId);
}

function addFiles(input) {
  const result = store.addFiles(input);
  if (result.skipped) setStatus("Only " + result.ids.length + " files added. Queue limit: 100.", true);
}

toolButton.addEventListener("click", openInTool);
getNode("#files-new-document").addEventListener("click", () => {
  const newButton = getNode("#new-button");
  if (!newButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))) return;
  document.dispatchEvent(new CustomEvent("docbench:activate-workspace", {
    detail: { mode: "document" },
  }));
});
getNode("#files-open").addEventListener("click", () => fileInput.click());
getNode("#files-open-folder").addEventListener("click", () => folderInput.click());
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});
folderInput.addEventListener("change", () => {
  addFiles(folderInput.files);
  folderInput.value = "";
});
clearButton.addEventListener("click", () => store.clear());
removeButton.addEventListener("click", () => store.remove(store.selectedIds()));
previewButton.addEventListener("click", openDialog);
getNode("#files-dialog-close").addEventListener("click", () => dialog.close());
dialogPrevious.addEventListener("click", () => navigateDialog(-1));
dialogNext.addEventListener("click", () => navigateDialog(1));
dialog.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey
    || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  if (event.target instanceof Element
    && event.target.closest("audio, video, input, select, textarea, [contenteditable]")) return;
  event.preventDefault();
  navigateDialog(event.key === "ArrowRight" ? 1 : -1);
});
dialog.addEventListener("close", () => {
  dialogRevision += 1;
  dialogIds = [];
  dialogId = null;
  releasePreview(dialogBody);
  dialogPosition.textContent = "";
  const focusTarget = dialogFocusReturn;
  dialogFocusReturn = null;
  if (focusTarget instanceof HTMLElement && focusTarget.isConnected
    && !focusTarget.disabled && !focusTarget.closest("[hidden]")) focusTarget.focus();
  else if (!previewButton.disabled) previewButton.focus();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
search.addEventListener("input", () => {
  query = search.value;
  renderList();
});
sort.addEventListener("change", () => {
  sortBy = sort.value;
  renderList();
});
folderSelect.addEventListener("change", () => {
  folder = folderSelect.value;
  renderList();
});
viewList.addEventListener("click", () => { viewMode = "list"; renderList(); });
viewGrid.addEventListener("click", () => { viewMode = "grid"; renderList(); });
selectVisible.addEventListener("click", () => {
  store.setSelection(currentVisible().map((entry) => entry.id));
});
bindFileDrop(getNode("#files-drop-zone"), addFiles);
bindFileDrop(list, addFiles);
store.subscribe(() => {
  renderList();
  if (activeRendered !== store.activeId()) showActive();
});
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  releasePreview();
  releasePreview(dialogBody);
  store.clear();
});
globalThis.DocBenchFiles = Object.freeze({
  snapshot: (options) => store.snapshot(options),
  inspect: async (id) => {
    const entry = store.get(id);
    if (!entry) return { ok: false, error: "Unknown or stale file ID." };
    const info = await inspectLocalFile(entry.file);
    return { ok: true, id, format: info.format, family: info.family,
      size: info.size, mismatch: Boolean(info.mismatch),
      evidence: info.evidence, signature: info.signature || null };
  },
  select: (ids) => store.setSelection(ids),
  focus: (id) => store.setActive(id),
});
document.dispatchEvent(new Event("docbench:files-ready"));
renderList();
showActive();
