import { parseTree } from "./vendor/jsonc-parser/impl/parser.js";
import { isMergeTextFilename, mergeTextDocuments } from "./document-merge.mjs";

const $ = (selector) => document.querySelector(selector);

const editor = $("#editor");
const preview = $("#preview");
const previewTitle = $("#preview-title");
const formatSelect = $("#format-select");
const eolSelect = $("#eol-select");
const filenameLabel = $("#filename-label");
const encodingLabel = $("#encoding-label");
const detailStatus = $("#detail-status");
const statusBadge = $("#status-badge");
const fileInput = $("#file-input");
const mergeFilesInput = $("#merge-files-input");
const mergeFilesFeedback = $("#merge-files-feedback");
const openButton = $("#open-button");
const mergeFilesButton = $("#merge-files-button");
const newButton = $("#new-button");
const saveButton = $("#save-button");
const downloadButton = $("#download-button");
const printButton = $("#print-button");
const formatButton = $("#format-button");
const minifyButton = $("#minify-button");
const repairButton = $("#repair-button");
const validateButton = $("#validate-button");
const dropZone = $("#drop-zone");
const documentWorkspace = $("#document-workspace");

const MAX_TREE_NODES = 5000;
const MAX_MERGE_FILES = 100;
const MAX_MERGE_BYTES = 64 * 1024 * 1024;
const SOURCE_SCALAR = Symbol("source-scalar");
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const extensionToFormat = {
  txt: "txt",
  md: "md",
  markdown: "md",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  jsonl: "jsonl",
  ndjson: "jsonl",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
};
const preferredExtension = {
  txt: "txt",
  md: "md",
  json: "json",
  jsonc: "jsonc",
  json5: "json5",
  jsonl: "jsonl",
  yaml: "yaml",
  xml: "xml",
};
const mimeByFormat = {
  txt: "text/plain;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  json: "application/json;charset=utf-8",
  jsonc: "application/json;charset=utf-8",
  json5: "application/json5;charset=utf-8",
  jsonl: "application/x-ndjson;charset=utf-8",
  yaml: "application/yaml;charset=utf-8",
  xml: "application/xml;charset=utf-8",
};
const pickerTypes = [
  {
    description: "Text documents",
    accept: {
      "text/plain": [".txt"],
      "text/markdown": [".md", ".markdown"],
      "application/json": [".json", ".jsonc"],
      "application/json5": [".json5"],
      "application/x-ndjson": [".jsonl", ".ndjson"],
      "application/yaml": [".yml", ".yaml"],
      "application/xml": [".xml"],
    },
  },
];

const state = {
  handle: null,
  filename: filenameLabel.textContent || "untitled.txt",
  bom: false,
  mixedEol: false,
  eol: eolSelect.value,
  documentRevision: 0,
};

let pendingMergeFiles = [];
let pendingMergeRevision = null;

const nativeOpenSupported = globalThis.isSecureContext
  && typeof globalThis.showOpenFilePicker === "function";
const nativeSaveSupported = globalThis.isSecureContext
  && typeof globalThis.showSaveFilePicker === "function";

function detectEol(raw) {
  const crlf = (raw.match(/\r\n/g) || []).length;
  const totalLf = (raw.match(/\n/g) || []).length;
  const lf = totalLf - crlf;
  const cr = (raw.match(/\r(?!\n)/g) || []).length;
  const present = [["CRLF", crlf], ["LF", lf], ["CR", cr]]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!present.length) return { target: "LF", mixed: false };
  return { target: present[0][0], mixed: present.length > 1 };
}

function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function sanitizeXmlForPreview(text) {
  return text
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");
}

function applyEol(text, kind) {
  const normalized = normalizeEol(text);
  if (kind === "CRLF") return normalized.replace(/\n/g, "\r\n");
  if (kind === "CR") return normalized.replace(/\n/g, "\r");
  return normalized;
}

function setMergeFeedback(kind, text, title = text) {
  mergeFilesFeedback.hidden = !text;
  mergeFilesFeedback.dataset.kind = kind || "";
  mergeFilesFeedback.textContent = text || "";
  mergeFilesFeedback.title = text ? title : "";
}

function resetMergeQueue({ clearFeedback = false } = {}) {
  pendingMergeFiles = [];
  pendingMergeRevision = null;
  if (clearFeedback) setMergeFeedback("", "");
}

function ensureFreshMergeQueue() {
  if (pendingMergeRevision !== null && pendingMergeRevision !== state.documentRevision) {
    resetMergeQueue({ clearFeedback: true });
  }
}

async function queueAndMergeFiles(files) {
  ensureFreshMergeQueue();
  const selected = [...files];
  if (!selected.length) return false;
  if (pendingMergeRevision === null) pendingMergeRevision = state.documentRevision;

  const unsupported = selected.find((file) => !isMergeTextFilename(file.name));
  if (unsupported) {
    resetMergeQueue();
    throw new Error(`${unsupported.name}: only .txt, .md and .markdown files can be merged.`);
  }

  pendingMergeFiles.push(...selected);
  if (pendingMergeFiles.length > MAX_MERGE_FILES) {
    resetMergeQueue();
    throw new Error(`Merge is limited to ${MAX_MERGE_FILES} files at once.`);
  }

  if (pendingMergeFiles.length < 2) {
    const [file] = pendingMergeFiles;
    setMergeFeedback(
      "neutral",
      "1 file queued · pick one more",
      `${file.name} is queued. Pick at least one more TXT or Markdown file.`,
    );
    return false;
  }

  const queued = [...pendingMergeFiles];
  setMergeFeedback(
    "neutral",
    `${queued.length} files selected · merging…`,
    queued.map((file) => file.name).join("\n"),
  );
  mergeFilesButton.disabled = true;
  mergeFilesInput.disabled = true;

  try {
    await mergeSelectedFiles(queued);
    setMergeFeedback(
      "good",
      `Merged ${queued.length} files`,
      queued.map((file) => file.name).join("\n"),
    );
    return true;
  } finally {
    mergeFilesButton.disabled = false;
    mergeFilesInput.disabled = false;
    resetMergeQueue();
  }
}

function formatFromFilename(name) {
  const extension = name.includes(".") ? name.split(".").pop().toLowerCase() : "txt";
  return extensionToFormat[extension] || "txt";
}

