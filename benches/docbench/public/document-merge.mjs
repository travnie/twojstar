import { parseTree } from "./vendor/jsonc-parser/impl/parser.js";

const MARKDOWN_EXTENSIONS = new Set(["md", "markdown"]);
const TEXT_EXTENSIONS = new Set(["txt", ...MARKDOWN_EXTENSIONS]);
const JSON_EXTENSIONS = new Set(["json", "jsonc"]);
const JSONL_EXTENSIONS = new Set(["jsonl", "ndjson"]);
const MAX_REPORTED_CONFLICTS = 100;

function extension(name) {
  const filename = String(name || "");
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function mergeFamilyForFilename(name) {
  const ext = extension(name);
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  if (JSON_EXTENSIONS.has(ext)) return "json";
  if (JSONL_EXTENSIONS.has(ext)) return "jsonl";
  return null;
}

export function isMergeFilename(name) {
  return mergeFamilyForFilename(name) !== null;
}

export function isMergeTextFilename(name) {
  return mergeFamilyForFilename(name) === "text";
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
      throw new Error(`${name}: only .txt, .md and .markdown files can be merged as text.`);
    }
    if (MARKDOWN_EXTENSIONS.has(ext)) markdown = true;
    return String(document?.text ?? "");
  });

  return {
    filename: markdown ? "merged.md" : "merged.txt",
    format: markdown ? "md" : "txt",
    text: texts.join("\n\n"),
    conflictCount: 0,
    conflicts: [],
  };
}

function parseJsonTree(document) {
  const name = String(document?.name || "document.json");
  const source = String(document?.text ?? "");
  const ext = extension(name);
  if (!JSON_EXTENSIONS.has(ext)) {
    throw new Error(`${name}: smart JSON merge supports .json and .jsonc inputs.`);
  }

  const errors = [];
  const jsonc = ext === "jsonc";
  const root = parseTree(source, errors, {
    allowTrailingComma: jsonc,
    disallowComments: !jsonc,
  });
  if (!root || errors.length) {
    const first = errors[0];
    const at = first ? ` at offset ${first.offset}` : "";
    throw new Error(`${name}: invalid ${jsonc ? "JSONC" : "JSON"}${at}.`);
  }
  if (!["object", "array"].includes(root.type)) {
    throw new Error(`${name}: smart JSON merge requires an object or array at the root.`);
  }
  return astNode(root, source, name, "$");
}

function astNode(node, source, name, path) {
  if (node.type === "array") {
    return {
      type: "array",
      items: (node.children || []).map((child, index) => astNode(child, source, name, `${path}[${index}]`)),
    };
  }
  if (node.type === "object") {
    const entries = [];
    const seen = new Set();
    for (const property of node.children || []) {
      const [keyNode, valueNode] = property.children || [];
      const key = String(keyNode?.value ?? "");
      if (!valueNode) throw new Error(`${name}: property ${key || "?"} has no value.`);
      if (seen.has(key)) {
        throw new Error(`${name}: duplicate key ${jsonPath(path, key)} makes smart merge ambiguous.`);
      }
      seen.add(key);
      entries.push({
        key,
        value: astNode(valueNode, source, name, jsonPath(path, key)),
      });
    }
    return { type: "object", entries };
  }
  return {
    type: "scalar",
    scalarType: node.type,
    raw: source.slice(node.offset, node.offset + node.length).trim(),
  };
}

