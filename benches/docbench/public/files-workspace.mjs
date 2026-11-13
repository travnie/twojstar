import { inspectLocalFile } from "./file-signatures.mjs";
import { readZipIndex } from "./zip-index.mjs";
import { createZipTree } from "./zip-tree.mjs";
import { createFileStore, adjacentVisibleId, createFileIngress } from "./file-store.mjs";
import { isTextFile, resolveFileTool } from "./file-routing.mjs";
import { ZIP_PACK_LIMITS, planZipEntries, createMemoryZipSink, packZip } from "./zip-pack.mjs";

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
const audioOpenButton = getNode("#files-play-audio");
const audioDock = getNode("#files-audio-dock");
const audioDockTitle = getNode("#files-audio-title");
const audioDockStatus = getNode("#files-audio-status");
const audioDockPlayer = getNode("#files-audio-player");
const toolActions = getNode("#files-inspector-actions");
const folderInput = getNode("#files-folder-input");
const folderSelect = getNode("#files-folder-filter");
const search = getNode("#files-search");
const sort = getNode("#files-sort");
const viewList = getNode("#files-view-list");
const viewGrid = getNode("#files-view-grid");
const selectVisible = getNode("#files-select-visible");
const packZipButton = getNode("#files-pack-zip");
const cancelZipButton = getNode("#files-zip-cancel");
const zipProgress = getNode("#files-zip-progress");
const zipStatus = getNode("#files-zip-status");
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
let activeAudioTool = null;
let audioDockId = null;
let audioDockUrl = null;
let dialogIds = [];
let dialogId = null;
let dialogRevision = 0;
let dialogFocusReturn = null;
let zipController = null;
let zipFinalizing = false;

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

