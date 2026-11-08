// Canonical local-only virtual file queue; never reads file bytes on insertion.
let storeSerial = 0;
export function createFileStore({ limit = 100 } = {}) {
  const mountId = "local-" + ++storeSerial;
  const entries = new Map();
  const selected = new Set();
  const listeners = new Set();
  let serial = 0;
  let activeId = null;
  let anchorId = null;
  const notify = () => { for (const listener of listeners) listener(); };
  const owns = (id) => typeof id === "string" && entries.has(id);
  const details = (entry) => ({
    id: entry.id, mountId: entry.mountId, name: entry.name,
    path: entry.path, folder: entry.folder, size: entry.size,
    type: entry.type, modified: entry.modified, source: entry.source,
    selected: selected.has(entry.id), active: activeId === entry.id,
  });
  function normalizedPath(file) {
    const raw = String(file.webkitRelativePath || file.name || "");
    const value = file.webkitRelativePath ? raw.replaceAll("\\", "/") : raw;
    const parts = value.split("/");
    if (!value || value.length > 2048 || value.startsWith("/")
      || /^[a-z]:/iu.test(value) || parts.some((part) => !part || part === ".." || part === "."
        || [...part].some((char) => char.charCodeAt(0) < 32))) {
      return String(file.name || "unnamed");
    }
    return value;
  }
  function addFiles(input) {
    const incoming = Array.from(input || []).filter((file) =>
      file && typeof file.slice === "function" && Number.isSafeInteger(file.size)
        && file.size >= 0);
    const accepted = incoming.slice(0, Math.max(0, limit - entries.size));
    const ids = [];
    for (const file of accepted) {
      const path = normalizedPath(file);
      const id = mountId + ":" + ++serial;
      const slash = path.lastIndexOf("/");
      entries.set(id, {
        id, mountId, file, name: file.name || "unnamed", path,
        folder: slash >= 0 ? path.slice(0, slash) : "",
        type: file.type || "", size: file.size,
        modified: Number.isFinite(file.lastModified) ? file.lastModified : 0,
        source: file.webkitRelativePath ? "folder" : "file",
      });
      ids.push(id);
    }
    if (ids.length) {
      activeId = ids[0];
      anchorId = ids[0];
      selected.clear();
      selected.add(ids[0]);
      notify();
    }
    return { ids, skipped: incoming.length - ids.length, total: entries.size };
  }
  function visible({ query = "", folder = "", sort = "name", descending = false } = {}) {
    const needle = String(query).toLocaleLowerCase();
    return [...entries.values()].filter((entry) =>
      (!folder || entry.folder === folder)
      && (!needle || entry.path.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => {
        let value = 0;
        if (sort === "size") value = a.size - b.size;
        else if (sort === "modified") value = a.modified - b.modified;
        else if (sort === "type") value = a.type.localeCompare(b.type);
        else value = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
        return (descending ? -1 : 1) * value || a.id.localeCompare(b.id);
      }).map(details);
  }
  function setActive(id) {
    if (id !== null && !owns(id)) return false;
    activeId = id;
    if (id) anchorId = id;
    notify();
    return true;
  }
  function setSelection(ids) {
    if (!Array.isArray(ids) || ids.length > limit || ids.some((id) => !owns(id))) return false;
    selected.clear();
    for (const id of ids) selected.add(id);
    anchorId = ids.at(-1) || null;
    notify();
    return true;
  }
  function choose(id, { toggle = false, range = false, visibleIds = [], focus = true } = {}) {
    if (!owns(id)) return false;
    if (range && owns(anchorId)) {
      const a = visibleIds.indexOf(anchorId);
      const b = visibleIds.indexOf(id);
      if (a >= 0 && b >= 0) {
        if (!toggle) selected.clear();
        for (const candidate of visibleIds.slice(Math.min(a, b), Math.max(a, b) + 1)) {
          if (owns(candidate)) selected.add(candidate);
        }
      } else {
        selected.clear();
        selected.add(id);
        anchorId = id;
      }
    } else if (toggle) {
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      anchorId = id;
    } else {
      selected.clear();
      selected.add(id);
      anchorId = id;
    }
    if (focus) activeId = id;
    notify();
    return true;
  }
  function remove(ids) {
    if (!Array.isArray(ids) || ids.some((id) => !owns(id))) return false;
    for (const id of ids) {
      entries.delete(id);
      selected.delete(id);
      if (activeId === id) activeId = null;
      if (anchorId === id) anchorId = null;
    }
    if (!activeId) activeId = entries.keys().next().value || null;
    notify();
    return true;
  }
  function clear() {
    entries.clear();
    selected.clear();
    activeId = null;
    anchorId = null;
    notify();
  }
  function snapshot({ includeNames = false, limit: max = 50 } = {}) {
    const count = Math.min(100, Math.max(1, Math.floor(max) || 50));
    const all = [...entries.values()];
    return {
      count: all.length, selectedIds: [...selected], activeId,
      truncated: all.length > count,
      entries: all.slice(0, count).map((entry) => includeNames ? details(entry) : ({
        id: entry.id, mountId: entry.mountId, size: entry.size,
        type: entry.type, source: entry.source,
        selected: selected.has(entry.id), active: activeId === entry.id,
      })),
    };
  }
  return Object.freeze({
    addFiles, visible, choose, setSelection, setActive, remove, clear, snapshot,
    get: (id) => {
      const entry = entries.get(id);
      return entry ? Object.freeze({ ...entry }) : null;
    },
    selectedIds: () => [...selected],
    activeId: () => activeId,
    count: () => entries.size,
    folders: () => [...new Set([...entries.values()].map((entry) => entry.folder)
      .filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    subscribe(callback) {
      if (typeof callback !== "function") throw new TypeError("Expected listener.");
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  });
}
