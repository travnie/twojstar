// Read-only folder projection over a bounded ZIP central-directory index.
export const ZIP_TREE_LIMITS = Object.freeze({ maxEntries: 2000, maxDepth: 20, maxPathChars: 2048 });

export function createZipTree(entries) {
  if (!Array.isArray(entries) || entries.length > ZIP_TREE_LIMITS.maxEntries) {
    throw new Error("ZIP tree entry limit exceeded.");
  }
  const root = { name: "", path: "", parent: null, folders: new Map(), files: new Map() };
  const foldersByPath = new Map([["", root]]);
  let skipped = 0;
  let indexedFiles = 0;

  for (const entry of entries) {
    if (!entry?.safe || typeof entry.name !== "string" || !entry.name
      || entry.name.length > ZIP_TREE_LIMITS.maxPathChars) {
      skipped += 1;
      continue;
    }
    const normalized = entry.name.replaceAll("\\", "/");
    const isDirectory = Boolean(entry.directory || normalized.endsWith("/"));
    const value = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
    const parts = value.split("/");
    if (parts.length > ZIP_TREE_LIMITS.maxDepth
      || parts.some((part) => !part || part === "." || part === ".."
        || /[\p{Bidi_Control}\u200b-\u200d\u2060\ufeff]/u.test(part))) {
      skipped += 1;
      continue;
    }

    let current = root;
    let conflict = false;
    const count = isDirectory ? parts.length : parts.length - 1;
    for (let i = 0; i < count; i += 1) {
      const segment = parts[i];
      const key = segment.normalize("NFC").toLowerCase();
      if (current.files.has(key)) { conflict = true; break; }
      let child = current.folders.get(key);
      if (child && child.name !== segment) { conflict = true; break; }
      if (!child) {
        const path = current.path ? current.path + "/" + segment : segment;
        child = { name: segment, path, parent: current, folders: new Map(), files: new Map() };
        current.folders.set(key, child);
        foldersByPath.set(path, child);
      }
      current = child;
    }
    if (conflict) { skipped += 1; continue; }
    if (isDirectory) continue;
    const leaf = parts.at(-1);
    const key = leaf.normalize("NFC").toLowerCase();
    if (current.folders.has(key) || current.files.has(key)) {
      skipped += 1;
      continue;
    }
    current.files.set(key, Object.freeze({
      name: leaf, path: current.path ? current.path + "/" + leaf : leaf,
      originalSize: entry.originalSize, compressedSize: entry.compressedSize,
      method: entry.method, encrypted: Boolean(entry.encrypted),
      zip64: Boolean(entry.zip64),
    }));
    indexedFiles += 1;
  }

  const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, {
    sensitivity: "base", numeric: true,
  });
  return Object.freeze({
    total: entries.length,
    indexedFiles,
    skipped,
    list(path = "") {
      const current = foldersByPath.get(path);
      if (!current) return null;
      return Object.freeze({
        path: current.path,
        parentPath: current.parent?.path ?? null,
        folders: Object.freeze([...current.folders.values()]
          .map((folder) => Object.freeze({ name: folder.name, path: folder.path }))
          .sort(sortByName)),
        files: Object.freeze([...current.files.values()].sort(sortByName)),
      });
    },
  });
}
