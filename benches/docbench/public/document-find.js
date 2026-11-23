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

  function searchPattern() {
    if (!query.value) return null;
    const literal = query.value.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");
    return new RegExp(literal, matchCase.checked ? "gu" : "giu");
  }

  function refresh() {
    if (panel.hidden) return;
    const pattern = searchPattern();
    const found = pattern?.test(editor.value);
    for (const button of [previous, next, replaceOne, replaceAll]) button.disabled = !found;
    status.textContent = pattern && !found ? "No matches" : "";
  }

  function setFindOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) {
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
    editor.focus({ preventScroll: true });
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
    marker.textContent = String.fromCodePoint(editor.value.codePointAt(start));
    const lineEnd = editor.value.indexOf("\n", start);
    probe.append(
      editor.value.slice(0, start),
      marker,
      editor.value.slice(start + marker.textContent.length, lineEnd < 0 ? undefined : lineEnd),
    );
    editor.parentElement.append(probe);
    const { offsetTop: top, offsetLeft: left } = marker;
    probe.remove();
    const lineHeight = Number.parseFloat(style.lineHeight);
    if (top < editor.scrollTop || top + lineHeight > editor.scrollTop + editor.clientHeight) {
      editor.scrollTop = top - editor.clientHeight / 3;
    }
    if (left < editor.scrollLeft || left > editor.scrollLeft + editor.clientWidth - 20) {
      editor.scrollLeft = left - editor.clientWidth / 3;
    }
    const pageY = editor.getBoundingClientRect().top + top - editor.scrollTop;
    const viewportHeight = document.documentElement.clientHeight;
    if (pageY < 0 || pageY + lineHeight > viewportHeight) {
      window.scrollBy(0, pageY - viewportHeight * 0.6);
    }
  }

  function navigate(backwards) {
    const pattern = searchPattern();
    const match = pattern && findMatch(pattern, backwards);
    if (match) revealMatch(match);
  }

  function applyReplacement(start, end, text, caret = start + text.length) {
    if (editor.value.slice(start, end) === text) return;
    const scrollTop = editor.scrollTop;
    const scrollLeft = editor.scrollLeft;
    editor.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertReplacementText" }));
    editor.setRangeText(text, start, end, "end");
    editor.setSelectionRange(caret, caret);
    editor.scrollTop = scrollTop;
    editor.scrollLeft = scrollLeft;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
  }

  previous.addEventListener("click", () => navigate(true));
  next.addEventListener("click", () => navigate(false));
  replaceOne.addEventListener("click", () => {
    const pattern = searchPattern();
    if (!pattern) return;
    pattern.lastIndex = editor.selectionStart;
    const candidate = pattern.exec(editor.value);
    const match = candidate?.index === editor.selectionStart
        && candidate.index + candidate[0].length === editor.selectionEnd
      ? candidate
      : findMatch(pattern, false);
    if (!match) return;
    applyReplacement(match.index, match.index + match[0].length, replacement.value);
    status.textContent = "Replaced 1 match";
  });
  replaceAll.addEventListener("click", () => {
    const pattern = searchPattern();
    if (!pattern) return;
    let count = 0;
    const source = editor.value;
    const value = source.replace(pattern, () => {
      count += 1;
      return replacement.value;
    });
    if (!count) return;
    applyReplacement(0, source.length, value, editor.selectionStart);
    status.textContent = count === 1 ? "Replaced 1 match" : "Replaced " + count + " matches";
  });

  toggle.addEventListener("click", () => setFindOpen(panel.hidden));
  byId("find-close").addEventListener("click", () => setFindOpen(false));
  query.addEventListener("input", refresh);
  matchCase.addEventListener("change", refresh);
  editor.addEventListener("input", refresh);
  document.addEventListener("docbench:document-change", refresh);
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
