"use strict";

(() => {
  const byId = (id) => document.getElementById(id);
  const workspace = byId("document-workspace");
  const editor = byId("editor");
  const panel = byId("document-find");
  const toggle = byId("find-toggle");
  const query = byId("find-query");
  const replacement = byId("replace-value");
  const matchCase = byId("find-match-case");
  const previous = byId("find-previous");
  const next = byId("find-next");
  const replaceOne = byId("replace-one");
  const replaceAll = byId("replace-all");
  const status = byId("find-status");
  const highlight = byId("editor-match-highlight");
  const highlightRects = highlight.firstElementChild;
  const wrap = byId("wrap-editor-button");
  const history = globalThis.DocBenchDocumentHistory;
  let lastText = editor.value;

  function searchPattern() {
    if (!query.value) return null;
    // Escape all regex operators. Search the complete query as literal text.
    const literal = query.value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
    return new RegExp(literal, matchCase.checked ? "gu" : "giu");
  }

  function refresh() {
    clearHighlight();
    if (panel.hidden) return;
    const pattern = searchPattern();
    const found = pattern?.test(editor.value);
    for (const button of [previous, next, replaceOne, replaceAll]) button.disabled = !found;
    status.textContent = pattern && !found ? "No matches" : "";
  }

  function refreshDocument() {
    if (lastText === editor.value) return;
    lastText = editor.value;
    refresh();
  }

  function clearHighlight() {
    highlight.hidden = true;
  }

  function syncHighlightScroll() {
    if (!highlight.hidden) {
      highlightRects.style.transform = "translate(" + -editor.scrollLeft + "px, " + -editor.scrollTop + "px)";
    }
  }

  function setFindOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) {
      clearHighlight();
      toggle.focus();
      return;
    }
    const selected = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (selected && !selected.includes("\n") && selected.length <= 200) query.value = selected;
    refresh();
    query.focus();
    query.select();
  }

  function findMatch(pattern, backwards) {
    const text = editor.value;
    if (!backwards) {
      pattern.lastIndex = editor.selectionEnd;
      const match = pattern.exec(text);
      if (match) return match;
      pattern.lastIndex = 0;
      return pattern.exec(text);
    }

    let last = null;
    for (const match of text.matchAll(pattern)) {
      if (last && match.index >= editor.selectionStart && last.index < editor.selectionStart) break;
      last = match;
    }
    return last;
  }

  function revealMatch(match) {
    const start = match.index;
    editor.setSelectionRange(start, start + match[0].length);

    // Match the textarea's wrap geometry without moving its selection.
    const probe = document.createElement("div");
    probe.className = "editor-position-probe";
    probe.setAttribute("aria-hidden", "true");
    const style = getComputedStyle(editor);
    for (const property of [
      "direction", "font", "letterSpacing", "overflowWrap", "padding", "tabSize",
      "textAlign", "textIndent", "whiteSpace", "wordBreak", "wordSpacing",
    ]) {
      probe.style[property] = style[property];
    }
    probe.style.width = editor.clientWidth + "px";
    const marker = document.createElement("span");
    marker.textContent = match[0];
    const end = start + match[0].length;
    const lineEnd = editor.value.indexOf("\n", end);
    probe.append(
      editor.value.slice(0, start),
      marker,
      editor.value.slice(end, lineEnd < 0 ? undefined : lineEnd),
    );
    editor.parentElement.append(probe);
    const origin = probe.getBoundingClientRect();
    const rects = [...marker.getClientRects()].map((rect) => ({
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    }));
    probe.remove();
    if (!rects.length) return;
    const { left, top, height } = rects[0];
    if (top < editor.scrollTop || top + height > editor.scrollTop + editor.clientHeight) {
      editor.scrollTop = top - editor.clientHeight / 3;
    }
    if (left < editor.scrollLeft || left > editor.scrollLeft + editor.clientWidth - 20) {
      editor.scrollLeft = left - editor.clientWidth / 3;
    }
    const pageY = editor.getBoundingClientRect().top + top - editor.scrollTop;
    const viewportHeight = document.documentElement.clientHeight;
    if (pageY < 0 || pageY + height > viewportHeight) {
      window.scrollBy(0, pageY - viewportHeight * 0.6);
    }

    highlightRects.replaceChildren(...rects.map((rect) => {
      const box = document.createElement("span");
      for (const property of ["left", "top", "width", "height"]) {
        box.style[property] = rect[property] + "px";
      }
      return box;
    }));
    highlight.style.width = editor.clientWidth + "px";
    highlight.style.height = editor.clientHeight + "px";
    highlight.hidden = false;
    syncHighlightScroll();
  }

  function navigate(backwards) {
    const pattern = searchPattern();
    const match = pattern && findMatch(pattern, backwards);
    if (match) revealMatch(match);
  }

  function applyReplacement(start, end, text, caret = start + text.length) {
    if (editor.value.slice(start, end) === text) {
      editor.setSelectionRange(caret, caret);
      clearHighlight();
      return false;
    }
    const scrollTop = editor.scrollTop;
    const scrollLeft = editor.scrollLeft;
    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertReplacementText" }));
    editor.setRangeText(text, start, end, "end");
    editor.setSelectionRange(caret, caret);
    editor.scrollTop = scrollTop;
    editor.scrollLeft = scrollLeft;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
    return true;
  }

  previous.addEventListener("click", () => navigate(true));
  next.addEventListener("click", () => navigate(false));
  replaceOne.addEventListener("click", () => {
    const pattern = searchPattern();
    if (!pattern) return;
    pattern.lastIndex = editor.selectionStart;
    const match = pattern.exec(editor.value);
    if (match?.index !== editor.selectionStart
      || match.index + match[0].length !== editor.selectionEnd) {
      navigate(false);
      return;
    }
    if (highlight.hidden) {
      revealMatch(match);
      return;
    }
    const changed = applyReplacement(match.index, match.index + match[0].length, replacement.value);
    navigate(false);
    status.textContent = changed ? "Replaced 1 match" : "Match already has that text";
  });
  replaceAll.addEventListener("click", () => {
    const pattern = searchPattern();
    if (!pattern) return;
    let count = 0;
    const source = editor.value;
    const replacementText = replacement.value;
    const caret = editor.selectionStart;
    let nextCaret = caret;
    const value = source.replace(pattern, (match, offset) => {
      if (match === replacementText) return match;
      count += 1;
      if (offset < caret) nextCaret += replacementText.length - Math.min(match.length, caret - offset);
      return replacementText;
    });
    if (!count) {
      status.textContent = "No text changed";
      return;
    }
    if (!history.canRecordEdit(value.length)
      && !globalThis.confirm("Replace all matches? This change is too large to undo.")) return;
    applyReplacement(0, source.length, value, nextCaret);
    status.textContent = count === 1 ? "Replaced 1 match" : "Replaced " + count + " matches";
  });

  toggle.addEventListener("click", () => setFindOpen(panel.hidden));
  byId("find-close").addEventListener("click", () => setFindOpen(false));
  query.addEventListener("input", refresh);
  matchCase.addEventListener("change", refresh);
  history.subscribe(refreshDocument);
  editor.addEventListener("input", refreshDocument);
  editor.addEventListener("scroll", syncHighlightScroll);
  editor.addEventListener("focus", clearHighlight);
  window.addEventListener("resize", clearHighlight);
  wrap.addEventListener("click", () => {
    const wrapping = !editor.classList.toggle("editor-no-wrap");
    wrap.setAttribute("aria-pressed", String(wrapping));
    clearHighlight();
  });
  query.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    navigate(event.shiftKey);
  });
  document.addEventListener("keydown", (event) => {
    if (workspace.hidden || event.defaultPrevented || event.isComposing) return;
    if (!event.altKey && !event.shiftKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFindOpen(true);
    } else if (!panel.hidden && event.key === "Escape" && (event.target === editor || panel.contains(event.target))) {
      event.preventDefault();
      setFindOpen(false);
    }
  });
})();
