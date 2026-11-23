import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";

const portable = (await readFile(new URL("../public/portable.html", import.meta.url), "utf8"))
  .replace("<body>", "<body><script>globalThis.showSaveFilePicker = undefined;</script>");
const harness = `<!doctype html><html data-result="pending"><body>
<iframe id="app" src="/app" width="320" height="460"></iframe>
<script>
const frame = document.getElementById("app");
frame.addEventListener("load", async () => {
  try {
    const doc = frame.contentDocument;
    const editor = doc.getElementById("editor");
    const format = doc.getElementById("format-select");
    const preview = doc.getElementById("preview");
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const win = frame.contentWindow;
    const inspect = doc.getElementById("files-inspect-open");
    const inspector = doc.getElementById("files-inspector");
    const sheet = doc.getElementById("files-inspector-sheet");
    const closeInspector = doc.getElementById("files-inspect-close");
    const inspectionStatus = doc.getElementById("files-status");
    if (!inspect.disabled || inspector.parentElement !== sheet) throw Error("Mobile inspector not initialized");
    if (!inspectionStatus.closest("#files-preview-summary")) throw Error("Inspection status hidden behind closed sheet");
    const fixture = new win.File(["sample"], "notes.txt", { type: "text/plain" });
    const virtualPath = "long-folder-name/".repeat(38) + fixture.name;
    Object.defineProperty(fixture, "webkitRelativePath", { value: virtualPath });
    const imported = win.DocBenchFiles.importFile(fixture);
    if (!imported.ok) throw Error("Could not import mobile inspector fixture");
    const tool = doc.getElementById("files-open-tool");
    for (let i = 0; i < 30 && tool.hidden; i++) await wait(40);
    inspect.click();
    if (!sheet.open || doc.activeElement !== closeInspector
      || !sheet.textContent.includes("notes.txt")
      || !sheet.contains(inspectionStatus)
      || Math.abs(sheet.getBoundingClientRect().bottom - win.innerHeight) > 1) {
      throw Error("File details did not open at the bottom with the active file's metadata");
    }
    if (!sheet.querySelector("#files-metadata").textContent.includes(virtualPath)) {
      throw Error("Full path missing from displayed metadata");
    }
    tool.scrollIntoView({ block: "center" });
    const box = tool.getBoundingClientRect();
    if (doc.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) !== tool) {
      throw Error("File details header overlaps the text tool action");
    }
    closeInspector.click();
    if (sheet.open || doc.activeElement !== inspect) throw Error("Closing file details did not restore focus");

    inspect.click();
    const documentWorkspace = doc.getElementById("document-workspace");
    if (!sheet.open || tool.disabled || tool.hidden) throw Error("Text tool unavailable after resizing back to mobile");
    const loaded = new Promise(resolve => {
      doc.addEventListener("docbench:open-document-file", (event) => {
        queueMicrotask(() => resolve(event.detail.openPromise));
      }, { once: true });
    });
    let sheetOpenAtActivation;
    doc.addEventListener("docbench:activate-workspace", () => {
      sheetOpenAtActivation = sheet.open;
    }, { once: true });
    tool.click();
    const result = await loaded;
    if (!result?.ok || documentWorkspace.hidden || sheetOpenAtActivation !== false || editor.value !== "sample") {
      throw Error("File details could not hand off to Text editor: " + JSON.stringify({
        result, workspaceHidden: documentWorkspace.hidden, sheetOpenAtActivation, text: editor.value,
      }));
    }
    format.value = "xml";
    editor.value = '<root attr="&quot;"><script xmlns="http://www.w3.org/1999/xhtml">globalThis.xmlProbeExecuted=true;<\\/script><![CDATA[<img src=x onerror="globalThis.xmlProbeExecuted=true">]]>&amp;</root>';
    format.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
    editor.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    for (let i = 0; i < 50 && !preview.querySelector(".xml-node"); i++) await wait(100);
    if (!preview.querySelector(".xml-node")) throw Error("XML tree missing");
    if (!preview.textContent.includes("<root>") || !preview.textContent.includes("attr=")
        || !preview.textContent.includes("<img") || !preview.textContent.includes("&")) {
      throw Error("XML source text missing");
    }
    if (preview.querySelector("script,img,svg") || frame.contentWindow.xmlProbeExecuted) {
      throw Error("XML content became active markup");
    }

    const save = doc.getElementById("save-button");
    const copy = doc.getElementById("download-button");
    if (save.textContent !== "Download" || !copy.hidden) throw Error("Duplicate Download actions");
    const more = doc.getElementById("document-more");
    more.querySelector("summary").click();
    const actions = more.querySelector(".document-more-actions").getBoundingClientRect();
    if (!more.open || actions.left < 0 || actions.right > frame.contentWindow.innerWidth) {
      throw Error("More menu clipped at 320px");
    }
    doc.getElementById("wrap-editor-button").click();
    await wait(0);
    if (more.open || frame.contentWindow.getComputedStyle(editor).whiteSpace !== "pre") {
      throw Error("Wrap toggle did not update the editor and close the menu");
    }

    editor.value = "a. b A. c a.";
    editor.setSelectionRange(0, 0);
    editor.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    doc.getElementById("find-toggle").click();
    const find = doc.getElementById("find-query");
    const setQuery = (value) => {
      find.value = value;
      find.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    };
    const enterFind = () => find.dispatchEvent(new frame.contentWindow.KeyboardEvent("keydown", {
      key: "Enter", bubbles: true, cancelable: true,
    }));
    const next = doc.getElementById("find-next");
    setQuery("a.");
    enterFind();
    if (editor.selectionStart !== 0 || editor.selectionEnd !== 2) throw Error("Find did not select the exact match");
    enterFind();
    if (doc.activeElement !== find || editor.selectionStart !== 5 || editor.value !== "a. b A. c a."
      || doc.getElementById("editor-match-highlight").hidden) {
      throw Error("Repeated Find must keep focus and reveal the next match without editing");
    }
    more.querySelector("summary").click();
    doc.getElementById("wrap-editor-button").click();
    await wait(0);
    doc.getElementById("replace-value").value = "replacement";
    doc.getElementById("replace-one").click();
    if (editor.value !== "a. b A. c a." || doc.getElementById("editor-match-highlight").hidden) {
      throw Error("Replace must reveal a hidden match again after wrapping changes");
    }
    doc.getElementById("find-match-case").click();
    doc.getElementById("replace-value").value = "$&";
    doc.getElementById("replace-all").click();
    if (editor.value !== "$& b A. c $&") throw Error("Replace all lost case or literal replacement");
    doc.getElementById("undo-button").click();
    if (editor.value !== "a. b A. c a.") throw Error("Replace all was not a single undo step");

    doc.getElementById("find-match-case").click();
    editor.setSelectionRange(0, 0);
    doc.getElementById("replace-value").value = "a.";
    doc.getElementById("replace-one").click();
    if (editor.value !== "a. b A. c a." || editor.selectionEnd !== 2) {
      throw Error("Replace must reveal an unselected match before editing");
    }
    doc.getElementById("replace-one").click();
    doc.getElementById("replace-one").click();
    if (editor.value !== "a. b a. c a.") throw Error("Replace stalled on an unchanged match");
    editor.setSelectionRange(4, 4);
    doc.getElementById("replace-value").value = "long";
    doc.getElementById("replace-all").click();
    if (editor.value !== "long b long c long" || editor.selectionStart !== 6) {
      throw Error("Replace all did not remap the caret");
    }

    format.value = "json";
    format.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
    editor.value = '{"a" : 1}';
    editor.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    setQuery('":');
    if (!next.disabled) throw Error("Unexpected match before Minify");
    doc.getElementById("minify-button").click();
    if (next.disabled) throw Error("Find did not refresh after Minify");

    const source = "<img src=x>";
    const payload = "CRC fixture";
    const zip = win.fflate.zipSync({
      "docs/readme.html": win.fflate.strToU8(source),
      "docs/corrupt.txt": [win.fflate.strToU8(payload), { level: 0 }],
    });
    // Locate the stored payload by bytes, independent of UTF-8 replacement.
    const payloadBytes = win.fflate.strToU8(payload);
    const index = zip.findIndex((byte, offset) =>
      byte === payloadBytes[0] && payloadBytes.every((value, i) => zip[offset + i] === value));
    if (index < 0) throw Error("Missing stored ZIP fixture payload");
    zip[index] ^= 1;
    const filesPreview = doc.getElementById("files-preview");
    const until = (ready) => ready() ? Promise.resolve() : new Promise(resolve => {
      const observer = new win.MutationObserver(() => {
        if (!ready()) return;
        observer.disconnect();
        resolve();
      });
      observer.observe(filesPreview, { childList: true, subtree: true, attributes: true });
    });
    const archive = win.DocBenchFiles.importFile(new win.File([zip], "preview.zip", { type: "application/zip" }));
    if (!archive.ok) throw Error("Could not import ZIP preview fixture");
    const folderSelector = 'button[aria-label="Open ZIP folder docs"]';
    await until(() => filesPreview.querySelector(folderSelector));
    filesPreview.querySelector(folderSelector).click();
    const openEntry = filesPreview.querySelector('button[aria-label="Preview entry: readme.html"]');
    const keepChecked = filesPreview.querySelector('input[aria-label="Select ZIP entry readme.html"]');
    keepChecked.click();
    openEntry.click();
    const entry = filesPreview.querySelector(".files-zip-entry-preview");
    await until(() => entry.querySelector('[role="status"]').textContent === "CRC-32 verified");
    if (entry.querySelector(".files-text").textContent !== source || entry.querySelector("img")) {
      throw Error("ZIP entry was not previewed as inert source");
    }
    entry.querySelector("button").click();
    if (!entry.hidden || !keepChecked.checked || doc.activeElement !== openEntry) {
      throw Error("Back to ZIP lost selection or focus");
    }
    filesPreview.querySelector('button[aria-label="Preview entry: corrupt.txt"]').click();
    await until(() => entry.querySelector('[role="status"]').textContent.includes("CRC-32 mismatch"));
    if (entry.querySelector(".files-zip-entry-preview-body").childElementCount) {
      throw Error("Preview published bytes from a corrupt ZIP entry");
    }

    document.documentElement.dataset.result = "passed";
  } catch (error) {
    document.documentElement.dataset.result = "failed";
    document.body.append(String(error));
  }
});
</script></body></html>`;
const server = createServer((req, res) => {
  if (req.url === "/app" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(req.url === "/app" ? portable : harness);
  } else {
    res.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const { port } = server.address();
  const { stdout } = await promisify(execFile)("google-chrome", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--virtual-time-budget=15000", "--dump-dom", "http://127.0.0.1:" + port + "/",
  ], { timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
  assert.match(stdout, /<html data-result="passed">/, stdout.slice(-2000));
} finally {
  await new Promise(resolve => server.close(resolve));
}
