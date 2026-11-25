// Local 7-Zip CLI bridge; no host mount or archive-controlled filesystem writes.
import { WASM_ARCHIVE_LIMITS, normalizeArchiveMembers, wasmArchiveEntryReason, wasmArchiveBatchReason } from "./archive-engine.mjs";

const LIST_LIMIT = 4 * 1024 * 1024;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const fields = new Set([
  "Path", "Size", "Packed Size", "Folder", "Modified", "Created", "Accessed",
  "Attributes", "CRC", "Encrypted", "Method", "Block", "Solid", "Commented",
  "Split Before", "Split After", "Host OS", "Version", "Volume Index",
  "Alternate Stream", "Characteristics", "Symbolic Link", "Hard Link",
  "Copy Link", "Checksum", "NT Security", "Anti", "Comment",
]);
function numberField(value) {
  if (!/^\d+$/u.test(value ?? "")) throw new Error("Incomplete archive size.");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Archive size out of range.");
  return number;
}
export function parseSevenZipListing(source) {
  const entries = [];
  let values = new Map();
  function commit() {
    if (!values.size) return;
    if (entries.length >= WASM_ARCHIVE_LIMITS.maxMembers || !values.has("Path")
      || !values.has("Size") || !values.has("Attributes") || !values.has("Encrypted")) {
      throw new Error("Incomplete or oversized archive index.");
    }
    const name = values.get("Path");
    const attributes = values.get("Attributes");
    const mode = attributes.match(/(?:^| )([bcdlps-][rwxstST-]{9})(?:$| )/u);
    const dos = (mode ? attributes.slice(0, mode.index) : attributes).trim();
    const folder = values.get("Folder");
    const directory = folder === "+" || mode?.[1][0] === "d" || dos.includes("D");
    const special = Boolean(
      mode && !["-", "d"].includes(mode[1][0])
      || !/^[A-Z_]*$/u.test(dos) || dos.includes("L")
      || values.get("Host OS") === "Unix" && !mode
      || folder !== undefined && !["+", "-"].includes(folder)
      || folder === "-" && directory || folder === "+" && mode?.[1][0] === "-"
      || values.get("Symbolic Link") || values.get("Hard Link") || values.get("Copy Link")
      || values.get("Alternate Stream") === "+" || values.get("Anti") === "+"
    );
    if (values.get("Split Before") === "+" || values.get("Split After") === "+"
      || values.get("Volume Index")) throw new Error("Multi-volume archives are unsupported.");
    const crc = values.get("CRC") || "";
    if (crc && !/^[0-9A-F]{8}$/iu.test(crc)) throw new Error("Invalid member checksum.");
    const encrypted = values.get("Encrypted");
    if (!["+", "-"].includes(encrypted)) throw new Error("Unknown encryption metadata.");
    const size = numberField(values.get("Size"));
    if (directory && size !== 0) throw new Error("Invalid archive directory.");
    entries.push({
      index: entries.length, name, directory, special, uncompressedSize: size,
      compressedSize: values.get("Packed Size") ? numberField(values.get("Packed Size")) : -1,
      encrypted: encrypted === "+", crc: crc.toUpperCase(),
      checksum: Boolean(crc || values.get("Checksum") || /\bCRC\b/u.test(values.get("Characteristics") || "")),
    });
    values = new Map();
  }
  for (const line of source.split("\n")) {
    if (!line.trim()) { commit(); continue; }
    const separator = line.indexOf(" = ");
    const key = line.slice(0, separator);
    const value = line.slice(separator + 3);
    if (separator < 1 || !fields.has(key) || values.has(key)
      || !values.size && key !== "Path" || /[\x00-\x1f\x7f]/u.test(value)) {
      throw new Error("Ambiguous technical archive listing.");
    }
    values.set(key, value);
  }
  commit();
  return entries;
}
function archiveType(bytes) {
  if (bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc
    && bytes[3] === 0xaf && bytes[4] === 0x27 && bytes[5] === 0x1c) return "7z";
  if (bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72
    && bytes[3] === 0x21 && bytes[4] === 0x1a && bytes[5] === 7) {
    if (bytes[6] === 0) return "Rar";
    if (bytes[6] === 1 && bytes[7] === 0) return "Rar5";
  }
  throw new Error("Expected a 7z or RAR signature.");
}
function fullListing(source, type, size) {
  const marker = "\n----------\n";
  const offset = source.indexOf(marker);
  if (offset < 0 || source.indexOf(marker, offset + marker.length) >= 0) throw new Error("Ambiguous archive header.");
  const header = source.slice(0, offset);
  const property = name => header.split("\n").filter(line => line.startsWith(name + " = "))
    .map(line => line.slice(name.length + 3));
  if (property("Type").length !== 1 || property("Type")[0] !== type
    || property("Physical Size").length !== 1 || numberField(property("Physical Size")[0]) !== size
    || property("Multivolume").some(value => value !== "-")
    || property("Volumes").some(value => value !== "1")
    || property("Offset").some(value => value !== "0")
    || property("Tail Size").some(value => value !== "0")
    || property("ERROR").length || property("WARNING").length) throw new Error("Unsupported archive container.");
  return parseSevenZipListing(source.slice(offset + marker.length));
}
function sameMember(a, b) {
  return a.name === b.name && a.originalSize === b.originalSize
    && a.directory === b.directory && a.special === b.special && a.encrypted === b.encrypted
    && a.crc === b.crc && a.checksum === b.checksum;
}
export async function runSevenZipOperation(createSevenZip, bytes, operation, {
  index, password = "", wasmBinary, wasmUrl,
} = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length > WASM_ARCHIVE_LIMITS.maxInputBytes) throw new Error("Archive input limit exceeded.");
  const type = archiveType(bytes);
  const path = type === "7z" ? "/input.7z" : "/input.rar";
  let output, cursor = 0, errors = false;
  const mod = await createSevenZip({
    stdin: () => null,
    stdout: byte => {
      if (byte === null) return;
      if (!output || cursor >= output.length) throw new Error("Archive output exceeds its limit.");
      output[cursor++] = byte;
    },
    stderr: byte => { if (byte !== null && byte !== 10 && byte !== 13) errors = true; },
    ...(wasmBinary ? { wasmBinary } : {}),
    ...(wasmUrl ? { locateFile: () => wasmUrl } : {}),
  });
  mod.FS.writeFile(path, bytes);
  function command(args, capacity) {
    output = new Uint8Array(capacity);
    cursor = 0;
    errors = false;
    const status = mod.callMain([...args, "-t" + type, "-bsp0", "-sccUTF-8",
      ...(password ? ["-p" + password] : []), "--", path]);
    if (status !== 0 || errors) throw new Error("Archive decoding failed. Check password or integrity.");
    return output.subarray(0, cursor);
  }
  const raw = fullListing(textDecoder.decode(command(["l", "-slt"], LIST_LIMIT)), type, bytes.length);
  const { entries } = normalizeArchiveMembers(raw);
  if (operation === "list") return raw;
  const targets = operation === "extract" ? [entries[index]] : operation === "extractAll" ? entries : null;
  if (!targets || targets.some(entry => !entry)
    || operation === "extract" && wasmArchiveEntryReason(targets[0])
    || operation === "extractAll" && wasmArchiveBatchReason(targets)) throw new Error("Unsupported archive selection.");
  // 7-Zip normalizes some control characters when listing. Re-select exact names
  // and verify matching metadata before extracting; never write archive paths to FS.
  const selection = targets.map(entry => "-i!" + entry.name);
  const exact = normalizeArchiveMembers(parseSevenZipListing(textDecoder.decode(
    command(["l", "-slt", "-ba", "-spd", ...selection], LIST_LIMIT)))).entries;
  if (exact.length !== targets.length || exact.some((entry, i) => !sameMember(entry, targets[i]))) {
    throw new Error("Archive names or entry metadata are ambiguous.");
  }
  if (operation === "extractAll") command(["t"], LIST_LIMIT);
  const result = targets.map(entry => {
    if (entry.directory) return { name: entry.name, data: new Uint8Array(0) };
    const data = command(["x", "-so", "-bso0", "-bse2", "-spd", "-i!" + entry.name], entry.originalSize);
    if (data.length !== entry.originalSize) throw new Error("Archive entry size mismatch.");
    return { name: entry.name, data };
  });
  return operation === "extract" ? result[0] : result;
}