async function mergeSelectedFiles(files) {
  const selected = [...files];
  if (selected.length < 2) {
    throw new Error("Choose at least two TXT or Markdown files to merge.");
  }
  if (selected.length > MAX_MERGE_FILES) {
    throw new Error(`Merge is limited to ${MAX_MERGE_FILES} files at once.`);
  }

  const unsupported = selected.find((file) => !isMergeTextFilename(file.name));
  if (unsupported) {
    throw new Error(`${unsupported.name}: only .txt, .md and .markdown files can be merged.`);
  }

  const totalBytes = selected.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalBytes > MAX_MERGE_BYTES) {
    throw new Error("Merge is limited to 64 MiB of source files at once.");
  }

  const revision = state.documentRevision;
  const documents = [];
  for (const file of selected) {
    let parsed;
    try {
      parsed = await readTextFile(file);
    } catch (error) {
      throw new Error(`${file.name}: ${error?.message || String(error)}`);
    }
    if (state.documentRevision !== revision) throw staleSaveError();
    documents.push({
      name: file.name,
      text: normalizeEol(parsed.raw),
      bom: parsed.bom,
      eol: parsed.eol,
    });
  }

  const merged = mergeTextDocuments(documents);
  if (state.documentRevision !== revision) throw staleSaveError();

  const first = documents[0];
  state.documentRevision += 1;
  state.handle = null;
  state.filename = merged.filename;
  state.bom = first.bom;
  state.mixedEol = documents.some((document) => {
    return document.eol.mixed || document.eol.target !== first.eol.target;
  });
  state.eol = first.eol.target;

  editor.value = merged.text;
  eolSelect.value = state.eol;
  formatSelect.value = merged.format;
  filenameLabel.textContent = state.filename;
  updateFormatButton();
  updateSaveButton();
  updateMeta();
  document.dispatchEvent(new Event("docbench:document-change"));
  renderEnhancedPreview();
  setStatus("good", `Merged ${documents.length} files`);
  editor.focus();
}

async function readTextFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bom = bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf;
  const contentBytes = bom ? bytes.slice(3) : bytes;
  if (contentBytes.includes(0)) {
    throw new Error("Binary or UTF-16 input is not supported yet.");
  }
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(contentBytes);
  return { raw, bom, eol: detectEol(raw) };
}

function updateMeta() {
  const lines = editor.value.split("\n").length;
  const mixed = state.mixedEol ? `Mixed → ${eolSelect.value}` : eolSelect.value;
  const bom = state.bom ? "UTF-8 BOM" : "UTF-8";
  const linked = state.handle ? " · linked file" : "";
  encodingLabel.textContent = `${bom} · ${mixed}`;
  detailStatus.textContent = `${bom} · ${mixed} · ${lines} line${lines === 1 ? "" : "s"}${linked}`;
}

function updateSaveButton() {
  saveButton.textContent = state.handle || !nativeSaveSupported ? "Save" : "Save as…";
  saveButton.title = state.handle
    ? `Save directly to ${state.filename}`
    : nativeSaveSupported
      ? "Choose a file once, then later saves update it directly"
      : "Download the edited file";
}

function setPreviewMode(mode, title) {
  preview.className = `preview-${mode}`;
  previewTitle.textContent = title;
}

function setStatus(kind, text) {
  statusBadge.className = `status ${kind}`;
  statusBadge.textContent = text;
  statusBadge.removeAttribute("title");
}

function positionFromOffset(text, offset) {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

function parseXmlError(error) {
  if (!error) return null;
  const rawMessage = error.textContent.trim().replace(/\s+/g, " ");
  const lineMatch = rawMessage.match(/line(?: number)?\s*[: ]\s*(\d+).*?column(?: number)?\s*[: ]\s*(\d+)/i);
  const message = rawMessage
    .replace(/^This page contains the following errors:\s*/i, "")
    .replace(/^error on line \d+ at column \d+:\s*/i, "")
    .replace(/\s*Below is a rendering of the page up to the first error.*$/i, "")
    .trim() || "Malformed XML.";
  return {
    message,
    position: lineMatch ? { line: Number(lineMatch[1]), column: Number(lineMatch[2]) } : null,
  };
}

function renderParseError(error) {
  setPreviewMode("error", "Parse error");
  const position = error?.position || null;
  const at = position ? ` · ${position.line}:${position.column}` : "";
  setStatus("bad", `Invalid${at}`);
  const message = document.createElement("p");
  message.className = "preview-error-message";
  message.textContent = error?.message || "The document could not be parsed.";
  if (!position?.line) {
    preview.replaceChildren(message);
    return;
  }

  const lines = editor.value.split("\n");
  const target = Math.min(lines.length, Math.max(1, position.line));
  const first = Math.max(1, target - 2);
  const last = Math.min(lines.length, target + 2);
  const source = document.createElement("div");
  source.className = "preview-error-source";
  for (let line = first; line <= last; line += 1) {
    const row = document.createElement("div");
    row.className = line === target ? "preview-error-line active" : "preview-error-line";
    const number = document.createElement("span");
    number.className = "preview-error-line-number";
    number.textContent = String(line);
    const code = document.createElement("span");
    code.className = "preview-error-code";
    code.textContent = lines[line - 1] || " ";
    row.append(number, code);
    source.append(row);
  }
  preview.replaceChildren(message, source);
}

function updateFormatButton() {
  const format = formatSelect.value;
  const enabled = ["json", "jsonc", "json5", "jsonl", "yaml", "xml"].includes(format);
  const jsonFamily = ["json", "jsonc", "json5", "jsonl"].includes(format);
  formatButton.disabled = !enabled;
  formatButton.title = enabled
    ? "Normalize indentation and layout"
    : "Auto-format is available for structured text formats";
  minifyButton.disabled = !jsonFamily;
  minifyButton.title = jsonFamily
    ? "Remove non-essential whitespace from the current JSON-family document"
    : "Minify is available for JSON-family formats";
  repairButton.disabled = !jsonFamily;
  repairButton.title = jsonFamily
    ? "Repair malformed input and convert it to strict JSON"
    : "Repair is available for JSON-family formats";
}

function scalarText(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "undefined") return "undefined";
  return String(value);
}

function scalarClass(value) {
  if (value === null) return "null";
  if (["string", "number", "boolean", "undefined"].includes(typeof value)) {
    return typeof value;
  }
  return "other";
}

function appendScalar(parent, key, value) {
  const row = document.createElement("div");
  row.className = "tree-leaf";
  if (key !== null) {
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = `${key}: `;
    row.append(keyNode);
  }
  const valueNode = document.createElement("span");
  valueNode.className = `tree-value tree-${scalarClass(value)}`;
  valueNode.textContent = scalarText(value);
  row.append(valueNode);
  parent.append(row);
}

function sourceScalar(text, type) {
  return { [SOURCE_SCALAR]: true, text, type };
}

function isSourceScalar(value) {
  return Boolean(value?.[SOURCE_SCALAR]);
}

function appendSourceScalar(parent, key, value) {
  const row = document.createElement("div");
  row.className = "tree-leaf";
  if (key !== null) {
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = `${key}: `;
    row.append(keyNode);
  }
  const valueNode = document.createElement("span");
  valueNode.className = `tree-value tree-${value.type}`;
  valueNode.textContent = value.text;
  row.append(valueNode);
  parent.append(row);
}

