import assert from "node:assert/strict";
import worker from "../src/index.ts";

const fetchAsset = async (path, type = "application/javascript", status = 200) => {
  const request = new Request(`https://docbench.test${path}`);
  const env = { ASSETS: { fetch: async () => new Response(status === 304 ? null : "test", {
    status, headers: { "content-type": type },
  }) } };
  return worker.fetch(request, env);
};

const html = await fetchAsset("/", "text/html");
const qpdfWorker = await fetchAsset("/vendor/qpdf-run/worker.js");
const cachedHtml = await fetchAsset("/", "text/html", 304);
const cachedHtmlWithoutType = await fetchAsset("/", "", 304);
const cachedQpdfWorker = await fetchAsset("/vendor/qpdf-run/worker.js", "application/javascript", 304);
const otherScript = await fetchAsset("/app.js");
const cachedOtherScript = await fetchAsset("/app.js", "application/javascript", 304);
const missing = await fetchAsset("/vendor/qpdf-run/worker.js", "text/html", 404);
for (const response of [html, qpdfWorker, cachedHtml, cachedHtmlWithoutType, cachedQpdfWorker]) {
  const policy = response.headers.get("content-security-policy");
  assert.match(policy, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(policy, /(?:^|\s)'unsafe-eval'/);
}
for (const response of [otherScript, cachedOtherScript, missing]) {
  assert.doesNotMatch(response.headers.get("content-security-policy"), /'wasm-unsafe-eval'/);
}
for (const response of [html, cachedHtml, cachedHtmlWithoutType]) {
  assert.match(response.headers.get("content-security-policy"), /connect-src 'self' https:/);
}
for (const response of [qpdfWorker, cachedQpdfWorker, otherScript, cachedOtherScript, missing]) {
  assert.doesNotMatch(response.headers.get("content-security-policy"), /connect-src 'self' https:/);
}
assert.match(html.headers.get("link"), /llms\.txt/);
assert.equal(otherScript.headers.get("link"), null);
console.log("Docbench security header checks passed.");

for (const method of ["GET", "HEAD"]) {
  const request = new Request("https://docbench.test/", { method, headers: { accept: "text/markdown" } });
  const response = await worker.fetch(request, { ASSETS: { fetch: async req => {
    assert.equal(new URL(req.url).pathname, "/index.md");
    return new Response("# Guide");
  } } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(response.headers.get("vary"), "Accept");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.equal(await response.text(), method === "HEAD" ? "" : "# Guide");
}
assert.equal(html.headers.get("vary"), "Accept");
