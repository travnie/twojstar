import test from "node:test";
import assert from "node:assert/strict";
import { markdownAsset, prefersMarkdown, varyAccept } from "../../../shared/http/markdown.ts";

test("Markdown negotiation is explicit and keeps browser fallback", async () => {
  for (const type of ["text/markdown", "text/markdown,text/html;q=0.4"]) assert.equal(prefersMarkdown(type), true);
  for (const type of ["*/*", "text/html,text/markdown;q=0", "text/html,text/markdown;q=0.5"]) assert.equal(prefersMarkdown(type), false);
  assert.equal(prefersMarkdown('text/html;profile="a,b";q=0, text/markdown;q=0.5'), true);
  assert.equal(prefersMarkdown("text/markdown;q="), false);
  assert.equal(prefersMarkdown("text/markdown;q=abc"), false);
  assert.equal(prefersMarkdown("text/html,text/markdown;q="), false);
  assert.equal(prefersMarkdown('text/html;profile="' + "\\!".repeat(4096)), false);
  const assets = { fetch: async request => {
    assert.equal(new URL(request.url).pathname, "/index.md");
    return new Response("# Guide", { headers: { etag: "asset", vary: "Accept-Encoding" } });
  } };
  for (const method of ["GET", "HEAD"]) {
    const response = await markdownAsset(new Request("https://example.test/", { method, headers: { accept: "text/markdown" } }), assets);
    assert.equal(await response.text(), method === "HEAD" ? "" : "# Guide");
    assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.equal(response.headers.get("vary"), "Accept-Encoding, Accept");
    assert.equal(response.headers.get("etag"), null);
    varyAccept(response.headers);
    assert.equal(response.headers.get("vary"), "Accept-Encoding, Accept");
  }
  assert.equal(await markdownAsset(new Request("https://example.test/", { headers: { accept: "text/html,*/*;q=0.8" } }), assets), undefined);
  const request = new Request("https://example.test/", { headers: { accept: "text/markdown" } });
  assert.equal(await markdownAsset(request, { fetch: async () => new Response("missing", { status: 404 }) }), undefined);
  assert.equal(await markdownAsset(new Request("https://example.test/api", { headers: { accept: "text/markdown" } }), assets), undefined);
});