function appendTreeLimit(fragment) {
  const note = document.createElement("p");
  note.className = "preview-limit-note";
  note.textContent = `Tree preview stopped after ${MAX_TREE_NODES.toLocaleString()} nodes.`;
  fragment.append(note);
}

function normalizeYamlTag(tag) {
  const value = String(tag || "");
  return value.startsWith("!!") ? `tag:yaml.org,2002:${value.slice(2)}` : value;
}

function yamlScalarClass(tag) {
  const normalized = normalizeYamlTag(tag);
  if (normalized.endsWith(":int") || normalized.endsWith(":float")) return "number";
  if (normalized.endsWith(":bool")) return "boolean";
  if (normalized.endsWith(":null")) return "null";
  return "string";
}

function yamlScalarText(node) {
  const type = yamlScalarClass(node.tag || "");
  const timestamp = normalizeYamlTag(node.tag).endsWith(":timestamp");
  const value = type === "string" && !timestamp ? JSON.stringify(node.value) : node.value;
  return node.anchor ? `&${node.anchor} ${value}` : value;
}

function yamlKeyLabel(node) {
  if (!node) return "?";
  if (node.kind === "scalar") return node.value;
  if (node.kind === "alias") return `*${node.anchor}`;
  return `[${node.kind} key]`;
}

function renderYamlTree(source) {
  const yaml = globalThis.jsyaml;
  if (!yaml?.parseEvents || !yaml?.eventsToAst || !yaml?.CORE_SCHEMA) return null;
  const schema = yaml.CORE_SCHEMA.withTags(yaml.mergeTag, yaml.timestampTag);
  const documents = yaml.eventsToAst(yaml.parseEvents(source), { source, schema });
  const fragment = document.createDocumentFragment();
  let nodes = 0;
  let truncated = false;

  function renderNode(parent, key, node, depth) {
    if (!node || nodes >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }
    nodes += 1;

    if (node.kind === "scalar") {
      appendSourceScalar(parent, key, sourceScalar(yamlScalarText(node), yamlScalarClass(node.tag || "")));
      return;
    }
    if (node.kind === "alias") {
      appendSourceScalar(parent, key, sourceScalar(`*${node.anchor}`, "other"));
      return;
    }

    const details = document.createElement("details");
    details.className = "tree-node";
    details.open = depth < 2;
    const summary = document.createElement("summary");
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = key === null ? "YAML" : String(key);
    const metaNode = document.createElement("span");
    metaNode.className = "tree-meta";
    const count = node.items.length;
    const kind = node.kind === "sequence" ? "Sequence" : "Mapping";
    metaNode.textContent = `${kind}(${count})${node.anchor ? ` · &${node.anchor}` : ""}`;
    summary.append(keyNode, metaNode);
    details.append(summary);

    const children = document.createElement("div");
    children.className = "tree-children";
    if (node.kind === "sequence") {
      node.items.forEach((child, index) => {
        if (!truncated) renderNode(children, index, child, depth + 1);
      });
    } else {
      for (const [index, pair] of node.items.entries()) {
        if (["scalar", "alias"].includes(pair.key?.kind)) {
          renderNode(children, yamlKeyLabel(pair.key), pair.value, depth + 1);
        } else {
          renderNode(children, `Key ${index + 1}`, pair.key, depth + 1);
          if (!truncated) renderNode(children, `Value ${index + 1}`, pair.value, depth + 1);
        }
        if (truncated) break;
      }
    }
    details.append(children);
    parent.append(details);
  }

  function appendEmptyDocument(parent, key) {
    if (nodes >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }
    nodes += 1;
    appendScalar(parent, key, "(empty document)");
  }

  if (documents.length === 1) {
    if (documents[0].contents) renderNode(fragment, null, documents[0].contents, 0);
    else appendEmptyDocument(fragment, null);
  } else {
    documents.forEach((document, index) => {
      if (truncated) return;
      const label = `Document ${index + 1}`;
      if (document.contents) renderNode(fragment, label, document.contents, 0);
      else appendEmptyDocument(fragment, label);
    });
  }
  if (truncated) appendTreeLimit(fragment);
  return fragment;
}

function jsonScalarClass(node) {
  if (node.type === "string") return "string";
  if (node.type === "number") return "number";
  if (node.type === "boolean") return "boolean";
  if (node.type === "null") return "null";
  return "other";
}

function appendJsonScalar(parent, key, node, source) {
  const row = document.createElement("div");
  row.className = "tree-leaf";
  if (key !== null) {
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = `${key}: `;
    row.append(keyNode);
  }
  const valueNode = document.createElement("span");
  valueNode.className = `tree-value tree-${jsonScalarClass(node)}`;
  valueNode.textContent = source.slice(node.offset, node.offset + node.length);
  row.append(valueNode);
  parent.append(row);
}

function renderJsonTree(source, {
  allowTrailingComma = false,
  disallowComments = true,
  label = "JSON",
} = {}) {
  const errors = [];
  const root = parseTree(source, errors, { allowTrailingComma, disallowComments });
  if (!root || errors.length) return null;

  const fragment = document.createDocumentFragment();
  let nodes = 0;
  let truncated = false;

  function renderNode(parent, key, node, depth) {
    if (!node || nodes >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }
    nodes += 1;

    if (!["object", "array"].includes(node.type)) {
      appendJsonScalar(parent, key, node, source);
      return;
    }

    const details = document.createElement("details");
    details.className = "tree-node";
    details.open = depth < 2;
    const summary = document.createElement("summary");
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = key === null ? label : String(key);
    const metaNode = document.createElement("span");
    metaNode.className = "tree-meta";
    const count = node.children?.length || 0;
    metaNode.textContent = node.type === "array"
      ? `Array(${count})`
      : `Object(${count})`;
    summary.append(keyNode, metaNode);
    details.append(summary);

    const children = document.createElement("div");
    children.className = "tree-children";
    if (node.type === "array") {
      (node.children || []).forEach((child, index) => {
        if (!truncated) renderNode(children, index, child, depth + 1);
      });
    } else {
      for (const property of node.children || []) {
        const [propertyName, propertyValue] = property.children || [];
        const propertyKey = propertyName?.value ?? "?";
        renderNode(children, propertyKey, propertyValue, depth + 1);
        if (truncated) break;
      }
    }
    details.append(children);
    parent.append(details);
  }

  renderNode(fragment, null, root, 0);
  if (truncated) appendTreeLimit(fragment);
  return fragment;
}

