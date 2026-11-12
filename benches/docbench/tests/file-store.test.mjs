import assert from "node:assert/strict";
import { test } from "node:test";
import { createFileStore, adjacentVisibleId, importLocalFile, createFileIngress } from "../public/file-store.mjs";

function file(name, size = 4, path = "") {
  return {
    name, size, type: "text/plain", lastModified: 123,
    webkitRelativePath: path,
    slice() { return new Blob(["test"]); },
  };
}

test("virtual IDs are distinct from paths and preserve folder origin", () => {
  const store = createFileStore();
  const result = store.addFiles([
    file("same.txt", 3, "folder-a/same.txt"),
    file("same.txt", 4, "folder-b/same.txt"),
  ]);
  assert.equal(result.total, 2);
  assert.notEqual(result.ids[0], result.ids[1]);
  assert.notEqual(result.ids[0], "folder-a/same.txt");
  assert.notEqual(result.ids[1], "folder-b/same.txt");
  assert.ok(Object.isFrozen(store.get(result.ids[0])));
  assert.deepEqual(store.folders(), ["folder-a", "folder-b"]);
  assert.equal(store.get(result.ids[0]).path, "folder-a/same.txt");
  const other = createFileStore();
  assert.notEqual(result.ids[0], other.addFiles([file("same.txt")]).ids[0]);
});

test("selection is independent from preview and survives filtering", () => {
  const store = createFileStore();
  const { ids } = store.addFiles([file("a.txt"), file("b.txt"), file("c.txt")]);
  store.setSelection([ids[0], ids[2]]);
  store.setActive(ids[1]);
  assert.deepEqual(store.selectedIds(), [ids[0], ids[2]]);
  assert.equal(store.activeId(), ids[1]);
  store.choose(ids[0], { toggle: true, focus: false });
  assert.equal(store.activeId(), ids[1]);
  store.choose(ids[0], { toggle: true, focus: false });
  assert.deepEqual(store.visible({ query: "b." }).map((entry) => entry.id), [ids[1]]);
  store.remove([ids[2]]);
  assert.deepEqual(store.selectedIds(), [ids[0]]);
});

test("range selection, toggling and bounded queue", () => {
  const store = createFileStore({ limit: 3 });
  const added = store.addFiles([file("2.txt"), file("1.txt"), file("3.txt"), file("4.txt")]);
  assert.equal(added.skipped, 1);
  const visible = store.visible().map((entry) => entry.id);
  store.choose(visible[0]);
  store.choose(visible[2], { range: true, visibleIds: visible });
  assert.equal(store.selectedIds().length, 3);
  store.choose(visible[0], { toggle: true });
  assert.equal(store.selectedIds().length, 2);
  const hiddenAnchor = visible[0];
  store.choose(visible[2], { range: true, visibleIds: [visible[1], visible[2]] });
  assert.deepEqual(store.selectedIds(), [visible[2]]);
  store.choose(visible[1], { range: true, visibleIds: [visible[1], visible[2]] });
  assert.deepEqual(new Set(store.selectedIds()), new Set([visible[1], visible[2]]));
  assert.notEqual(hiddenAnchor, visible[1]);
  assert.equal(store.addFiles([file("extra.txt")]).skipped, 1);
  assert.equal(store.setSelection(["not-this-store"]), false);
});

test("agent snapshots are bounded and private by default", () => {
  const store = createFileStore();
  const { ids } = store.addFiles([file("private.txt", 5, "secret/private.txt")]);
  const minimal = store.snapshot();
  assert.equal(minimal.entries[0].name, undefined);
  assert.equal(minimal.entries[0].path, undefined);
  assert.equal(minimal.activeId, ids[0]);
  assert.equal(store.snapshot({ includeNames: true }).entries[0].path, "secret/private.txt");
  store.addFiles(Array.from({ length: 60 }, (_, index) => file("extra-" + index + ".txt")));
  const bounded = store.snapshot({ limit: 10 });
  assert.equal(bounded.entries.length, 10);
  assert.equal(bounded.truncated, true);
  assert.equal(store.snapshot({ limit: 100 }).truncated, false);
  store.clear();
  assert.equal(store.count(), 0);
});

