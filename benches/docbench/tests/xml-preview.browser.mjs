import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";

const portable = (await readFile(new URL("../public/portable.html", import.meta.url), "utf8"))
  .replace("<body>", "<body><script>globalThis.showSaveFilePicker = undefined;</script>");
const harness = `<!doctype html><html data-result="pending"><body>
<iframe id="app" src="/app" width="320" height="720"></iframe>
<script>
const frame = document.getElementById("app");
frame.addEventListener("load", async () => {
  try {
    const doc = frame.contentDocument;
    const editor = doc.getElementById("editor");
    const format = doc.getElementById("format-select");
    const preview = doc.getElementById("preview");
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    doc.getElementById("document-tab").click();
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
    find.value = "a.";
    find.dispatchEvent(new frame.contentWindow.Event("input", { bubbles: true }));
    doc.getElementById("find-next").click();
    if (editor.selectionStart !== 0 || editor.selectionEnd !== 2) throw Error("Find did not select the exact match");
    doc.getElementById("find-match-case").click();
    doc.getElementById("replace-value").value = "$&";
    doc.getElementById("replace-all").click();
    if (editor.value !== "$& b A. c $&") throw Error("Replace all lost case or literal replacement");
    doc.getElementById("undo-button").click();
    if (editor.value !== "a. b A. c a.") throw Error("Replace all was not a single undo step");

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
