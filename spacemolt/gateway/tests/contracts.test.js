import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../worker.js", import.meta.url), "utf8")
  .replace("export default {", "globalThis.worker = {");
const context = vm.createContext({});
vm.runInContext(`${source}\nglobalThis.contracts = {dailyAllowed, mcpTools};`, context);
const {dailyAllowed, mcpTools} = context.contracts;

test("daily chat respects official 500-character limit", () => {
  const allowed = (content) => dailyAllowed("spacemolt_social", "chat", {target:"local", content});
  assert.equal(allowed("a".repeat(500)), true);
  assert.equal(allowed("a".repeat(501)), false);
  assert.equal(allowed("🚀".repeat(500)), true);
  assert.equal(allowed(12), false);
});

test("private daily chat needs a recipient", () => {
  assert.equal(dailyAllowed("spacemolt_social", "chat", {target:"private", content:"Hello"}), false);
  assert.equal(dailyAllowed("spacemolt_social", "chat", {target:"private", content:"Hello", target_id:"pilot-id"}), true);
});

test("MCP describes reads and possible mutations truthfully", () => {
  const tools = mcpTools();
  for (const name of ["spacemolt_state", "spacemolt_health"]) {
    const tool = tools.find((item) => item.name === name);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.idempotentHint, true);
  }
  for (const name of ["spacemolt_command", "spacemolt_ensure_docked"]) {
    const tool = tools.find((item) => item.name === name);
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.idempotentHint, false);
    assert.equal(tool.annotations.destructiveHint, true);
  }
});
