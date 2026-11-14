import { parseTree } from "./vendor/jsonc-parser/impl/parser.js";

const FORMATS = new Set(["json", "jsonc", "json5", "jsonl"]);

function tree(source, comments = false) {
  const errors = [];
  const root = parseTree(source, errors, { allowTrailingComma: comments, disallowComments: !comments });
  if (!root || errors.length) throw new Error(`Invalid ${comments ? "JSONC" : "JSON"} at offset ${errors[0]?.offset ?? 0}.`);
  return root;
}

function serialize(node, source) {
  if (node.type === "array") return `[${(node.children || []).map((item) => serialize(item, source)).join(",")}]`;
  if (node.type === "object") {
    return `{${(node.children || []).map((property) => {
      const [key, value] = property.children || [];
      if (!key || !value) throw new Error("Invalid object property.");
      return `${source.slice(key.offset, key.offset + key.length)}:${serialize(value, source)}`;
    }).join(",")}}`;
  }
  return source.slice(node.offset, node.offset + node.length);
}

function finite(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (value && typeof value === "object") return Object.values(value).every(finite);
  return true;
}

function safeIntegers(value) {
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (value && typeof value === "object") return Object.values(value).every(safeIntegers);
  return true;
}

function hasDuplicateKeys(node) {
  if (node.type === "object") {
    const seen = new Set();
    for (const property of node.children || []) {
      const [key, value] = property.children || [];
      if (seen.has(key?.value)) return true;
      seen.add(key?.value);
      if (value && hasDuplicateKeys(value)) return true;
    }
  } else if (node.type === "array") {
    return (node.children || []).some(hasDuplicateKeys);
  }
  return false;
}

function json5Source(source, json5, repair) {
  if (!json5?.parse || typeof repair !== "function") throw new Error("JSON5 conversion is unavailable.");
  const original = json5.parse(source);
  if (!finite(original)) throw new Error("Infinity and NaN cannot be represented in JSON. Edit these values first.");
  let candidate;
  try {
    candidate = repair(source);
    const parsed = JSON.parse(candidate);
    if (JSON.stringify(parsed) === JSON.stringify(original)) return candidate;
  } catch { /* Unsupported JSON5 syntax. */ }
  if (!candidate || hasDuplicateKeys(tree(candidate)) || !safeIntegers(original)) {
    throw new Error("This JSON5 syntax cannot be converted safely without changing values or duplicate keys. Edit it first.");
  }
  return JSON.stringify(original);
}

export function convertJsonDocument(source, from, to, { json5, repair } = {}) {
  if (!FORMATS.has(from) || !FORMATS.has(to) || from === to) throw new Error("Choose a different JSON format.");
  if (from === "jsonl") {
    const records = source.split(/\r\n|\r|\n/).flatMap((line, index) => {
      if (!line.trim()) return [];
      try { return [serialize(tree(line), line)]; }
      catch { throw new Error(`Invalid JSONL on line ${index + 1}.`); }
    });
    return { text: `[${records.join(",")}]`, commentsRemoved: false };
  }
  const strict = from === "json5" ? json5Source(source, json5, repair) : source;
  const root = tree(strict, from === "jsonc");
  const text = to === "jsonl"
    ? (() => {
      if (root.type !== "array") throw new Error("JSONL conversion requires an array at the root.");
      return (root.children || []).map((item) => serialize(item, strict)).join("\n");
    })()
    : serialize(root, strict);
  return { text, commentsRemoved: from === "jsonc" || from === "json5" };
}