test("preview navigation follows visible order without changing selection", () => {
  const store = createFileStore();
  const { ids } = store.addFiles([file("third.txt", 30), file("first.txt", 10), file("second.txt", 20)]);
  store.setSelection([ids[0]]);
  store.setActive(ids[1]);
  const visible = store.visible({ sort: "size" }).map((entry) => entry.id);
  assert.deepEqual(visible, [ids[1], ids[2], ids[0]]);
  assert.equal(adjacentVisibleId(visible, ids[1], 1), ids[2]);
  assert.equal(adjacentVisibleId(visible, ids[2], -1), ids[1]);
  assert.equal(adjacentVisibleId(visible, ids[0], 1), null);
  assert.equal(adjacentVisibleId(visible, ids[1], -1), null);
  assert.equal(adjacentVisibleId(visible, "stale", 1), null);
  assert.equal(adjacentVisibleId(visible, ids[1], 0), null);
  assert.equal(store.activeId(), ids[1]);
  assert.deepEqual(store.selectedIds(), [ids[0]]);
});

test("regular filenames with a backslash stay flat", () => {
  const store = createFileStore();
  store.addFiles([file("foo\\bar.txt")]);
  assert.deepEqual(store.folders(), []);
  assert.equal(store.visible()[0].path, "foo\\bar.txt");
});

test("invalid relative paths never mount virtual directories", () => {
  const store = createFileStore();
  store.addFiles([file("notes.txt", 10, "../hidden/notes.txt")]);
  assert.equal(store.visible()[0].path, "notes.txt");
});

test("embedded file ingress shares the Files queue and reveals the imported entry", () => {
  const store = createFileStore({ limit: 2 });
  let activated = 0;
  const open = (file) => importLocalFile(store, file, () => { activated++; });
  const first = open(file("report.pdf"));
  assert.equal(first.ok, true);
  assert.equal(store.get(first.id).name, "report.pdf");
  assert.equal(store.activeId(), first.id);
  assert.equal(store.snapshot().count, 1);
  assert.equal(activated, 1);
  assert.equal(open(null).ok, false);
  assert.equal(activated, 1);
  assert.equal(store.snapshot().count, 1);
  const next = open(file("recording.flac"));
  assert.equal(next.ok, true);
  assert.equal(store.activeId(), next.id);
  assert.equal(store.snapshot().count, 2);
  assert.equal(activated, 2);
  assert.equal(open(file("third.zip")).ok, false);
  assert.equal(activated, 2);
  assert.equal(store.snapshot().count, 2);
});

test("embedded ingress v1 activates Files and clears filters", () => {
  const store = createFileStore({ limit: 1 });
  const ui = { mode: "document", query: "hidden", folder: "archived" };
  let opening = true;
  const ingress = createFileIngress(store, {
    canImport: () => !opening,
    resetView: () => { ui.query = ""; ui.folder = ""; },
    activateFiles: () => { ui.mode = "files"; },
  });
  assert.equal(ingress.version, 1);
  assert.equal(ingress.importFile(file("busy.pdf")).ok, false);
  assert.equal(store.snapshot().count, 0);
  opening = false;
  assert.equal(ingress.importFile(null).ok, false);
  assert.deepEqual(ui, { mode: "document", query: "hidden", folder: "archived" });
  const accepted = ingress.importFile(file("sample.pdf"));
  assert.equal(accepted.ok, true);
  assert.equal(store.activeId(), accepted.id);
  assert.deepEqual(ui, { mode: "files", query: "", folder: "" });
  ui.mode = "pdf";
  assert.equal(ingress.importFile(file("overflow.zip")).ok, false);
  assert.equal(ui.mode, "pdf");
});
