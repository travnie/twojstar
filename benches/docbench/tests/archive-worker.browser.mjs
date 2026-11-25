import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { promisify } from "node:util";
import worker from "../src/index.ts";
import { sevenzFixture, sevenzEdgeFixtures, rarFixtures } from "./archive-fixture.mjs";

const harness = `<!doctype html><html data-result="pending"><body>
<img src="/test-pending" alt="" hidden>
<script type="module">
import { runWasmArchiveJob } from "/archive-engine.mjs";
const blob = value => new Blob([Uint8Array.from(atob(value), c => c.charCodeAt(0))]);
const check = (condition, message) => { if (!condition) throw Error(message); };
const rejected = async action => {
  try { await action(); } catch { return; }
  throw Error("Invalid archive was accepted");
};
try {
  const zip = blob("${sevenzFixture}");
  const { entries } = await runWasmArchiveJob(zip, "list");
  const hello = entries.find(entry => entry.name === "folder/hello.txt");
  check(hello, "Missing 7z member");
  check(new TextDecoder().decode(await runWasmArchiveJob(zip, "extract", { entry: hello })) === "hello Docbench\\n", "Hosted 7z extraction failed");
  const mixed = blob("${sevenzEdgeFixtures.mixed}");
  const index = (await runWasmArchiveJob(mixed, "list")).entries;
  const output = await runWasmArchiveJob(mixed, "extractAll", { entries: index });
  check(output[index.find(entry => entry.name === "empty-dir").index] === null, "Directory missing");
  check(output[index.find(entry => entry.name === "empty.txt").index].length === 0, "Empty file missing");
  const rar = blob("${rarFixtures[2].base64}");
  await rejected(() => runWasmArchiveJob(rar, "list", { password: "wrong-password" }));
  const password = "password";
  const members = (await runWasmArchiveJob(rar, "list", { password })).entries;
  const decoded = await runWasmArchiveJob(rar, "extractAll", { entries: members, password });
  check(decoded.length === 2 && decoded.every(data => data.length === 2048), "Hosted encrypted RAR batch failed");
  const corrupt = blob("${sevenzEdgeFixtures.corrupt}");
  const bad = (await runWasmArchiveJob(corrupt, "list")).entries;
  await rejected(() => runWasmArchiveJob(corrupt, "extractAll", { entries: bad }));
  document.documentElement.dataset.result = "passed";
} catch (error) {
  document.documentElement.dataset.result = "failed";
  document.body.append(String(error));
} finally {
  void fetch("/test-finished", { method: "POST" });
}
</script></body></html>`;

const assets = new Map([
  ["/", ["text/html; charset=utf-8", harness]],
  ...await Promise.all([
    "/archive-engine.mjs", "/archive-7zip-core.mjs", "/archive-worker.mjs",
    "/vendor/sevenzip/sevenzip-wasm.mjs", "/vendor/sevenzip/sevenzip-wasm.wasm",
  ].map(async path => [path, [path.endsWith(".wasm") ? "application/wasm" : "application/javascript",
    await readFile(new URL("../public" + path, import.meta.url))]])),
]);
let pending;
let finished = false;
const server = createServer(async (req, res) => {
  if (req.url === "/test-pending") {
    if (finished) res.writeHead(204).end();
    else pending = res;
    return;
  }
  if (req.url === "/test-finished") {
    finished = true;
    pending?.writeHead(204).end();
    res.writeHead(204).end();
    return;
  }
  try {
    const response = await worker.fetch(new Request("http://127.0.0.1" + req.url), {
      ASSETS: { fetch: async request => {
        const asset = assets.get(new URL(request.url).pathname);
        return asset ? new Response(asset[1], { headers: { "content-type": asset[0] } }) : new Response(null, { status: 404 });
      } },
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500).end();
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const { port } = server.address();
  const { stdout } = await promisify(execFile)("google-chrome", [
    "--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--timeout=20000", "--dump-dom", "http://127.0.0.1:" + port + "/",
  ], { timeout: 90000, maxBuffer: 2 * 1024 * 1024 });
  assert.match(stdout, /<html data-result="passed">/, stdout.slice(-2000));
} finally {
  await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
}
