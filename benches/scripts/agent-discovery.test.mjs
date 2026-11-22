import assert from "node:assert/strict";
import test from "node:test";
import { benchDiscoveryResponse, agentDiscoveryLink } from "../shared/agent-discovery.ts";

for (const product of ["codebench", "docbench", "streambench"]) {
  const base = "https://" + product + ".bartek.lol";
  test(product + " discovery exposes actual browser tools and correct skill digest", async () => {
    const get = async (path, method = "GET") =>
      benchDiscoveryResponse(new Request(base + path, { method }), product);
    const module = await import("../" + product + "/src/index.ts");
    const deployedRoute = await module.default.fetch(new Request(base + "/.well-known/ard.json"), {
      ASSETS: { fetch: () => { throw Error("Discovery must run before static assets"); } },
    });
    assert.equal(deployedRoute.status, 200);
    assert.match(deployedRoute.headers.get("content-type"), /^application\/ard\+json/u);
    const ard = await (await get("/.well-known/ard.json")).json();
    assert.equal(ard.specVersion, "0.9");
    assert.equal(ard.host.identifier, product + ".bartek.lol");
    assert.equal(ard.entries[0].type, "text/html");
    assert.equal(ard.entries[0].url, base + "/");
    assert.match(agentDiscoveryLink(product), /rel="ard"/);
    const index = await (await get("/.well-known/agent-skills/index.json")).json();
    const skillResponse = await get("/.well-known/agent-skills/" + product + "-browser-tools/SKILL.md");
    assert.equal(skillResponse.status, 200);
    const skill = await skillResponse.text();
    const sha = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(skill));
    assert.equal(index.skills[0].digest, "sha256:" + [...new Uint8Array(sha)]
      .map((x) => x.toString(16).padStart(2, "0")).join(""));
    const head = await get("/.well-known/ard.json", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const post = await get("/.well-known/ard.json", "POST");
    assert.equal(post.status, 405);
    if (product === "streambench") {
      const catalog = await get("/.well-known/api-catalog");
      assert.equal((await catalog.json()).linkset[0].anchor, base + "/api/providers");
      const api = await (await get("/openapi.json")).json();
      assert.ok(api.paths["/api/playlist"]);
      assert.match((await get("/.well-known/api-catalog", "HEAD")).headers.get("link"), /api-catalog/);
    } else {
      assert.equal(await get("/openapi.json"), null);
      assert.equal(await get("/.well-known/api-catalog"), null);
    }
  });
}
