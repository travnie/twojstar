"use strict";

(() => {
  function formatBytes(value) {
    if (!Number.isFinite(value) || value < 0) return "Unknown size";
    if (value < 1024) return String(value) + " B";
    const units = ["KiB", "MiB", "GiB", "TiB"];
    let size = value;
    let unit = -1;
    do {
      size /= 1024;
      unit += 1;
    } while (size >= 1024 && unit < units.length - 1);
    return size.toFixed(size < 10 ? 1 : 0) + " " + units[unit];
  }

  function dragHasFiles(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function bindFileDrop(element, onFiles, { activeClass = "drop-active" } = {}) {
    if (!element || typeof onFiles !== "function") {
      throw new TypeError("Expected a drop target and file handler.");
    }

    let depth = 0;
    const enter = (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      element.classList.add(activeClass);
    };
    const over = (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      element.classList.add(activeClass);
    };
    const leave = (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth = Math.max(0, depth - 1);
      if (!depth || !element.contains(event.relatedTarget)) {
        depth = 0;
        element.classList.remove(activeClass);
      }
    };
    const drop = (event) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      element.classList.remove(activeClass);
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) onFiles(files);
    };

    const listeners = [
      ["dragenter", enter], ["dragover", over],
      ["dragleave", leave], ["drop", drop],
    ];
    for (const [name, listener] of listeners) element.addEventListener(name, listener);
    return () => {
      for (const [name, listener] of listeners) element.removeEventListener(name, listener);
      element.classList.remove(activeClass);
    };
  }

  globalThis.BenchLocalFiles = Object.freeze({ formatBytes, bindFileDrop });
})();