function renderValueTree(value, label = "JSON5") {
  const fragment = document.createDocumentFragment();
  let nodes = 0;
  let truncated = false;

  function renderNode(parent, key, item, depth) {
    if (nodes >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }
    nodes += 1;
    if (item === null || typeof item !== "object") {
      appendScalar(parent, key, item);
      return;
    }

    const entries = Array.isArray(item)
      ? item.map((child, index) => [index, child])
      : Object.entries(item);
    const details = document.createElement("details");
    details.className = "tree-node";
    details.open = depth < 2;
    const summary = document.createElement("summary");
    const keyNode = document.createElement("span");
    keyNode.className = "tree-key";
    keyNode.textContent = key === null ? label : String(key);
    const metaNode = document.createElement("span");
    metaNode.className = "tree-meta";
    metaNode.textContent = Array.isArray(item)
      ? `Array(${entries.length})`
      : `Object(${entries.length})`;
    summary.append(keyNode, metaNode);
    details.append(summary);

    const children = document.createElement("div");
    children.className = "tree-children";
    for (const [childKey, child] of entries) {
      renderNode(children, childKey, child, depth + 1);
      if (truncated) break;
    }
    details.append(children);
    parent.append(details);
  }

  renderNode(fragment, null, value, 0);
  if (truncated) appendTreeLimit(fragment);
  return fragment;
}

function json5Error(error) {
  const line = Number(error?.lineNumber);
  const column = Number(error?.columnNumber);
  if (Number.isFinite(line) && Number.isFinite(column)) {
    return { message: error.message, position: { line, column } };
  }
  const match = String(error?.message || "").match(/at\s+(\d+):(\d+)/);
  return {
    message: error?.message || "Invalid JSON5.",
    position: match ? { line: Number(match[1]), column: Number(match[2]) } : null,
  };
}

function renderJsonlTree(source) {
  const fragment = document.createDocumentFragment();
  const lines = source.split("\n");
  let records = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const errors = [];
    parseTree(line, errors, { allowTrailingComma: false, disallowComments: true });
    if (errors.length) {
      return {
        error: {
          message: `Invalid JSON on record ${records + 1}.`,
          position: {
            line: index + 1,
            column: errors[0].offset + 1,
          },
        },
      };
    }
    const tree = renderJsonTree(line, { label: `Record ${records + 1}` });
    if (!tree) {
      return {
        error: {
          message: `Invalid JSON on record ${records + 1}.`,
          position: { line: index + 1, column: 1 },
        },
      };
    }
    fragment.append(tree);
    records += 1;
  }
  return { fragment, records };
}

function tokenizeJsonSource(source) {
  const tokens = [];
  for (let index = 0; index < source.length;) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === '"') {
      const start = index++;
      let escaped = false;
      while (index < source.length) {
        const current = source[index++];
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === '"') break;
      }
      tokens.push({ type: "value", text: source.slice(start, index) });
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      const start = index;
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") index += 1;
      tokens.push({ type: "line-comment", text: source.slice(start, index) });
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const start = index;
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index += 1;
      index = Math.min(source.length, index + 2);
      tokens.push({ type: "block-comment", text: source.slice(start, index) });
      continue;
    }
    if ("{}[],:".includes(char)) {
      tokens.push({ type: char, text: char });
      index += 1;
      continue;
    }
    const start = index;
    while (index < source.length) {
      const current = source[index];
      if (/\s/.test(current) || "{}[],:".includes(current)) break;
      if (current === "/" && ["/", "*"].includes(source[index + 1])) break;
      index += 1;
    }
    tokens.push({ type: "value", text: source.slice(start, index) });
  }
  return tokens;
}

function validateJsonSource(source, { allowComments = false, allowTrailingComma = false } = {}) {
  const errors = [];
  const root = parseTree(source, errors, {
    allowTrailingComma,
    disallowComments: !allowComments,
  });
  if (!root || errors.length) {
    const first = errors[0];
    const error = new Error("Invalid JSON-family document.");
    error.position = first ? positionFromOffset(source, first.offset) : null;
    throw error;
  }
}

function rewriteJsonWhitespace(source, {
  compact = false,
  allowComments = false,
  allowTrailingComma = false,
} = {}) {
  validateJsonSource(source, { allowComments, allowTrailingComma });
  const tokens = tokenizeJsonSource(source);
  if (compact) {
    let output = "";
    for (const token of tokens) {
      if (token.type === "line-comment") {
        output += token.text.trimEnd();
        output += "\n";
      } else {
        output += token.text;
      }
    }
    return output.trim() + "\n";
  }

  let output = "";
  let indent = 0;
  let lineStart = true;
  let previous = null;
  const padding = () => "  ".repeat(Math.max(0, indent));
  const append = (text) => {
    if (lineStart) {
      output += padding();
      lineStart = false;
    }
    output += text;
  };
  const newline = () => {
    output = output.replace(/[ \t]+$/g, "");
    if (!output.endsWith("\n")) output += "\n";
    lineStart = true;
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (token.type === "{" || token.type === "[") {
      append(token.text);
      indent += 1;
      if (next && !((token.type === "{" && next.type === "}") || (token.type === "[" && next.type === "]"))) {
        newline();
      }
    } else if (token.type === "}" || token.type === "]") {
      indent = Math.max(0, indent - 1);
      if (previous && previous.type !== "{" && previous.type !== "[" && !lineStart) newline();
      append(token.text);
    } else if (token.type === ",") {
      append(",");
      newline();
    } else if (token.type === ":") {
      append(": ");
    } else if (token.type === "line-comment") {
      if (!lineStart && !/[ \t]$/.test(output)) output += " ";
      append(token.text.trimEnd());
      newline();
    } else if (token.type === "block-comment") {
      if (!lineStart && !/[ \t]$/.test(output)) output += " ";
      append(token.text);
      if (next && ![",", "}", "]", ":"].includes(next.type)) output += " ";
    } else {
      append(token.text);
    }
    previous = token;
  }
  return output.trimEnd() + "\n";
}

function formatJsonl(source, compact = false) {
  const output = [];
  const lines = source.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      output.push(rewriteJsonWhitespace(line, { compact }).trim());
    } catch (error) {
      error.position = {
        line: index + 1,
        column: error.position?.column || 1,
      };
      throw error;
    }
  }
  return output.join("\n") + (output.length ? "\n" : "");
}

function normalizeJson5(source, compact = false) {
  const json5 = globalThis.JSON5;
  if (!json5?.parse || !json5?.stringify) throw new Error("JSON5 runtime is unavailable.");
  const value = json5.parse(source);
  return json5.stringify(value, null, compact ? 0 : 2) + "\n";
}

function updateFilenameForStrictJson() {
  state.handle = null;
  const base = (state.filename || filenameLabel.textContent || "document")
    .replace(/\.(?:jsonc|json5|jsonl|ndjson|json)$/i, "");
  state.filename = `${base || "document"}.json`;
  filenameLabel.textContent = state.filename;
  formatSelect.value = "json";
  updateFormatButton();
  updateSaveButton();
}

