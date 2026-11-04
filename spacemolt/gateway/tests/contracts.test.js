import assert from "node:assert/strict";
import test from "node:test";
import {dailyAllowed, dailyBlockReason, isDailyRead, dailyReadKey, activeMissionCount, stationRoute, planIsRecent, mcpTools, parsePlannerDecision} from "../contracts.js";

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

test("read keys ignore argument order", () => {
  assert.equal(dailyReadKey("spacemolt", "get_notifications", {limit:5, clear:false}),
    dailyReadKey("spacemolt", "get_notifications", {clear:false, limit:5}));
  assert.notEqual(dailyReadKey("spacemolt", "get_guide", {topic:"mining"}), dailyReadKey("spacemolt", "get_guide", {}));
});

test("accept_mission is allowed only with a mission id", () => {
  assert.equal(dailyBlockReason("spacemolt", "accept_mission", {id:"m1"}), null);
  assert.match(dailyBlockReason("spacemolt", "accept_mission", {}), /mission_id/);
  assert.match(dailyBlockReason("spacemolt", "abandon_mission", {id:"m1"}), /never allowed/);
});

test("active mission count reads get_status missions", () => {
  assert.equal(activeMissionCount({structuredContent:{missions:{active:[]}}}), 0);
  assert.equal(activeMissionCount({structuredContent:{missions:{active:[{id:"m"}]}}}), 1);
  assert.equal(activeMissionCount({structuredContent:{}}), null);
});

test("captain's log entries must be short and non-empty", () => {
  assert.equal(dailyBlockReason("spacemolt_social", "captains_log_add", {content:"Docked at Arneb; next: Thuban board."}), null);
  assert.match(dailyBlockReason("spacemolt_social", "captains_log_add", {content:"  "}), /non-empty/);
  assert.match(dailyBlockReason("spacemolt_social", "captains_log_add", {content:"x".repeat(481)}), /max 480/);
});

test("route and mission completion need ids", () => {
  assert.match(dailyBlockReason("spacemolt", "find_route", {destination:"thuban"}), /args\.id/);
  assert.equal(dailyBlockReason("spacemolt", "find_route", {id:"thuban"}), null);
  assert.match(dailyBlockReason("spacemolt", "complete_mission", {}), /mission_id/);
});

test("station route accepts short fuel-safe trips to a station only", () => {
  const ok = {structuredContent:{found:true, target_poi:"haven_station", target_system:"haven", total_jumps:2, estimated_fuel:10, fuel_available:94,
    route:[{system_id:"electra", jumps:0}, {system_id:"tau_ceti", jumps:1}, {system_id:"haven", jumps:2}]}};
  assert.deepEqual(stationRoute(ok, 3), {steps:["tau_ceti", "haven"], targetPoi:"haven_station", targetSystem:"haven"});
  assert.equal(stationRoute({structuredContent:{...ok.structuredContent, target_poi:undefined}}, 3), null);
  assert.equal(stationRoute({structuredContent:{...ok.structuredContent, total_jumps:5}}, 3), null);
  assert.equal(stationRoute({structuredContent:{...ok.structuredContent, estimated_fuel:200}}, 3), null);
});

test("plan recency parses game timestamps as UTC", () => {
  const now = Date.parse("2026-11-04T21:00:00Z");
  assert.equal(planIsRecent("2026-11-04 19:32:01", now, 48 * 3600e3), true);
  assert.equal(planIsRecent("2026-11-01 19:32:01", now, 48 * 3600e3), false);
  assert.equal(planIsRecent("garbage", now, 48 * 3600e3), false);
});
