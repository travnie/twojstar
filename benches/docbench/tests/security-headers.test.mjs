import assert from "node:assert/strict";
import worker from "../src/index.ts";

const fetchAsset = async (path, type = "application/javascript", status = 200) => {
  const request = new Request(`https://docbench.test${path}`);
  const env = { ASSETS: { fetch: async () => new Response("test", {
    status, headers: { "content-type": type },
  }) } };
  return worker.fetch(request, env);
};

const html = await fetchAsset("/", "text/html");
const qpdfWorker = await fetchAsset("/vendor/qpdf-run/worker.js");
const otherScript = await fetchAsset("/app.js");
const missing = await fetchAsset("/vendor/qpdf-run/worker.js", "text/html", 404);
for (const response of [html, qpdfWorker]) {
  const policy = response.headers.get("content-security-policy");
  assert.match(policy, /'wasm-unsafe-eval'/);
  assert.doesNotMatch(policy, /(?:^|\s)'unsafe-eval'/);
}
for (const response of [otherScript, missing]) {
  assert.doesNotMatch(response.headers.get("content-security-policy"), /'wasm-unsafe-eval'/);
}
assert.match(html.headers.get("link"), /llms\.txt/);
assert.equal(otherScript.headers.get("link"), null);
console.log("Docbench security header checks passed.");
