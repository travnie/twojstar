"use strict";

(() => {
  // Bounded in-memory snapshots. No disk writes, uploads, or cross-document history.
  function createHistory({ maxSteps = 40, maxTotalChars = 8_000_000,
    maxSnapshotChars = 2_000_000, groupMs = 850 } = {}) {
    const past = [];
    const future = [];
    const listeners = new Set();
    const groupedTypes = new Set([
      "insertText", "insertCompositionText", "deleteContentBackward", "deleteContentForward",
    ]);
    let current = null;
    let lastKind = null;
    let lastTime = 0;

    const normalize = (value) => {
      if (!value || typeof value.text !== "string") {
        throw new TypeError("Document snapshot requires text.");
      }
      const length = value.text.length;
      const position = (offset, fallback = length) => Math.min(length, Math.max(0,
        Number.isSafeInteger(offset) ? offset : fallback));
      return Object.freeze({
        text: value.text,
        format: String(value.format || "txt"),
        eol: String(value.eol || "LF"),
        filename: String(value.filename || "untitled.txt"),
        start: position(value.start),
        end: position(value.end),
        direction: value.direction === "backward" ? "backward" : "forward",
        scrollTop: Number.isFinite(value.scrollTop) ? Math.max(0, value.scrollTop) : 0,
      });
    };

    const sameContent = (a, b) => a.text === b.text && a.format === b.format
      && a.eol === b.eol && a.filename === b.filename;
    const notify = () => {
      const state = { canUndo: past.length > 0, canRedo: future.length > 0,
        limited: Boolean(current && current.text.length > maxSnapshotChars) };
      for (const listener of listeners) listener(state);
    };
    const trim = () => {
      let total = current.text.length;
      for (const entry of past) total += entry.text.length;
      for (const entry of future) total += entry.text.length;
      while (past.length > maxSteps || (total > maxTotalChars && past.length)) {
        total -= past.shift().text.length;
      }
      while (future.length > maxSteps || (total > maxTotalChars && future.length)) {
        total -= future.shift().text.length;
      }
    };

    function reset(snapshot) {
      current = normalize(snapshot);
      past.length = 0;
      future.length = 0;
      lastKind = null;
      lastTime = 0;
      notify();
      return current;
    }

    function updateSelection(snapshot) {
      const next = normalize(snapshot);
      if (current && sameContent(current, next)) current = next;
    }

    function record(snapshot, { kind = "programmatic", now = Date.now() } = {}) {
      const next = normalize(snapshot);
      if (!current) return reset(next);
      if (sameContent(current, next)) {
        current = next;
        return false;
      }
      if (current.text.length > maxSnapshotChars || next.text.length > maxSnapshotChars) {
        reset(next);
        return false;
      }

      const group = groupedTypes.has(kind) && kind === lastKind && past.length > 0
        && future.length === 0 && now >= lastTime && now - lastTime <= groupMs
        && current.filename === next.filename && current.format === next.format
        && current.eol === next.eol;
      if (!group) past.push(current);
      future.length = 0;
      current = next;
      lastKind = groupedTypes.has(kind) ? kind : null;
      lastTime = now;
      trim();
      notify();
      return true;
    }

    function undo() {
      if (!past.length) return null;
      future.push(current);
      current = past.pop();
      lastKind = null;
      trim();
      notify();
      return current;
    }

    function redo() {
      if (!future.length) return null;
      past.push(current);
      current = future.pop();
      lastKind = null;
      trim();
      notify();
      return current;
    }

    return Object.freeze({
      record, reset, undo, redo, updateSelection,
      current: () => current,
      status: () => Object.freeze({
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        limited: Boolean(current && current.text.length > maxSnapshotChars),
      }),
      subscribe(listener) {
        if (typeof listener !== "function") throw new TypeError("Expected history listener.");
        listeners.add(listener);
        listener(this.status());
        return () => listeners.delete(listener);
      },
    });
  }

  globalThis.DocBenchHistoryCore = Object.freeze({ createHistory });
})();
