"use strict";

(() => {
  const editor = document.querySelector("#editor");
  const workspace = document.querySelector("#document-workspace");
  const format = document.querySelector("#format-select");
  const eol = document.querySelector("#eol-select");
  const filename = document.querySelector("#filename-label");
  const undoButton = document.querySelector("#undo-button");
  const redoButton = document.querySelector("#redo-button");
  const history = globalThis.DocBenchHistoryCore.createHistory();
  let restoring = false;

  const snapshot = () => ({
    text: editor.value,
    format: format.value,
    eol: eol.value,
    filename: filename.textContent,
    start: editor.selectionStart,
    end: editor.selectionEnd,
    direction: editor.selectionDirection,
    scrollTop: editor.scrollTop,
  });

  function restore(entry) {
    if (!entry) return false;
    restoring = true;
    try {
      const formatChanged = format.value !== entry.format;
      const eolChanged = eol.value !== entry.eol;
      editor.value = entry.text;
      format.value = entry.format;
      eol.value = entry.eol;
      filename.textContent = entry.filename;

      if (formatChanged) format.dispatchEvent(new Event("change", { bubbles: true }));
      if (eolChanged) eol.dispatchEvent(new Event("change", { bubbles: true }));
      document.dispatchEvent(new CustomEvent("docbench:history-restore", {
        detail: { filename: entry.filename },
      }));
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      document.dispatchEvent(new Event("docbench:document-change"));
      editor.focus({ preventScroll: true });
      editor.setSelectionRange(entry.start, entry.end, entry.direction);
      editor.scrollTop = entry.scrollTop;
    } finally {
      restoring = false;
    }
    return true;
  }

  const performUndo = () => restore(history.undo());
  const performRedo = () => restore(history.redo());

  history.subscribe(({ canUndo, canRedo, limited }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
    const note = limited ? "History unavailable for documents above 2 million characters."
      : "Undo document edits (Ctrl/Cmd+Z)";
    undoButton.title = note;
    redoButton.title = limited ? note : "Redo document edits (Ctrl+Y or Ctrl/Cmd+Shift+Z)";
  });
  history.reset(snapshot());

  undoButton.addEventListener("click", performUndo);
  redoButton.addEventListener("click", performRedo);

  editor.addEventListener("beforeinput", (event) => {
    if (restoring) return;
    if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
      if (event.cancelable) {
        event.preventDefault();
        if (event.inputType === "historyUndo") performUndo();
        else performRedo();
      }
      return;
    }
    history.updateSelection(snapshot());
  });

  editor.addEventListener("input", (event) => {
    if (restoring) return;
    if (event.inputType === "historyUndo") {
      performUndo();
      return;
    }
    if (event.inputType === "historyRedo") {
      performRedo();
      return;
    }
    history.record(snapshot(), {
      kind: event.isTrusted && event.inputType ? event.inputType : "programmatic",
    });
  });
  editor.addEventListener("pointerup", () => history.updateSelection(snapshot()));
  editor.addEventListener("keyup", () => {
    if (!restoring) history.updateSelection(snapshot());
  });

  document.addEventListener("docbench:document-change", () => {
    if (!restoring) history.record(snapshot(), { kind: "programmatic" });
  });
  format.addEventListener("change", () => {
    if (!restoring) history.record(snapshot(), { kind: "metadata" });
  });
  eol.addEventListener("change", () => {
    if (!restoring) history.record(snapshot(), { kind: "metadata" });
  });
  filename.addEventListener("blur", () => {
    queueMicrotask(() => {
      if (!restoring) history.record(snapshot(), { kind: "metadata" });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (workspace.hidden || restoring || event.altKey || event.isComposing
      || (!event.ctrlKey && !event.metaKey)) return;
    const target = event.target;
    if (target !== editor && target?.closest?.("input, textarea, select, [contenteditable]")) return;
    const key = event.key.toLowerCase();
    const undo = key === "z" && !event.shiftKey;
    const redo = (key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey);
    if (!undo && !redo) return;
    event.preventDefault();
    if (undo) performUndo();
    else performRedo();
  }, true);

  globalThis.DocBenchDocumentHistory = Object.freeze({
    reset: () => history.reset(snapshot()),
    record: () => !restoring && history.record(snapshot(), { kind: "programmatic" }),
    status: () => history.status(),
    undo: performUndo,
    redo: performRedo,
  });
})();