function repairJsonDocument() {
  const repair = globalThis.JSONRepair?.jsonrepair;
  if (typeof repair !== "function") throw new Error("JSON repair runtime is unavailable.");
  const repaired = repair(editor.value);
  editor.value = rewriteJsonWhitespace(repaired);
  state.documentRevision += 1;
  state.mixedEol = false;
  updateFilenameForStrictJson();
  renderEnhancedPreview();
  setStatus("good", "Repaired → strict JSON");
}

function transformJsonFamily(mode) {
  const format = formatSelect.value;
  const compact = mode === "minify";
  if (format === "json") {
    editor.value = rewriteJsonWhitespace(editor.value, { compact });
  } else if (format === "jsonc") {
    editor.value = rewriteJsonWhitespace(editor.value, {
      compact,
      allowComments: true,
      allowTrailingComma: true,
    });
  } else if (format === "json5") {
    editor.value = normalizeJson5(editor.value, compact);
  } else if (format === "jsonl") {
    editor.value = formatJsonl(editor.value, compact);
  } else {
    return false;
  }
  state.documentRevision += 1;
  state.mixedEol = false;
  renderEnhancedPreview();
  setStatus("good", compact ? "Minified" : "Formatted");
  return true;
}

function xmlParserError(doc) {
  const root = doc.documentElement;
  const namespaces = new Set([
    "http://www.mozilla.org/newlayout/xml/parsererror.xml",
    "http://www.w3.org/1999/xhtml",
  ]);
  const isParserError = (node) => node?.localName === "parsererror"
    && namespaces.has(node.namespaceURI);
  if (isParserError(root)) return root;
  if (root?.localName !== "html" || root.namespaceURI !== "http://www.w3.org/1999/xhtml") {
    return null;
  }
  const body = root.getElementsByTagName("body")[0];
  const candidate = body?.firstElementChild;
  return isParserError(candidate) ? candidate : null;
}

function preservesXmlSpace(node) {
  let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (element) {
    const mode = element.getAttributeNS?.(XML_NAMESPACE, "space");
    if (mode === "preserve") return true;
    if (mode === "default") return false;
    element = element.parentElement;
  }
  return false;
}

function renderXmlTree(doc) {
  const fragment = document.createDocumentFragment();
  const serializer = new XMLSerializer();
  let nodes = 0;
  let truncated = false;

  function renderNode(parent, node, depth) {
    if (nodes >= MAX_TREE_NODES) {
      truncated = true;
      return;
    }
    nodes += 1;

    if (node.nodeType === Node.ELEMENT_NODE) {
      const details = document.createElement("details");
      details.className = "tree-node xml-node";
      details.open = depth < 2;
      const summary = document.createElement("summary");
      const name = document.createElement("span");
      name.className = "tree-key";
      name.textContent = `<${node.nodeName}>`;
      summary.append(name);
      for (const attribute of node.attributes) {
        if (nodes >= MAX_TREE_NODES) {
          truncated = true;
          break;
        }
        nodes += 1;
        const attr = document.createElement("span");
        attr.className = "xml-attribute";
        attr.textContent = `${attribute.name}=${JSON.stringify(attribute.value)}`;
        summary.append(attr);
      }
      details.append(summary);
      const children = document.createElement("div");
      children.className = "tree-children";
      for (const child of node.childNodes) {
        renderNode(children, child, depth + 1);
        if (truncated) break;
      }
      details.append(children);
      parent.append(details);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue || "";
      if (value.trim() || preservesXmlSpace(node)) {
        appendScalar(parent, "#text", value);
      }
      return;
    }
    if (node.nodeType === Node.CDATA_SECTION_NODE) {
      appendScalar(parent, "#cdata", node.nodeValue || "");
      return;
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      appendScalar(parent, "#comment", node.nodeValue || "");
      return;
    }
    if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      appendSourceScalar(
        parent,
        "#processing-instruction",
        sourceScalar(serializer.serializeToString(node), "string"),
      );
      return;
    }
    if (node.nodeType === Node.DOCUMENT_TYPE_NODE) {
      appendSourceScalar(
        parent,
        "#doctype",
        sourceScalar(serializer.serializeToString(node), "string"),
      );
    }
  }

  for (const child of doc.childNodes) {
    renderNode(fragment, child, 0);
    if (truncated) break;
  }
  if (truncated) appendTreeLimit(fragment);
  return fragment;
}

function safeHref(href) {
  if (!href) return null;
  if (href.startsWith("#")) return href;
  try {
    const resolved = new URL(href, globalThis.location.href);
    if (["http:", "https:", "mailto:"].includes(resolved.protocol)) return href;
  } catch {
    return null;
  }
  return null;
}

function markdownBudget() {
  return { nodes: 0, truncated: false };
}

function takeMarkdownNode(budget) {
  if (budget.nodes >= MAX_TREE_NODES) {
    budget.truncated = true;
    return false;
  }
  budget.nodes += 1;
  return true;
}

function markdownElement(tag, budget) {
  return takeMarkdownNode(budget) ? document.createElement(tag) : null;
}

function appendMarkdownText(parent, text, budget) {
  if (!text || !takeMarkdownNode(budget)) return;
  parent.append(document.createTextNode(text));
}

function markdownInline(tokens, parent, budget) {
  for (const token of tokens || []) {
    if (budget.truncated) break;
    if (token.type === "text" || token.type === "escape") {
      if (token.tokens?.length) markdownInline(token.tokens, parent, budget);
      else appendMarkdownText(parent, token.text || "", budget);
      continue;
    }
    if (["strong", "em", "del"].includes(token.type)) {
      const tag = token.type === "strong" ? "strong" : token.type;
      const element = markdownElement(tag, budget);
      if (!element) break;
      markdownInline(token.tokens, element, budget);
      parent.append(element);
      continue;
    }
    if (token.type === "codespan") {
      const code = markdownElement("code", budget);
      if (!code) break;
      appendMarkdownText(code, token.text || "", budget);
      parent.append(code);
      continue;
    }
    if (token.type === "br") {
      const br = markdownElement("br", budget);
      if (br) parent.append(br);
      continue;
    }
    if (token.type === "link") {
      const href = safeHref(token.href);
      if (!href) {
        markdownInline(token.tokens, parent, budget);
        continue;
      }
      const link = markdownElement("a", budget);
      if (!link) break;
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (token.title) link.title = token.title;
      markdownInline(token.tokens, link, budget);
      parent.append(link);
      continue;
    }
    if (token.type === "image") {
      const image = markdownElement("span", budget);
      if (!image) break;
      image.className = "markdown-image-placeholder";
      appendMarkdownText(image, token.text ? `[image: ${token.text}]` : "[image omitted]", budget);
      if (token.href) image.title = `Remote images are not loaded automatically: ${token.href}`;
      parent.append(image);
      continue;
    }
    if (token.type === "html") {
      const raw = markdownElement("code", budget);
      if (!raw) break;
      raw.className = "markdown-raw-html";
      appendMarkdownText(raw, token.text || token.raw || "", budget);
      parent.append(raw);
      continue;
    }
    if (token.tokens?.length) markdownInline(token.tokens, parent, budget);
    else if (token.text) appendMarkdownText(parent, token.text, budget);
  }
}

