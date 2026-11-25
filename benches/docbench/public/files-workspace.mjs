import { inspectLocalFile } from "./file-signatures.mjs";
import { readZipIndex } from "./zip-index.mjs";
import { runWasmArchiveJob, wasmArchiveEntryReason, wasmArchiveBatchReason } from "./archive-engine.mjs";
import { decompressGzipTar, readTarIndex } from "./tar-index.mjs";
import { createZipTree } from "./zip-tree.mjs";
import { ZIP_EXTRACT_LIMITS, zipEntryEligibility, planZipExtraction,
  extractZipEntry, createMemoryExtractSink, createVerifySink } from "./zip-extract.mjs";
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
const inspectButton = getNode("#files-inspect-open");
const inspectorClose = getNode("#files-inspect-close");
const inspector = getNode("#files-inspector");
const inspectorHome = inspector.parentElement;
const inspectorSheet = getNode("#files-inspector-sheet");
const inspectorSummary = status.parentElement;
const previewSummary = getNode("#files-preview-summary");
const previewCaption = getNode("#files-preview-caption");
const inspectorViewport = matchMedia("(max-width: 800px)");
const filesPanel = getNode("#files-workspace");
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
const compressionSelect = getNode("#files-zip-compression");
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
const MAX_ARCHIVE_PREVIEW_BYTES = 8 * 1024 * 1024;
const ZIP_PREVIEW_LIMITS = Object.freeze({
  ...ZIP_EXTRACT_LIMITS,
  maxEntryBytes: MAX_ARCHIVE_PREVIEW_BYTES,
});
const IMAGE_FORMATS = new Set(["jpeg", "png", "gif", "webp", "avif", "bmp", "ico", "jxl", "heic", "heif", "tiff", "qoi"]);
const AUDIO_FORMATS = new Set(["mp3", "opus", "vorbis", "flac", "wav", "aiff", "ogg", "m4a"]);
const VIDEO_FORMATS = new Set(["mp4", "webm", "mov", "matroska"]);

const store = createFileStore({ limit: 100 });
const previewUrls = new Map();
const zipJobs = new Map();
const archiveViews = new Map();
const gzipReads = new Map();
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

function syncInspectorStatus() {
  const target = inspector.parentElement === inspectorSheet && !inspectorSheet.open
    ? previewSummary : inspectorSummary;
  if (status.parentElement !== target) target.append(status);
}