function jsonPath(parent, key) {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function cloneNode(node) {
  if (node.type === "array") {
    return { type: "array", items: node.items.map(cloneNode) };
  }
  if (node.type === "object") {
    return {
      type: "object",
      entries: node.entries.map(({ key, value }) => ({ key, value: cloneNode(value) })),
    };
  }
  return { ...node };
}

function recordConflict(report, path) {
  report.count += 1;
  if (report.paths.length < MAX_REPORTED_CONFLICTS) report.paths.push(path);
}

function mergeNodes(base, incoming, path, report) {
  if (base.type === "object" && incoming.type === "object") {
    const result = cloneNode(base);
    const positions = new Map(result.entries.map((entry, index) => [entry.key, index]));
    for (const entry of incoming.entries) {
      const existing = positions.get(entry.key);
      if (existing === undefined) {
        positions.set(entry.key, result.entries.length);
        result.entries.push({ key: entry.key, value: cloneNode(entry.value) });
        continue;
      }
      result.entries[existing].value = mergeNodes(
        result.entries[existing].value,
        entry.value,
        jsonPath(path, entry.key),
        report,
      );
    }
    return result;
  }

  if (base.type === "array" && incoming.type === "array") {
    return {
      type: "array",
      items: [...base.items.map(cloneNode), ...incoming.items.map(cloneNode)],
    };
  }

  if (base.type === "scalar"
    && incoming.type === "scalar"
    && base.scalarType === incoming.scalarType
    && base.raw === incoming.raw) {
    return cloneNode(base);
  }

  recordConflict(report, path);
  return cloneNode(incoming);
}

function indent(depth) {
  return "  ".repeat(depth);
}

function serializeNode(node, depth = 0) {
  if (node.type === "scalar") return node.raw;
  if (node.type === "array") {
    if (!node.items.length) return "[]";
    const body = node.items
      .map((item) => `${indent(depth + 1)}${serializeNode(item, depth + 1)}`)
      .join(",\n");
    return `[\n${body}\n${indent(depth)}]`;
  }
  if (!node.entries.length) return "{}";
  const body = node.entries
    .map(({ key, value }) => {
      return `${indent(depth + 1)}${JSON.stringify(key)}: ${serializeNode(value, depth + 1)}`;
    })
    .join(",\n");
  return `{\n${body}\n${indent(depth)}}`;
}

export function mergeJsonDocuments(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new Error("Choose at least two JSON or JSONC files to merge.");
  }

  const trees = documents.map(parseJsonTree);
  const rootType = trees[0].type;
  if (trees.some((tree) => tree.type !== rootType)) {
    throw new Error("Smart JSON merge cannot mix object roots with array roots.");
  }

  const report = { count: 0, paths: [] };
  let merged = cloneNode(trees[0]);
  for (let index = 1; index < trees.length; index += 1) {
    merged = mergeNodes(merged, trees[index], "$", report);
  }

  return {
    filename: "merged.json",
    format: "json",
    text: `${serializeNode(merged)}\n`,
    conflictCount: report.count,
    conflicts: report.paths,
  };
}

export function mergeJsonlDocuments(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new Error("Choose at least two JSONL or NDJSON files to merge.");
  }

  const records = [];
  for (const [documentIndex, document] of documents.entries()) {
    const name = String(document?.name || `document-${documentIndex + 1}.jsonl`);
    if (!JSONL_EXTENSIONS.has(extension(name))) {
      throw new Error(`${name}: JSONL merge supports only .jsonl and .ndjson inputs.`);
    }
    const lines = String(document?.text ?? "").split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex].trim();
      if (!line) continue;
      const errors = [];
      const root = parseTree(line, errors, {
        allowTrailingComma: false,
        disallowComments: true,
      });
      if (!root || errors.length) {
        throw new Error(`${name}: invalid JSON record on line ${lineIndex + 1}.`);
      }
      records.push(line);
    }
  }

  return {
    filename: "merged.jsonl",
    format: "jsonl",
    text: records.length ? `${records.join("\n")}\n` : "",
    conflictCount: 0,
    conflicts: [],
  };
}

export function mergeDocuments(documents) {
  if (!Array.isArray(documents) || documents.length < 2) {
    throw new Error("Choose at least two compatible files to merge.");
  }
  const families = documents.map((document) => mergeFamilyForFilename(document?.name));
  if (families.some((family) => !family)) {
    const index = families.findIndex((family) => !family);
    throw new Error(`${documents[index]?.name || "File"}: unsupported merge format.`);
  }
  if (families.some((family) => family !== families[0])) {
    throw new Error("Merge files must belong to the same family: text, JSON/JSONC, or JSONL/NDJSON.");
  }
  if (families[0] === "json") return mergeJsonDocuments(documents);
  if (families[0] === "jsonl") return mergeJsonlDocuments(documents);
  return mergeTextDocuments(documents);
}
