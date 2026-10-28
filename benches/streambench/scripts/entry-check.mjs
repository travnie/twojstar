import assert from "node:assert/strict";
import { test } from "node:test";
import entry from "../src/entry.ts";

const origins = [
  "https://streambench.travny.workers.dev",
  "https://streambench.trfny.com",
  "http://localhost:8787",
];

for (const origin of origins) {
  for (const method of ["GET", "HEAD"]) {
    test(`${method} ${origin}/ serves local assets without a host redirect`, async () => {
      const url = `${origin}/?source=local`;
      const requests = [];
      const env = {
        ASSETS: {
          fetch(request) {
            requests.push([request.url, request.method]);
            return new Response(method === "HEAD" ? null : "<html>Streambench</html>", {
              headers: { "content-type": "text/html" },
            });
          },
        },
      };
      const response = await entry.fetch(new Request(url, { method }), env, {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("location"), null);
      assert.deepEqual(requests, [[url, method]]);
      assert.match(response.headers.get("link"), /<\/index\.md>; rel="alternate"/);
      assert.equal(await response.text(), method === "HEAD" ? "" : "<html>Streambench</html>");
    });
  }

  test(`${origin}/index.html keeps its origin and query`, async () => {
    const response = await entry.fetch(new Request(`${origin}/index.html?source=local`), {}, {});
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), `${origin}/?source=local`);
  });
}
