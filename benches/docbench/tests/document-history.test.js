"use strict";

const assert = require("node:assert/strict");
require("../public/document-history-core.js");
const { createHistory } = globalThis.DocBenchHistoryCore;
const snap = (text, overrides = {}) => ({
  text, filename: "note.txt", format: "txt", eol: "LF", mixedEol: false,
  start: text.length, end: text.length, direction: "forward",
  scrollTop: 0, ...overrides,
});

const history = createHistory();
history.reset(snap("hello world"));
assert.equal(history.status().canUndo, false);
history.updateSelection(snap("hello world", { start: 11, end: 11 }));
for (let i = 10; i >= 0; i -= 1) {
  history.record(snap("hello world".slice(0, i)), {
    kind: "deleteContentBackward", now: 100 + (10 - i) * 30,
  });
}
assert.equal(history.current().text, "");
assert.equal(history.status().canUndo, true);
assert.equal(history.undo().text, "hello world", "held Backspace must undo as one action");
assert.equal(history.undo(), null);
assert.equal(history.redo().text, "");
assert.equal(history.status().canRedo, false);

history.record(snap("x"), { kind: "insertText", now: 1000 });
history.record(snap("xy"), { kind: "insertText", now: 1100 });
assert.equal(history.undo().text, "");
assert.equal(history.redo().text, "xy");
history.record(snap("xyz"), { kind: "insertText", now: 4000 });
assert.equal(history.undo().text, "xy", "edits outside the grouping window have separate checkpoints");
history.record(snap("new"), { kind: "insertFromPaste", now: 4100 });
assert.equal(history.status().canRedo, false, "new edits invalidate Redo");

history.reset(snap("{bad}", { format: "json5", eol: "CRLF", mixedEol: true }));
history.record(snap('{"valid":true}', {
  filename: "note.json", format: "json", eol: "LF", start: 3, end: 3,
}), { kind: "programmatic" });
assert.equal(history.undo().filename, "note.txt");
assert.equal(history.current().format, "json5");
assert.equal(history.current().eol, "CRLF");
assert.equal(history.current().mixedEol, true, "restore mixed line-ending warning");
assert.equal(history.redo().text, '{"valid":true}');
assert.equal(history.current().start, 3);
history.reset(snap("different file"));
assert.equal(history.undo(), null, "never undo into a previously opened file");

const limit = createHistory({ maxSteps: 3, maxTotalChars: 1_000, maxSnapshotChars: 20 });
limit.reset(snap("a"));
for (const text of ["b", "c", "d", "e", "f"]) limit.record(snap(text), { kind: "programmatic" });
let count = 0;
while (limit.undo()) count += 1;
assert.equal(count, 3, "bound history steps");
limit.reset(snap("a".repeat(21)));
assert.equal(limit.status().limited, true);
limit.record(snap("b".repeat(21)));
assert.equal(limit.undo(), null, "oversized documents must not exhaust memory");
assert.equal(limit.current().text, "b".repeat(21));

const timed = createHistory({ groupMs: 850 });
timed.reset(snap(""));
timed.record(snap("a"), { kind: "insertText", now: 100 });
timed.record(snap("ab"), { kind: "insertText", now: 200 });
timed.record(snap("abc"), { kind: "insertText", now: 1_500 });
assert.equal(timed.undo().text, "ab", "grouping timeout must split edits");
assert.equal(timed.undo().text, "", "early typing stays grouped");

const cursor = createHistory();
cursor.reset(snap("abc", { start: 3, end: 3 }));
cursor.record(snap("abcX", { start: 4, end: 4 }), { kind: "insertText", now: 100 });
cursor.updateSelection(snap("abcX", { start: 0, end: 0 }));
cursor.record(snap("YabcX", { start: 1, end: 1 }), { kind: "insertText", now: 120 });
assert.equal(cursor.undo().text, "abcX", "moving caret splits typed groups");
assert.equal(cursor.undo().text, "abc");

const budget = createHistory({ maxSteps: 10, maxTotalChars: 34, maxSnapshotChars: 20 });
budget.reset(snap("000000"));
for (const text of ["111111", "222222", "333333", "444444", "555555"]) {
  budget.record(snap(text), { kind: "programmatic" });
}
let budgetSteps = 0;
while (budget.undo()) budgetSteps += 1;
assert.equal(budgetSteps, 4, "drop oldest snapshots exceeding total character budget");

const selection = createHistory();
selection.reset(snap("abc", { start: 1, end: 2, direction: "backward", scrollTop: 120 }));
selection.record(snap("ac", { start: 1, end: 1 }), { kind: "deleteByCut" });
const original = selection.undo();
assert.equal(original.start, 1);
assert.equal(original.end, 2);
assert.equal(original.direction, "backward");
assert.equal(original.scrollTop, 120);
assert.throws(() => selection.record({ text: null }), /requires text/);

console.log("Docbench document history tests passed.");
