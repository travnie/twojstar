import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";

const portable = await readFile(new URL("../public/portable.html", import.meta.url));
const harness = `<!doctype html><html data-result="pending"><body>
<iframe id="app" src="/app"></iframe>
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