function syncInspectorLayout() {
  const useSheet = inspectorViewport.matches;
  const moveFocus = !useSheet && (inspectorSheet.open || document.activeElement === inspectButton);
  if (!useSheet && inspectorSheet.open) inspectorSheet.close();
  (useSheet ? inspectorSheet : inspectorHome).append(inspector);
  inspectButton.hidden = !useSheet;
  inspectorClose.hidden = !useSheet;
  previewCaption.hidden = useSheet;
  syncInspectorStatus();
  if (moveFocus && !filesPanel.hidden) heading.focus();
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
  gzipReads.get(target)?.abort();
  gzipReads.delete(target);
  archiveViews.get(target)?.close();
  archiveViews.delete(target);
  const job = zipJobs.get(target);
  if (job) job.controller.abort();
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
  inspectButton.disabled = previewButton.disabled;
  selectVisible.disabled = !ids.length;
  packZipButton.disabled = selectedCount === 0 || Boolean(zipController);
  compressionSelect.disabled = Boolean(zipController);

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

function downloadArchiveEntry(bytes, name) {
  const url = URL.createObjectURL(bytes);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function isCompressedTar(file, info) {
  return info.signature === "gzip" && /(?:\.tar\.gz|\.tgz)$/iu.test(file.name);
}

async function showArchiveContents(file, format, revision, target, prepared = null, password = "") {
  const zip = format === "zip";
  const wasm = Boolean(prepared);
  const label = wasm ? (format === "sevenz" ? "7z" : "RAR") : zip ? "ZIP" : "TAR";
  const result = prepared || (zip ? await readZipIndex(file)
    : await readTarIndex(file, () => isCurrentPreview(target, revision)));
  if (!isCurrentPreview(target, revision)) return;
  const tree = createZipTree(result.entries);
  const box = element("section", "files-zip");
  const title = element("h3", "", `${label} contents · ${tree.total} entries`);
  title.tabIndex = -1;
  let integrityNote = "TAR checks headers only; file data has no checksum.";
  if (zip) integrityNote = "Preview and extraction check CRC-32 locally.";
  if (format === "tar.gz") integrityNote = "Gzip CRC-32 and expanded size verified.";
  if (wasm) integrityNote = "7-Zip verifies decoded entries locally. Solid archives may require decoding preceding entries. Individual extraction up to 32 MiB.";
  const note = element("p", "files-note",
    `Preview entries up to ${formatBytes(MAX_ARCHIVE_PREVIEW_BYTES)}. ${integrityNote}`);
  const warning = tree.skipped
    ? element("p", "files-unsafe-label", `${tree.skipped} unsafe, ambiguous or unsupported entries hidden.`)
    : null;
  const breadcrumb = element("nav", "files-zip-breadcrumbs");
  breadcrumb.setAttribute("aria-label", label + " folder navigation");
  const tools = element("div", "files-zip-actions");
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", label + " archive actions");
  const verifyChecked = element("button", "button compact", "Verify checked");
  const extractChecked = element("button", "button compact", "Extract checked to folder");
  const downloadAllZip = element("button", "button compact", "Download all as ZIP");
  const cancel = element("button", "button compact", "Cancel extraction");
  const status = element("span", "files-zip-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  for (const button of [verifyChecked, extractChecked, downloadAllZip, cancel]) button.type = "button";
  verifyChecked.disabled = true;
  extractChecked.disabled = true;
  extractChecked.hidden = typeof globalThis.showDirectoryPicker !== "function";
  cancel.hidden = true;
  downloadAllZip.hidden = !wasm;
  if (wasm) extractChecked.textContent = "Extract all to folder";
  tools.append(verifyChecked, extractChecked, downloadAllZip, cancel, status);
  const listNode = element("ol", "files-zip-list");
  const entryDetails = element("dl", "files-zip-entry-details");
  entryDetails.hidden = true;
  const entryView = element("section", "files-zip-entry-preview");
  entryView.hidden = true;
  const entryHeader = element("div", "files-zip-entry-preview-header");
  const entryTitle = element("h3", "");
  entryTitle.dataset.i18nSkip = "";
  const backToArchive = element("button", "button compact", "Back to " + label);
  backToArchive.type = "button";
  entryHeader.append(backToArchive, entryTitle);
  const entryStatus = element("p", "files-note");
  entryStatus.setAttribute("role", "status");
  const entryBody = element("div", "files-zip-entry-preview-body");
  entryView.append(entryHeader, entryStatus, entryBody);
  box.append(title, note);
  if (warning) box.append(warning);
  box.append(breadcrumb);
  if (wasm) verifyChecked.hidden = true;
  if (zip || wasm) box.append(tools);
  box.append(listNode, entryDetails);
  target.append(box, entryView);

  function archiveDestinationPlan(outputs) {
    const plan = planZipEntries(result.entries.map((entry, i) => ({
      id: entry.index, path: entry.name, directory: entry.directory,
      file: new Blob(outputs && !entry.directory ? [outputs[i]] : []),
    })));
    if (plan.items.some((item, i) => item.path !== result.entries[i].name + (item.directory ? "/" : ""))) {
      throw new Error("Archive destinations are ambiguous.");
    }
    return plan;
  }
  let batchReason = wasm && (tree.skipped ? "Batch extraction requires a complete safe file tree."
    : wasmArchiveBatchReason(result.entries));
  if (wasm && !batchReason) {
    try { archiveDestinationPlan(); }
    catch (error) { batchReason = error?.message || "Unsupported archive destination paths."; }
  }
  if (wasm && batchReason) status.textContent = batchReason;
  const checked = new Set();
  let entryController = null;
  let entryTrigger = null;
  const selectedEntries = () => [...checked].map((id) => result.entries[id]);
  function refreshActions() {
    const running = zipJobs.has(target);
    verifyChecked.disabled = !checked.size || running;
    extractChecked.disabled = (wasm ? Boolean(batchReason) : !checked.size) || running;
    downloadAllZip.disabled = Boolean(batchReason) || running;
    for (const button of listNode.querySelectorAll(".files-zip-preview-button")) button.disabled = running;
  }
  function report(message) {
    if (!isCurrentPreview(target, revision)) return;
    status.textContent = globalThis.BenchI18n?.t(message) || message;
  }
  function beginJob(controller, showCancel = true) {
    zipJobs.set(target, { controller, committing: false });
    cancel.hidden = !showCancel;
    cancel.disabled = false;
    refreshActions();
  }
  function finishJob(controller) {
    if (zipJobs.get(target)?.controller !== controller) return;
    zipJobs.delete(target);
    cancel.hidden = true;
    archiveViews.get(target)?.refreshActions();
  }
  cancel.addEventListener("click", () => {
    const job = zipJobs.get(target);
    if (job && !job.committing) job.controller.abort();
  });

  function closeEntryPreview(restoreFocus = false) {
    if (!entryController) return;
    entryController.abort();
    entryController = null;
    releasePreview(entryBody);
    entryView.hidden = true;
    box.hidden = false;
    if (restoreFocus) (entryTrigger.disabled ? title : entryTrigger).focus();
    entryTrigger = null;
  }
  archiveViews.set(target, { close: closeEntryPreview, refreshActions });
  backToArchive.addEventListener("click", () => closeEntryPreview(true));

  async function previewArchiveEntry(entry, item, trigger) {
    if (!isCurrentPreview(target, revision) || zipJobs.has(target)) return;
    const controller = new AbortController();
    entryController = controller;
    entryTrigger = trigger;
    const isCurrent = () => !controller.signal.aborted && isCurrentPreview(target, revision);
    entryTitle.textContent = item.path;
    entryStatus.textContent = "Preparing preview…";
    box.hidden = true;
    entryView.hidden = false;
    backToArchive.focus();
    beginJob(controller, false);
    // Bound output allocated before the inflater callback. Stored entries skip inflation.
    const limits = entry.method === 8 ? { ...ZIP_PREVIEW_LIMITS, chunkBytes: 4 * 1024 } : ZIP_PREVIEW_LIMITS;
    try {
      const output = zip ? (await extractZipEntry(file, entry, {
        zipApi: globalThis.fflate,
        sink: createMemoryExtractSink({ maxBytes: MAX_ARCHIVE_PREVIEW_BYTES }),
        signal: controller.signal,
        directoryOffset: result.directoryOffset,
        limits,
      })).output : wasm ? await runWasmArchiveJob(file, "extract", { entry, password, signal: controller.signal })
        : file.slice(entry.start, entry.start + entry.originalSize);
      if (!isCurrent()) return;
      const extracted = new File([output], item.name);
      const info = await inspectLocalFile(extracted);
      if (!isCurrent()) return;
      if (resolveFileTool(info, extracted.size)?.mode === "pdf") {
        emptyPreview("Extract this file to open it in PDF tools.", entryBody);
      } else if (["zip", "tar", "sevenz", "rar"].includes(info.format) || isCompressedTar(extracted, info)) {
        emptyPreview("Extract this archive to browse it separately.", entryBody);
      } else {
        await renderFileContent(extracted, info, entryBody, isCurrent);
      }
      if (isCurrent()) entryStatus.textContent = zip ? "CRC-32 verified" : wasm ? "Entry decoded locally" : "TAR header checked";
    } catch (error) {
      if (isCurrent()) entryStatus.textContent = `Preview unavailable. ${error?.message || error}`;
    } finally {
      finishJob(controller);
    }
  }

  async function runEntries(items, mode) {
    if (!isCurrentPreview(target, revision) || zipJobs.has(target)) return;
    try {
      planZipExtraction(items);
    } catch (error) {
      report(error.message || "Unsupported ZIP selection.");
      return;
    }
    const controller = new AbortController();
    beginJob(controller);
    let finished = 0;
    try {
      let root = null;
      if (mode === "folder") {
        const destination = await globalThis.showDirectoryPicker({ mode: "readwrite" });
        if (controller.signal.aborted) return;
        const unique = globalThis.crypto?.randomUUID?.() || String(Date.now());
        root = await destination.getDirectoryHandle("DocBench-extract-" + unique.slice(0, 12), { create: true });
      }
      for (const entry of items) {
        if (controller.signal.aborted) throw new DOMException("Canceled.", "AbortError");
        let sink;
        if (mode === "verify") sink = createVerifySink();
        else if (mode === "folder") {
          const parts = entry.name.replaceAll("\\", "/").split("/");
          let folder = root;
          for (const part of parts.slice(0, -1)) {
            folder = await folder.getDirectoryHandle(part, { create: true });
          }
          const handle = await folder.getFileHandle(parts.at(-1), { create: true });
          const writable = await handle.createWritable();
          sink = {
            write: (bytes) => writable.write(bytes),
            close: () => writable.close(),
            abort: () => writable.abort(),
          };
        } else if (globalThis.isSecureContext
          && typeof globalThis.showSaveFilePicker === "function") {
          const handle = await globalThis.showSaveFilePicker({
            suggestedName: entry.name.replaceAll("\\", "/").split("/").at(-1),
          });
          const writable = await handle.createWritable();
          sink = {
            write: (bytes) => writable.write(bytes),
            close: () => writable.close(),
            abort: () => writable.abort(),
          };
        } else if (entry.originalSize <= ZIP_EXTRACT_LIMITS.memoryBytes) {
          sink = createMemoryExtractSink();
        } else {
          throw new Error("This browser requires native saving for large ZIP entries.");
        }
        const job = zipJobs.get(target);
        if (job) job.committing = false;
        const outcome = await extractZipEntry(file, entry, {
          zipApi: globalThis.fflate, sink, signal: controller.signal,
          directoryOffset: result.directoryOffset,
          onProgress: ({ phase, outputBytes, outputTotal }) => {
            const active = zipJobs.get(target);
            if (phase === "committing" && active) {
              active.committing = true;
              cancel.disabled = true;
              report("Finalizing extracted file…");
            } else if (phase !== "committing") {
              report(`Checking ZIP data · ${finished + 1}/${items.length} · ${formatBytes(outputBytes)} / ${formatBytes(outputTotal)}`);
            }
          },
        });
        if (mode === "download" && outcome.output) {
          downloadArchiveEntry(outcome.output, entry.name.replaceAll("\\", "/").split("/").at(-1));
        }
        finished += 1;
        if (job) job.committing = false;
        cancel.disabled = false;
      }
      report(`Verified ${finished} ZIP ${finished === 1 ? "entry" : "entries"} by CRC-32.`);
    } catch (error) {
      report(error?.name === "AbortError"
        ? `ZIP operation canceled · ${finished} completed.`
        : `ZIP operation failed · ${finished} completed · ${error?.message || error}`);
    } finally {
      finishJob(controller);
    }
  }

  async function downloadWasmEntry(entry, item) {
    if (!isCurrentPreview(target, revision) || zipJobs.has(target)) return;
    const controller = new AbortController();
    beginJob(controller);
    report("Decoding archive entry…");
    try {
      const output = await runWasmArchiveJob(file, "extract", { entry, password, signal: controller.signal });
      if (!controller.signal.aborted && isCurrentPreview(target, revision)) {
        downloadArchiveEntry(new Blob([output]), item.name);
        report("Entry decoded locally.");
      }
    } catch (error) {
      report(error?.name === "AbortError" ? "Archive operation canceled." : error?.message || "Extraction failed.");
    } finally {
      finishJob(controller);
    }
  }

  verifyChecked.addEventListener("click", () => void runEntries(selectedEntries(), "verify"));
  async function extractWasmBatch(toFolder) {
    if (!isCurrentPreview(target, revision) || zipJobs.has(target) || batchReason) return;
    const controller = new AbortController();
    beginJob(controller);
    let finished = 0;
    try {
      const destination = toFolder ? await globalThis.showDirectoryPicker({ mode: "readwrite" }) : null;
      controller.signal.throwIfAborted();
      report("Decoding archive contents…");
      const outputs = await runWasmArchiveJob(file, "extractAll", { entries: result.entries, password, signal: controller.signal });
      controller.signal.throwIfAborted();
      // Reuse the same destination plan; keep explicit empty directories.
      const plan = archiveDestinationPlan(outputs);
      if (destination) {
        const unique = globalThis.crypto?.randomUUID?.() || String(Date.now());
        const root = await destination.getDirectoryHandle("DocBench-extract-" + unique.slice(0, 12), { create: true });
        for (const item of plan.items) {
          controller.signal.throwIfAborted();
          const parts = item.path.replace(/\/$/u, "").split("/");
          let folder = root;
          for (const part of parts.slice(0, item.directory ? parts.length : -1)) folder = await folder.getDirectoryHandle(part, { create: true });
          if (item.directory) { finished += 1; continue; }
          const handle = await folder.getFileHandle(parts.at(-1), { create: true });
          const writable = await handle.createWritable();
          try {
            await writable.write(item.file);
            controller.signal.throwIfAborted();
            await writable.close();
            finished += 1;
            report(`Extracted ${finished}/${plan.items.length} entries.`);
          } catch (error) {
            await writable.abort().catch(() => {});
            throw error;
          }
        }
      } else {
        report("Packaging decoded files as ZIP…");
        const packed = await packZip(plan.items, { zipApi: globalThis.fflate, sink: createMemoryZipSink(),
          signal: controller.signal, profile: "store" });
        controller.signal.throwIfAborted();
        if (isCurrentPreview(target, revision)) downloadArchiveEntry(packed.output, file.name.replace(/\\.(?:7z|rar)$/iu, "") + ".zip");
        finished = plan.items.length;
      }
      report(`Decoded ${finished} entries locally.`);
    } catch (error) {
      report(`Archive operation ${controller.signal.aborted || error?.name === "AbortError" ? "canceled" : "failed"} · ${finished} completed.`);
    } finally {
      finishJob(controller);
    }
  }

  extractChecked.addEventListener("click", () => wasm ? void extractWasmBatch(true) : void runEntries(selectedEntries(), "folder"));
  downloadAllZip.addEventListener("click", () => void extractWasmBatch(false));

  function navigate(path, moveFocus = false) {
    if (!isCurrentPreview(target, revision)) return;
    const view = tree.list(path);
    if (!view) return;
    closeEntryPreview();
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
      if (index) link.dataset.i18nSkip = "";
      link.disabled = step.path === path;
      link.addEventListener("click", () => navigate(step.path, true));
      breadcrumb.append(link);
    }
    listNode.replaceChildren();
    if (view.parentPath !== null) {
      const row = element("li", "files-zip-folder");
      const up = element("button", "files-zip-entry-button", "↰ Go up");
      up.type = "button";
      up.addEventListener("click", () => navigate(view.parentPath, true));
      row.append(up);
      listNode.append(row);
    }
    for (const folder of view.folders) {
      const row = element("li", "files-zip-folder");
      const button = element("button", "files-zip-entry-button");
      button.type = "button";
      const folderLabel = element("span", "files-zip-name", folder.name + "/");
      folderLabel.dataset.i18nSkip = "";
      button.append(element("span", "files-zip-icon", "▣ "), folderLabel);
      button.setAttribute("aria-label", `Open ${label} folder ${folder.name}`);
      button.addEventListener("click", () => navigate(folder.path, true));
      row.append(button);
      listNode.append(row);
    }
    for (const item of view.files) {
      const entry = result.entries[item.sourceIndex];
      const reason = zip ? zipEntryEligibility(entry) : wasm ? wasmArchiveEntryReason(entry) : null;
      const row = element("li", "files-zip-file");
      const name = element("button", "files-zip-entry-button", item.name);
      name.type = "button";
      name.dataset.i18nSkip = "";
      name.addEventListener("click", () => {
        if (!isCurrentPreview(target, revision)) return;
        entryDetails.replaceChildren();
        const properties = zip ? [
          ["Path", item.path],
          ["Original size", item.zip64 ? "ZIP64 size unsupported" : formatBytes(item.originalSize)],
          ["Compressed size", item.zip64 ? "ZIP64 size unsupported" : formatBytes(item.compressedSize)],
          ["Method", String(item.method)],
          ["Encrypted", item.encrypted ? "Yes" : "No"],
          ["ZIP64", item.zip64 ? "Unsupported" : "No"],
          ["Extraction", reason || "Supported · CRC-32 checked"],
        ] : [["Path", item.path], ["Size", formatBytes(item.originalSize)]];
        for (const [keyName, value] of properties) {
          const field = element("div", "files-zip-property");
          const key = element("dt", "", keyName);
          const data = element("dd", "", value);
          if (keyName === "Path") data.dataset.i18nSkip = "";
          field.append(key, data);
          entryDetails.append(field);
        }
        entryDetails.hidden = false;
      });
      const size = element("small", "", reason || (zip
        ? `${formatBytes(item.originalSize)} · method ${item.method}` : formatBytes(item.originalSize)));
      row.append(name, size);
      if (!reason) {
        const actions = element("div", "files-zip-row-actions");
        if (zip) {
          const checkbox = element("input", "files-zip-checkbox");
          checkbox.type = "checkbox";
          checkbox.checked = checked.has(item.sourceIndex);
          checkbox.setAttribute("aria-label", "Select ZIP entry " + item.name);
          checkbox.addEventListener("change", () => {
            if (checkbox.checked) checked.add(item.sourceIndex);
            else checked.delete(item.sourceIndex);
            refreshActions();
          });
          actions.append(checkbox);
        }
        const download = element("button", "button compact", "Extract file");
        download.type = "button";
        if (zip ? !zipEntryEligibility(entry, ZIP_PREVIEW_LIMITS) : item.originalSize <= MAX_ARCHIVE_PREVIEW_BYTES) {
          const openEntry = element("button", "button compact files-zip-preview-button", "Preview entry");
          openEntry.type = "button";
          openEntry.disabled = zipJobs.has(target);
          openEntry.setAttribute("aria-label", "Preview entry: " + item.name);
          openEntry.addEventListener("click", () => void previewArchiveEntry(entry, item, openEntry));
          actions.append(openEntry);
        }
        if (zip) {
          const verify = element("button", "button compact", "Verify CRC");
          verify.type = "button";
          verify.addEventListener("click", () => void runEntries([entry], "verify"));
          download.addEventListener("click", () => void runEntries([entry], "download"));
          actions.append(verify);
        } else if (wasm) {
          download.addEventListener("click", () => void downloadWasmEntry(entry, item));
        } else {
          download.addEventListener("click", () => {
            if (isCurrentPreview(target, revision)) {
              downloadArchiveEntry(file.slice(entry.start, entry.start + entry.originalSize), item.name);
            }
          });
        }
        actions.append(download);
        row.append(actions);
      }
      listNode.append(row);
    }
    if (!view.folders.length && !view.files.length) {
      listNode.append(element("li", "files-zip-empty", "No entries in this folder."));
    }
    if (moveFocus) {
      (listNode.querySelector(".files-zip-entry-button")
        || breadcrumb.querySelector(".files-zip-breadcrumb:not(:disabled)"))?.focus();
    }
  }
  navigate("");
  refreshActions();
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
  if (inspectorSheet.open) {
    inspectorSheet.close();
    audioDock.scrollIntoView({ block: "nearest" });
    audioDockPlayer.focus({ preventScroll: true });
  }
  if (started && typeof started.catch === "function") {
    void started.catch(() => {
      if (audioDockId === entry.id) audioDockStatus.textContent = "Press Play to start audio.";
    });
  }
}

function mediaPreview(file, format, target, isCurrent) {
  // Passive MIME + concrete media element. Never embed SVG or active documents.
  const blob = file.slice(0, file.size, MEDIA_MIME[format]);
  const url = URL.createObjectURL(blob);
  previewUrls.set(target, url);
  const fallback = element("p", "files-note", "Native browser preview. Codec availability varies.");
  const onError = () => {
    if (isCurrent()) {
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

async function renderWasmArchive(file, info, revision, target, password = "") {
  releasePreview(target);
  const form = element("form", "files-zip-actions");
  const field = element("input", "");
  field.type = "password";
  field.autocomplete = "off";
  field.placeholder = "Archive password (optional)";
  field.setAttribute("aria-label", field.placeholder);
  field.maxLength = 1024;
  const unlock = element("button", "button compact", "Unlock / reopen");
  unlock.type = "submit";
  form.append(field, unlock);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const supplied = field.value;
    field.value = "";
    void renderWasmArchive(file, info, revision, target, supplied);
  });
  const pending = element("p", "files-note", "Opening archive locally…");
  pending.setAttribute("role", "status");
  target.append(form, pending);
  const controller = new AbortController();
  gzipReads.set(target, controller);
  try {
    const result = await runWasmArchiveJob(file, "list", { password, signal: controller.signal });
    if (controller.signal.aborted || !isCurrentPreview(target, revision)) return;
    pending.remove();
    await showArchiveContents(file, info.format, revision, target, result, password);
  } catch (error) {
    if (!controller.signal.aborted && isCurrentPreview(target, revision)) {
      pending.textContent = error?.message || "Archive index unavailable.";
    }
  } finally {
    if (gzipReads.get(target) === controller) gzipReads.delete(target);
  }
}

async function renderPreview(file, info, revision, target = preview) {
  releasePreview(target);
  const isCurrent = () => isCurrentPreview(target, revision);
  if (info.signature === "sevenz" || info.signature === "rar") {
    await renderWasmArchive(file, info, revision, target);
    return;
  }
  const compressedTar = isCompressedTar(file, info);
  if (info.format === "zip" || info.format === "tar" || compressedTar) {
    let controller;
    let pending;
    try {
      if (compressedTar) {
        controller = new AbortController();
        gzipReads.set(target, controller);
        pending = element("p", "files-note", "Opening gzip-compressed TAR…");
        pending.setAttribute("role", "status");
        target.append(pending);
        const tar = await decompressGzipTar(file, controller.signal);
        if (!isCurrent()) return;
        pending.remove();
        await showArchiveContents(tar, "tar.gz", revision, target);
      } else {
        await showArchiveContents(file, info.format, revision, target);
      }
    } catch (error) {
      pending?.remove();
      if (isCurrent()) emptyPreview(error.message || "Archive index unavailable.", target);
    } finally {
      if (controller && gzipReads.get(target) === controller) gzipReads.delete(target);
    }
    return;
  }
  await renderFileContent(file, info, target, isCurrent);
}

async function renderFileContent(file, info, target, isCurrent) {
  if (IMAGE_FORMATS.has(info.format)) {
    if (file.size > MAX_IMAGE_BYTES) {
      emptyPreview(`Image preview disabled above ${formatBytes(MAX_IMAGE_BYTES)} to protect browser memory.`, target);
    } else {
      mediaPreview(file, info.format, target, isCurrent);
    }
    return;
  }
  if (AUDIO_FORMATS.has(info.format)) {
    mediaPreview(file, info.format, target, isCurrent);
    return;
  }
  if (VIDEO_FORMATS.has(info.format)) {
    mediaPreview(file, info.format, target, isCurrent);
    return;
  }
  if (isTextFile(info)) {
    const source = await file.slice(0, MAX_TEXT_BYTES).text();
    if (!isCurrent()) return;
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
  if (!isCurrent()) return;
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
    if (inspectorSheet.open) inspectorSheet.close();
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
    if (inspectorSheet.open) inspectorSheet.close();
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
  if (!globalThis.fflate?.ZipDeflate || !globalThis.fflate?.ZipPassThrough) {
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
      profile: compressionSelect.value,
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
if (typeof inspectorSheet.showModal === "function") {
  inspectButton.addEventListener("click", () => {
    if (filesPanel.hidden || inspectButton.hidden || inspectButton.disabled || inspectorSheet.open) return;
    inspectButton.focus({ preventScroll: true });
    inspectorSheet.showModal();
    inspectorSheet.scrollTop = 0;
    syncInspectorStatus();
  });
  inspectorClose.addEventListener("click", () => inspectorSheet.close());
  inspectorSheet.addEventListener("close", syncInspectorStatus);
  inspectorSheet.addEventListener("click", (event) => {
    if (event.target === inspectorSheet && event.clientY < inspectorSheet.getBoundingClientRect().top) {
      inspectorSheet.close();
    }
  });
  if (inspectorViewport.addEventListener) inspectorViewport.addEventListener("change", syncInspectorLayout);
  else inspectorViewport.addListener(syncInspectorLayout);
  syncInspectorLayout();
}
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
new MutationObserver(() => {
  if (filesPanel.hidden && inspectorSheet.open) inspectorSheet.close();
  if (filesPanel.hidden && audioDockId) closeAudioDock();
  if (filesPanel.hidden && !zipFinalizing) zipController?.abort();
  if (filesPanel.hidden) {
    archiveViews.get(preview)?.close();
    archiveViews.get(dialogBody)?.close();
  }
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