function markdownCellTokens(cell) {
  if (Array.isArray(cell)) return cell;
  if (cell?.tokens) return cell.tokens;
  return [{ type: "text", text: cell?.text ?? String(cell ?? "") }];
}

function renderMarkdownBlocks(tokens, parent, budget) {
  for (const token of tokens || []) {
    if (budget.truncated) break;
    if (token.type === "space") continue;
    if (token.type === "heading") {
      const depth = Math.min(6, Math.max(1, token.depth || 1));
      const heading = markdownElement(`h${depth}`, budget);
      if (!heading) break;
      markdownInline(token.tokens, heading, budget);
      parent.append(heading);
      continue;
    }
    if (token.type === "paragraph" || token.type === "text") {
      const paragraph = markdownElement("p", budget);
      if (!paragraph) break;
      markdownInline(token.tokens?.length ? token.tokens : [token], paragraph, budget);
      parent.append(paragraph);
      continue;
    }
    if (token.type === "code") {
      const pre = markdownElement("pre", budget);
      const code = markdownElement("code", budget);
      if (!pre || !code) break;
      appendMarkdownText(code, token.text || "", budget);
      if (token.lang) code.dataset.language = token.lang.split(/\s+/)[0];
      pre.append(code);
      parent.append(pre);
      continue;
    }
    if (token.type === "blockquote") {
      const quote = markdownElement("blockquote", budget);
      if (!quote) break;
      renderMarkdownBlocks(token.tokens, quote, budget);
      parent.append(quote);
      continue;
    }
    if (token.type === "list") {
      const list = markdownElement(token.ordered ? "ol" : "ul", budget);
      if (!list) break;
      if (token.ordered && Number.isFinite(token.start) && token.start !== 1) {
        list.start = token.start;
      }
      for (const itemToken of token.items || []) {
        if (budget.truncated) break;
        const item = markdownElement("li", budget);
        if (!item) break;
        if (itemToken.task) {
          const checkbox = markdownElement("input", budget);
          if (!checkbox) break;
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(itemToken.checked);
          checkbox.disabled = true;
          checkbox.setAttribute("aria-hidden", "true");
          item.append(checkbox);
          appendMarkdownText(item, " ", budget);
        }
        renderMarkdownBlocks(itemToken.tokens, item, budget);
        list.append(item);
      }
      parent.append(list);
      continue;
    }
    if (token.type === "table") {
      const table = markdownElement("table", budget);
      const thead = markdownElement("thead", budget);
      const headRow = markdownElement("tr", budget);
      if (!table || !thead || !headRow) break;
      for (const [index, cell] of (token.header || []).entries()) {
        if (budget.truncated) break;
        const th = markdownElement("th", budget);
        if (!th) break;
        const align = token.align?.[index];
        if (["left", "center", "right"].includes(align)) th.style.textAlign = align;
        markdownInline(markdownCellTokens(cell), th, budget);
        headRow.append(th);
      }
      thead.append(headRow);
      table.append(thead);
      const tbody = markdownElement("tbody", budget);
      if (!tbody) break;
      for (const row of token.rows || []) {
        if (budget.truncated) break;
        const tr = markdownElement("tr", budget);
        if (!tr) break;
        for (const [index, cell] of row.entries()) {
          if (budget.truncated) break;
          const td = markdownElement("td", budget);
          if (!td) break;
          const align = token.align?.[index];
          if (["left", "center", "right"].includes(align)) td.style.textAlign = align;
          markdownInline(markdownCellTokens(cell), td, budget);
          tr.append(td);
        }
        tbody.append(tr);
      }
      table.append(tbody);
      parent.append(table);
      continue;
    }
    if (token.type === "hr") {
      const hr = markdownElement("hr", budget);
      if (hr) parent.append(hr);
      continue;
    }
    if (token.type === "html") {
      const raw = markdownElement("pre", budget);
      const code = markdownElement("code", budget);
      if (!raw || !code) break;
      raw.className = "markdown-raw-html-block";
      appendMarkdownText(code, token.text || token.raw || "", budget);
      raw.append(code);
      parent.append(raw);
      continue;
    }
    if (token.tokens?.length) renderMarkdownBlocks(token.tokens, parent, budget);
  }
}

function appendMarkdownLimit(fragment) {
  const note = document.createElement("p");
  note.className = "preview-limit-note";
  note.textContent = `Markdown preview stopped after ${MAX_TREE_NODES.toLocaleString()} DOM nodes.`;
  fragment.append(note);
}

function renderMarkdown() {
  const markedApi = globalThis.marked;
  if (!markedApi?.lexer) {
    setPreviewMode("raw", "Markdown source");
    preview.textContent = editor.value;
    setStatus("bad", "Preview unavailable");
    return;
  }
  const tokens = markedApi.lexer(editor.value, { gfm: true, breaks: false });
  const fragment = document.createDocumentFragment();
  const budget = markdownBudget();
  renderMarkdownBlocks(tokens, fragment, budget);
  if (budget.truncated) appendMarkdownLimit(fragment);
  setPreviewMode("markdown", "Markdown preview");
  preview.replaceChildren(fragment);
  setStatus("neutral", budget.truncated ? "Rendered · truncated" : "Rendered Markdown");
}

