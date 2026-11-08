import assert from "node:assert/strict";
import { test } from "node:test";
import { createFileStore } from "../public/file-store.mjs";

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

test("invalid relative paths never mount virtual directories", () => {
  const store = createFileStore();
  store.addFiles([file("notes.txt", 10, "../hidden/notes.txt")]);
  assert.equal(store.visible()[0].path, "notes.txt");
});
