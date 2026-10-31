import assert from "node:assert/strict";
import test from "node:test";
import {dailyAllowed, dailyBlockReason, isDailyRead, mcpTools, parsePlannerDecision} from "../contracts.js";

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

test("planner array reply yields its first decision", () => {
  const raw = '```json\n[\n  {"kind":"act","tool":"spacemolt","action":"get_status","args":{}},\n  {"kind":"finish","reason":"done"}\n]\n```';
  assert.deepEqual(parsePlannerDecision(raw), {kind:"act", tool:"spacemolt", action:"get_status", args:{}});
});

test("planner object reply survives think block and prose", () => {
  assert.deepEqual(parsePlannerDecision('<think>hm {x}</think>Sure: {"kind":"finish","reason":"ok"} bye'), {kind:"finish", reason:"ok"});
  assert.throws(() => parsePlannerDecision("no json here"), /planner_no_json/);
  assert.throws(() => parsePlannerDecision("[1, 2]"), /planner_no_object/);
});

test("planner prose-wrapped array and fence inside string", () => {
  assert.deepEqual(parsePlannerDecision('Plan: [{"kind":"finish","reason":"a"},{"kind":"finish","reason":"b"}] ok'), {kind:"finish", reason:"a"});
  const content = "see ```code``` here";
  const raw = "```json\n" + JSON.stringify({kind:"act", tool:"spacemolt_social", action:"chat", args:{content}}) + "\n```";
  assert.equal(parsePlannerDecision(raw).args.content, content);
  const bare = JSON.stringify({kind:"act", tool:"spacemolt_social", action:"chat", args:{content}});
  assert.equal(parsePlannerDecision(bare).args.content, content);
});

test("block reason names the right tool and missing chat fields", () => {
  assert.equal(dailyBlockReason("spacemolt", "chat", {target:"private", content:"hi"}),
    "action chat belongs to tool spacemolt_social, not spacemolt");
  assert.match(dailyBlockReason("spacemolt_social", "chat", {target:"private", content:"hi"}), /target_id/);
  assert.equal(dailyBlockReason("spacemolt_social", "chat", {target:"private", content:"hi", target_id:"Bartek"}), null);
  assert.match(dailyBlockReason("spacemolt", "attack", {}), /never allowed/);
  assert.match(dailyBlockReason("spacemolt", "fly_to_moon", {}), /not in the daily allowlist/);
});

test("daily reads are told apart from state changes", () => {
  for (const [tool, action] of [["spacemolt","get_guide"],["spacemolt","get_missions"],["spacemolt_social","captains_log_list"],["spacemolt","find_route"]]) {
    assert.equal(isDailyRead(tool, action), true, action);
  }
  for (const [tool, action] of [["spacemolt","travel"],["spacemolt","mine"],["spacemolt","dock"],["spacemolt_social","chat"],["spacemolt","complete_mission"]]) {
    assert.equal(isDailyRead(tool, action), false, action);
  }
});