function renderEnhancedPreview() {
  const format = formatSelect.value;
  if (format === "txt") {
    setPreviewMode("raw", "Plain-text preview");
    preview.textContent = editor.value;
    setStatus("neutral", "Plain text");
    updateMeta();
    return;
  }
  if (format === "md") {
    renderMarkdown();
    updateMeta();
    return;
  }
  if (format === "json" || format === "jsonc") {
    const jsonc = format === "jsonc";
    const options = {
      allowTrailingComma: jsonc,
      disallowComments: !jsonc,
      label: jsonc ? "JSONC" : "JSON",
    };
    const tree = renderJsonTree(editor.value, options);
    if (!tree) {
      const errors = [];
      parseTree(editor.value, errors, options);
      const position = errors[0] ? positionFromOffset(editor.value, errors[0].offset) : null;
      renderParseError({ message: jsonc ? "Invalid JSONC." : "Invalid JSON.", position });
      updateMeta();
      return;
    }
    setPreviewMode("tree", jsonc ? "JSONC tree" : "JSON tree");
    preview.replaceChildren(tree);
    setStatus("good", "Valid · tree");
    updateMeta();
    return;
  }
  if (format === "json5") {
    try {
      const json5 = globalThis.JSON5;
      if (!json5?.parse) throw new Error("JSON5 runtime is unavailable.");
      const value = json5.parse(editor.value);
      setPreviewMode("tree", "JSON5 tree");
      preview.replaceChildren(renderValueTree(value, "JSON5"));
      setStatus("good", "Valid · tree");
    } catch (error) {
      renderParseError(json5Error(error));
    }
    updateMeta();
    return;
  }
  if (format === "jsonl") {
    const result = renderJsonlTree(editor.value);
    if (result.error) {
      renderParseError(result.error);
      updateMeta();
      return;
    }
    setPreviewMode("tree", "JSONL records");
    preview.replaceChildren(result.fragment);
    setStatus("good", `Valid · ${result.records} record${result.records === 1 ? "" : "s"}`);
    updateMeta();
    return;
  }
  if (format === "yaml") {
    try {
      globalThis.jsyaml.loadAll(editor.value);
      const tree = renderYamlTree(editor.value);
      if (!tree) throw new Error("YAML AST runtime is unavailable.");
      setPreviewMode("tree", "YAML tree");
      preview.replaceChildren(tree);
      setStatus("good", "Valid · tree");
    } catch (error) {
      const mark = error?.mark;
      renderParseError({
        message: error?.reason || error?.message || "Invalid YAML.",
        position: mark ? { line: mark.line + 1, column: mark.column + 1 } : null,
      });
    }
    updateMeta();
    return;
  }
  if (format === "xml") {
    const doc = new DOMParser().parseFromString(sanitizeXmlForPreview(editor.value), "application/xml");
    const parserError = xmlParserError(doc);
    if (parserError) {
      renderParseError(parseXmlError(parserError));
      updateMeta();
      return;
    }
    setPreviewMode("tree", "XML tree");
    preview.replaceChildren(renderXmlTree(doc));
    setStatus("good", "Valid · tree");
    updateMeta();
  }
}

let previewTimer;
function schedulePreview(delay = 145) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderEnhancedPreview, delay);
}

document.addEventListener("docbench:inspect-start", () => {
  clearTimeout(previewTimer);
  previewTimer = undefined;
});

function documentBytes() {
  const raw = applyEol(editor.value, eolSelect.value);
  const encoded = new TextEncoder().encode(raw);
  if (!state.bom) return encoded;
  const result = new Uint8Array(encoded.length + 3);
  result.set([0xef, 0xbb, 0xbf]);
  result.set(encoded, 3);
  return result;
}

function currentDocumentSnapshot() {
  return {
    revision: state.documentRevision,
    bytes: documentBytes(),
    filename: state.filename || filenameLabel.textContent || "document.txt",
    format: formatSelect.value,
  };
}

function downloadDocument(snapshot = currentDocumentSnapshot()) {
  const blob = new Blob(
    [snapshot.bytes],
    { type: mimeByFormat[snapshot.format] || mimeByFormat.txt },
  );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = snapshot.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function ensureWritePermission(handle) {
  if (typeof handle.queryPermission !== "function") return true;
  const options = { mode: "readwrite" };
  if (await handle.queryPermission(options) === "granted") return true;
  if (typeof handle.requestPermission !== "function") return false;
  return await handle.requestPermission(options) === "granted";
}

function flashSaveState(text) {
  saveButton.textContent = text;
  setTimeout(updateSaveButton, 1100);
}

function staleSaveError() {
  const error = new Error("The active document changed while save was waiting.");
  error.name = "StaleDocumentError";
  return error;
}

async function writeHandle(handle, snapshot) {
  if (!await ensureWritePermission(handle)) {
    throw new Error("Write permission was not granted.");
  }
  if (state.documentRevision !== snapshot.revision) throw staleSaveError();
  const writable = await handle.createWritable();
  try {
    if (state.documentRevision !== snapshot.revision) throw staleSaveError();
    await writable.write(snapshot.bytes);
    if (state.documentRevision !== snapshot.revision) throw staleSaveError();
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      // Preserve the original write/close error.
    }
    throw error;
  }

  if (state.documentRevision !== snapshot.revision) return;
  state.handle = handle;
  state.filename = handle.name || snapshot.filename;
  filenameLabel.textContent = state.filename;
  updateMeta();
  updateSaveButton();
  flashSaveState("Saved ✓");
}

async function chooseSaveHandle(snapshot) {
  return globalThis.showSaveFilePicker({
    suggestedName: snapshot.filename,
    types: pickerTypes,
  });
}

async function saveDocument() {
  const snapshot = currentDocumentSnapshot();
  const linkedHandle = state.handle;
  try {
    if (linkedHandle) {
      await writeHandle(linkedHandle, snapshot);
      return;
    }
    if (nativeSaveSupported) {
      const handle = await chooseSaveHandle(snapshot);
      if (state.documentRevision !== snapshot.revision) throw staleSaveError();
      await writeHandle(handle, snapshot);
      return;
    }
    downloadDocument(snapshot);
    flashSaveState("Downloaded ✓");
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "StaleDocumentError") return;
    if (!linkedHandle && ["TypeError", "SecurityError", "NotAllowedError"].includes(error?.name)) {
      downloadDocument(snapshot);
      flashSaveState("Downloaded ✓");
      return;
    }
    setStatus("bad", "Save failed");
    statusBadge.title = error?.message || String(error);
  }
}

async function loadNativeHandle(handle, revision) {
  const file = await handle.getFile();
  const { raw, bom, eol } = await readTextFile(file);
  if (state.documentRevision !== revision) return false;
  state.handle = handle;
  state.filename = file.name || handle.name || "document.txt";
  state.bom = bom;
  state.mixedEol = eol.mixed;
  state.eol = eol.target;
  editor.value = normalizeEol(raw);
  eolSelect.value = eol.target;
  formatSelect.value = formatFromFilename(state.filename);
  filenameLabel.textContent = state.filename;
  updateFormatButton();
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  updateSaveButton();
  schedulePreview();
  return true;
}

async function syncFallbackFile(file, revision) {
  try {
    const { raw, bom, eol } = await readTextFile(file);
    if (state.documentRevision !== revision) return;
    state.handle = null;
    state.filename = file.name || "document.txt";
    state.bom = bom;
    state.mixedEol = eol.mixed;
    state.eol = eol.target;
    editor.value = normalizeEol(raw);
    eolSelect.value = eol.target;
    formatSelect.value = formatFromFilename(state.filename);
    filenameLabel.textContent = state.filename;
    updateFormatButton();
    updateSaveButton();
    document.dispatchEvent(new Event("docbench:document-change"));
    renderEnhancedPreview();
  } catch (error) {
    if (state.documentRevision !== revision) return;
    setStatus("bad", "Open failed");
    statusBadge.title = error?.message || String(error);
    updateSaveButton();
  }
}