function closeAudioDock() {
  audioDockPlayer.pause();
  audioDockPlayer.removeAttribute("src");
  audioDockPlayer.load();
  if (audioDockUrl) URL.revokeObjectURL(audioDockUrl);
  audioDockUrl = null;
  audioDockId = null;
  audioDock.hidden = true;
  audioDockStatus.textContent = "";
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
  packZipButton.disabled = selectedCount === 0 || Boolean(zipController);

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
  const tree = createZipTree(result.entries);
  const box = element("section", "files-zip");
  const title = element("h3", "", `ZIP contents · ${tree.total} entries`);
  const note = element("p", "files-note",
    "Index only. Folder navigation does not decompress or extract files.");
  const warning = tree.skipped
    ? element("p", "files-unsafe-label", `${tree.skipped} unsafe, ambiguous or unsupported entries hidden.`)
    : null;
  const breadcrumb = element("nav", "files-zip-breadcrumbs");
  breadcrumb.setAttribute("aria-label", "ZIP folder navigation");
  const listNode = element("ol", "files-zip-list");
  const entryDetails = element("dl", "files-zip-entry-details");
  entryDetails.hidden = true;
  if (warning) box.append(title, note, warning, breadcrumb, listNode, entryDetails);
  else box.append(title, note, breadcrumb, listNode, entryDetails);
  target.append(box);

  function navigate(path) {
    if (!isCurrentPreview(target, revision)) return;
    const view = tree.list(path);
    if (!view) return;
    entryDetails.hidden = true;
    entryDetails.replaceChildren();
    breadcrumb.replaceChildren();
    const trail = [{ label: "Archive root", path: "" }];
    if (path) {
      const parts = path.split("/");
      for (let i = 0; i < parts.length; i += 1) {
        trail.push({ label: parts[i], path: parts.slice(0, i + 1).join("/") });
      }
    }
    for (const [index, step] of trail.entries()) {
      if (index) breadcrumb.append(element("span", "files-zip-separator", "/"));
      const link = element("button", "files-zip-breadcrumb", step.label);
      link.type = "button";
      link.disabled = step.path === path;
      link.addEventListener("click", () => navigate(step.path));
      breadcrumb.append(link);
    }
    listNode.replaceChildren();
    if (view.parentPath !== null) {
      const row = element("li", "files-zip-folder");
      const up = element("button", "files-zip-entry-button", "↰ Go up");
      up.type = "button";
      up.addEventListener("click", () => navigate(view.parentPath));
      row.append(up);
      listNode.append(row);
    }
    for (const folder of view.folders) {
      const row = element("li", "files-zip-folder");
      const button = element("button", "files-zip-entry-button", "▣ " + folder.name + "/");
      button.type = "button";
      button.dataset.i18nSkip = "";
      button.setAttribute("aria-label", "Open ZIP folder " + folder.name);
      button.addEventListener("click", () => navigate(folder.path));
      row.append(button);
      listNode.append(row);
    }
    for (const entry of view.files) {
      const row = element("li", "files-zip-file");
      const button = element("button", "files-zip-entry-button", entry.name);
      button.type = "button";
      button.dataset.i18nSkip = "";
      button.addEventListener("click", () => {
        if (!isCurrentPreview(target, revision)) return;
        entryDetails.replaceChildren();
        const properties = [
          ["Path", entry.path],
          ["Original size", formatBytes(entry.originalSize)],
          ["Compressed size", formatBytes(entry.compressedSize)],
          ["Method", String(entry.method)],
          ["Encrypted", entry.encrypted ? "Yes" : "No"],
          ["ZIP64", entry.zip64 ? "Unsupported" : "No"],
        ];
        for (const [name, value] of properties) {
          const field = element("div", "files-zip-property");
          const key = element("dt", "", name);
          const data = element("dd", "", value);
          data.dataset.i18nSkip = "";
          field.append(key, data);
          entryDetails.append(field);
        }
        entryDetails.hidden = false;
      });
      const size = element("small", "", `${formatBytes(entry.originalSize)} · method ${entry.method}${entry.encrypted ? " · encrypted" : ""}`);
      row.append(button, size);
      listNode.append(row);
    }
    if (!view.folders.length && !view.files.length) {
      const row = element("li", "files-zip-empty", "No entries in this folder.");
      listNode.append(row);
    }
  }
  navigate("");
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

function playAudioDock() {
  const selection = activeAudioTool;
  const entry = store.get(selection?.id);
  if (!entry || entry.id !== store.activeId() || !AUDIO_FORMATS.has(selection.format)) return;
  closeAudioDock();
  const blob = entry.file.slice(0, entry.file.size, MEDIA_MIME[selection.format]);
  audioDockUrl = URL.createObjectURL(blob);
  audioDockId = entry.id;
  audioDockTitle.dataset.i18nSkip = "";
  audioDockTitle.textContent = entry.path;
  audioDockPlayer.src = audioDockUrl;
  audioDock.hidden = false;
  preview.querySelector("audio")?.pause();
  dialogBody.querySelector("audio")?.pause();
  const started = audioDockPlayer.play();
  if (started && typeof started.catch === "function") {
    void started.catch(() => {
      if (audioDockId === entry.id) audioDockStatus.textContent = "Press Play to start audio.";
    });
  }
}

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
  activeAudioTool = null;
  toolActions.hidden = true;
  toolButton.hidden = true;
  audioOpenButton.hidden = true;
  if (!entry || !info) return;

  if (AUDIO_FORMATS.has(info.format)) {
    activeAudioTool = { id: entry.id, format: info.format };
    audioOpenButton.hidden = false;
    toolActions.hidden = false;
  }
  const action = resolveFileTool(info, entry.size);
  if (!action) return;
  activeTool = { ...action, id: entry.id };
  toolButton.textContent = action.label;
  toolButton.hidden = false;
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

let zipStatusSource = "";
function setZipStatus(message) {
  zipStatusSource = message;
  zipStatus.textContent = globalThis.BenchI18n?.t(message) || message;
}
window.addEventListener("bench:languagechange", () => {
  if (zipStatusSource) setZipStatus(zipStatusSource);
});

async function packSelectedZip() {
  if (zipController) return;
  let selected;
  try {
    selected = planZipEntries(store.selectedIds().map((id) => store.get(id)));
  } catch (error) {
    setZipStatus(error?.message || "Invalid ZIP selection.");
    return;
  }
  const nativeSave = globalThis.isSecureContext
    && typeof globalThis.showSaveFilePicker === "function";
  if (!nativeSave && selected.totalBytes > ZIP_PACK_LIMITS.maxMemorySourceBytes) {
    setZipStatus("This browser supports ZIP downloads up to 56 MiB of source files.");
    return;
  }
  if (!globalThis.fflate?.ZipDeflate) {
    setZipStatus("Local ZIP compression is unavailable.");
    return;
  }

  const controller = new AbortController();
  zipController = controller;
  cancelZipButton.hidden = false;
  zipProgress.hidden = false;
  zipProgress.value = 0;
  setZipStatus("Preparing ZIP…");
  renderList();
  try {
    let sink;
    if (nativeSave) {
      let handle;
      try {
        handle = await globalThis.showSaveFilePicker({
          suggestedName: "docbench-files.zip",
          types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          setZipStatus("ZIP export canceled.");
          return;
        }
        throw error;
      }
      if (controller.signal.aborted) return;
      const writable = await handle.createWritable();
      sink = {
        write: (bytes) => writable.write(bytes),
        close: () => writable.close(),
        abort: () => writable.abort(),
      };
    } else {
      sink = createMemoryZipSink();
    }
    const result = await packZip(selected.items, {
      zipApi: globalThis.fflate, sink, signal: controller.signal,
      maxSourceBytes: nativeSave ? ZIP_PACK_LIMITS.maxSourceBytes : ZIP_PACK_LIMITS.maxMemorySourceBytes,
      maxOutputBytes: nativeSave ? ZIP_PACK_LIMITS.maxStreamBytes : ZIP_PACK_LIMITS.maxMemoryBytes,
      onProgress: ({ phase, filesDone, filesTotal, bytesDone, bytesTotal }) => {
        if (phase === "committing") {
          zipFinalizing = true;
          cancelZipButton.hidden = true;
          setZipStatus("Finalizing ZIP…");
          return;
        }
        zipProgress.value = Math.round(100 * (bytesTotal ? bytesDone / bytesTotal : filesDone / filesTotal));
        setZipStatus(`Packing ZIP · ${filesDone}/${filesTotal} files · ${formatBytes(bytesDone)} / ${formatBytes(bytesTotal)}`);
      },
    });
    if (!nativeSave) {
      const url = URL.createObjectURL(result.output);
      const link = document.createElement("a");
      link.href = url;
      link.download = "docbench-files.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    zipProgress.value = 100;
    setZipStatus(`ZIP saved · ${result.files} files · ${formatBytes(result.outputBytes)}`);
  } catch (error) {
    setZipStatus(controller.signal.aborted || error?.name === "AbortError"
      ? "ZIP packing canceled." : `ZIP failed: ${error?.message || String(error)}`);
  } finally {
    zipController = null;
    zipFinalizing = false;
    cancelZipButton.hidden = true;
    zipProgress.hidden = true;
    renderList();
  }
}

packZipButton.addEventListener("click", () => void packSelectedZip());
cancelZipButton.addEventListener("click", () => {
  if (!zipFinalizing) zipController?.abort();
});
toolButton.addEventListener("click", openInTool);
audioOpenButton.addEventListener("click", playAudioDock);
getNode("#files-audio-close").addEventListener("click", closeAudioDock);
audioDockPlayer.addEventListener("error", () => {
  if (audioDockId) audioDockStatus.textContent = "This browser cannot play the selected audio codec.";
});
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
  if (audioDockId && !store.get(audioDockId)) closeAudioDock();
  renderList();
  if (activeRendered !== store.activeId()) showActive();
});
const filesPanel = getNode("#files-workspace");
new MutationObserver(() => {
  if (filesPanel.hidden && audioDockId) closeAudioDock();
  if (filesPanel.hidden && !zipFinalizing) zipController?.abort();
}).observe(filesPanel, { attributes: true, attributeFilter: ["hidden"] });
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  if (!zipFinalizing) zipController?.abort();
  closeAudioDock();
  releasePreview();
  releasePreview(dialogBody);
  store.clear();
});
const nativeIngress = createFileIngress(store, {
  canImport: () => !openingTool,
  resetView: () => {
    query = "";
    search.value = "";
    folder = "";
    folderSelect.value = "";
    renderList();
  },
  activateFiles: () => document.dispatchEvent(new CustomEvent("docbench:activate-workspace", {
    detail: { mode: "files" },
  })),
});
globalThis.DocBenchFiles = Object.freeze({
  ...nativeIngress,
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