mergeFilesButton.addEventListener("click", () => {
  ensureFreshMergeQueue();
  mergeFilesInput.click();
});
mergeFilesInput.addEventListener("change", () => {
  const files = mergeFilesInput.files;
  if (!files?.length) return;
  void queueAndMergeFiles(files)
    .catch((error) => {
      if (error?.name === "StaleDocumentError") {
        setMergeFeedback("bad", "Merge cancelled · document changed");
        return;
      }
      const message = error?.message || String(error);
      setStatus("bad", "Merge failed");
      statusBadge.title = message;
      setMergeFeedback("bad", `Merge failed · ${message}`);
      resetMergeQueue();
    })
    .finally(() => {
      mergeFilesInput.value = "";
    });
});

openButton.addEventListener("click", (event) => {
  if (!nativeOpenSupported) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void (async () => {
    let handle;
    try {
      [handle] = await globalThis.showOpenFilePicker({
        multiple: false,
      });
    } catch (error) {
      if (error?.name === "AbortError") return;
      if (["TypeError", "SecurityError", "NotAllowedError"].includes(error?.name)) {
        fileInput.click();
        return;
      }
      setStatus("bad", "Open failed");
      statusBadge.title = error?.message || String(error);
      return;
    }
    if (!handle) return;
    const revision = state.documentRevision += 1;
    try {
      await loadNativeHandle(handle, revision);
    } catch (error) {
      if (state.documentRevision !== revision) return;
      setStatus("bad", "Open failed");
      statusBadge.title = error?.message || String(error);
    }
  })();
}, true);

saveButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  void saveDocument();
}, true);

downloadButton.addEventListener("click", () => downloadDocument());

function printDocument() {
  const details = [...preview.querySelectorAll("details")];
  const openState = details.map((item) => item.open);
  details.forEach((item) => { item.open = true; });
  document.body.dataset.printWorkspace = "document";
  try {
    globalThis.print();
  } finally {
    delete document.body.dataset.printWorkspace;
    details.forEach((item, index) => { item.open = openState[index]; });
  }
}

printButton.addEventListener("click", printDocument);

fileInput.addEventListener("change", (event) => {
  const file = fileInput.files?.[0];
  if (!file) return;
  event.stopImmediatePropagation();
  const revision = state.documentRevision += 1;
  void syncFallbackFile(file, revision).finally(() => {
    if (state.documentRevision === revision) fileInput.value = "";
  });
}, true);

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  dropZone.classList.remove("drop-active");
  const revision = state.documentRevision += 1;
  void syncFallbackFile(file, revision);
}, true);

function commitFilenameEdit() {
  const previousFilename = state.filename;
  const previousFormat = formatSelect.value;
  const next = filenameLabel.textContent.trim().replace(/[\\/:*?"<>|]/g, "-");
  const fallback = `untitled.${preferredExtension[formatSelect.value]}`;
  state.filename = next || fallback;
  filenameLabel.textContent = state.filename;

  const filenameChanged = state.filename !== previousFilename;
  const nextFormat = formatFromFilename(state.filename);
  const formatChanged = nextFormat !== previousFormat;
  if (filenameChanged || formatChanged) state.documentRevision += 1;
  if (filenameChanged) state.handle = null;

  formatSelect.value = nextFormat;
  updateFormatButton();
  updateSaveButton();
  updateMeta();
  if (formatChanged) schedulePreview(0);
}

filenameLabel.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    filenameLabel.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    filenameLabel.textContent = state.filename;
    filenameLabel.blur();
  }
});
filenameLabel.addEventListener("blur", commitFilenameEdit);
newButton.addEventListener("click", () => {
  queueMicrotask(() => {
    state.documentRevision += 1;
    state.handle = null;
    state.filename = filenameLabel.textContent || "untitled.txt";
    state.bom = false;
    state.mixedEol = false;
    state.eol = eolSelect.value;
    updateSaveButton();
    renderEnhancedPreview();
  });
});

editor.addEventListener("input", () => {
  state.documentRevision += 1;
  schedulePreview();
});
formatSelect.addEventListener("change", (event) => {
  event.stopImmediatePropagation();
  state.documentRevision += 1;
  if (!state.handle && state.filename.startsWith("untitled.")) {
    state.filename = `untitled.${preferredExtension[formatSelect.value]}`;
  }
  filenameLabel.textContent = state.filename;
  updateFormatButton();
  schedulePreview();
}, true);
eolSelect.addEventListener("change", () => {
  state.documentRevision += 1;
  state.mixedEol = false;
  state.eol = eolSelect.value;
  setTimeout(updateMeta, 0);
});
function renderJsonTransformError(error) {
  const format = formatSelect.value;
  if (error?.position) {
    renderParseError({ message: error.message, position: error.position });
  } else if (format === "json5") {
    renderParseError(json5Error(error));
  } else {
    const offset = Number(String(error?.message || "").match(/position\s+(\d+)/i)?.[1]);
    renderParseError({
      message: error?.message || "JSON transform failed.",
      position: Number.isFinite(offset) ? positionFromOffset(editor.value, offset) : null,
    });
  }
  updateMeta();
}

formatButton.addEventListener("click", (event) => {
  if (!["jsonc", "json5", "jsonl"].includes(formatSelect.value)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    transformJsonFamily("format");
  } catch (error) {
    renderJsonTransformError(error);
  }
}, true);

minifyButton.addEventListener("click", () => {
  try {
    transformJsonFamily("minify");
  } catch (error) {
    renderJsonTransformError(error);
  }
});

repairButton.addEventListener("click", () => {
  try {
    repairJsonDocument();
  } catch (error) {
    renderJsonTransformError(error);
  }
});

validateButton.addEventListener("click", (event) => {
  if (!["jsonc", "json5", "jsonl"].includes(formatSelect.value)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  renderEnhancedPreview();
}, true);

formatButton.addEventListener("click", () => {
  state.documentRevision += 1;
  queueMicrotask(() => {
    if (statusBadge.dataset.formatResult === "failed") {
      updateMeta();
      return;
    }
    state.mixedEol = false;
    renderEnhancedPreview();
  });
});
validateButton.addEventListener("click", () => schedulePreview(20));

document.addEventListener("keydown", (event) => {
  if (documentWorkspace.hidden) return;
  if (event.altKey || (!event.ctrlKey && !event.metaKey)) return;
  if (event.key.toLowerCase() !== "s") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void saveDocument();
}, true);

updateSaveButton();
updateFormatButton();
schedulePreview(0);
