import assert from "node:assert/strict";
import test from "node:test";
import {buyEstimateRejection, commandRejection, dailyAllowed, findDockTargets, gameRejection, isDocked} from "../contracts.js";

// Security boundary of the gateway: which commands run without allow_irreversible.
const reject = (tool, action, payload = {}, allow = false, env = {}) =>
  commandRejection(tool, action, allow, payload, env)?.error ?? null;

test("reads and routine gameplay run without the override", () => {
  for (const action of ["get_status", "view_market", "travel", "dock", "mine", "refuel", "chat"]) {
    assert.equal(reject("spacemolt", action), null, action);
  }
});

test("unknown and destructive actions need the override; self_destruct never runs", () => {
  assert.equal(reject("spacemolt", "sell_ship"), "irreversible_action_requires_explicit_override");
  assert.equal(reject("spacemolt", "sell_ship", {}, true), null);
  assert.equal(reject("spacemolt", "self_destruct", {}, true), "action_hard_denied");
  assert.equal(reject("spacemolt", "battle", {action:"self_destruct"}, true), "action_hard_denied");
});

test("notifications are safe only as a non-clearing peek", () => {
  assert.equal(reject("spacemolt", "get_notifications", {clear:false}), null);
  assert.notEqual(reject("spacemolt", "get_notifications", {}), null);
});

test("only defensive battle actions run without the override", () => {
  assert.equal(reject("spacemolt_battle", "retreat"), null);
  assert.equal(reject("spacemolt_battle", "stance", {id:"brace"}), null);
  assert.notEqual(reject("spacemolt_battle", "stance", {id:"board"}), null);
  assert.notEqual(reject("spacemolt_battle", "stance", {}), null);
  assert.equal(reject("spacemolt", "battle", {action:"stance", stance:"flee"}), null);
  assert.notEqual(reject("spacemolt", "battle", {action:"attack"}), null);
});

test("buy skips the override only as a capped core market buy", () => {
  assert.equal(reject("spacemolt", "buy", {id:"fuel_cell", quantity:10}), null);
  assert.notEqual(reject("spacemolt", "buy", {id:"fuel_cell", quantity:101}), null);
  assert.notEqual(reject("spacemolt", "buy", {id:"fuel_cell", quantity:0}), null);
  assert.notEqual(reject("spacemolt", "buy", {id:"fuel_cell", quantity:"10"}), null);
  assert.notEqual(reject("spacemolt", "buy", {id:"fuel_cell", quantity:10, auto_list:true}), null);
  assert.notEqual(reject("spacemolt_ship", "buy", {id:"x", quantity:1}), null);
  assert.equal(reject("spacemolt", "buy", {id:"fuel_cell", quantity:500}, false, {BUY_SAFE_MAX_QUANTITY:"500"}), null);
});

test("capped buy refuses an estimate over the credit cap or without a total", () => {
  const over = buyEstimateRejection({structuredContent:{total_cost:2500}}, {});
  assert.equal(over.error, "buy_over_safe_limit");
  assert.equal(over.max_credits, 2000);
  assert.equal(buyEstimateRejection({structuredContent:{total_cost:150}}, {}), null);
  assert.equal(buyEstimateRejection({structuredContent:{}}, {})?.error, "buy_estimate_unavailable");
  assert.equal(buyEstimateRejection({structuredContent:{total_cost:2500}}, {BUY_SAFE_MAX_CREDITS:"3000"}), null);
});

test("game refusals map to short codes; auth and rate limits stay gateway errors", () => {
  assert.equal(gameRejection(new Error("game_error:no_fuel")), "no_fuel");
  assert.equal(gameRejection(new Error("game_http_400:bad_args")), "bad_args");
  assert.equal(gameRejection(new Error("game_http_400:Some long human text")), "rejected");
  assert.equal(gameRejection(new Error("game_http_401:x")), null);
  assert.equal(gameRejection(new Error("game_http_403:x")), null);
  assert.equal(gameRejection(new Error("game_http_429:x")), null);
  assert.equal(gameRejection(new Error("game_http_502:x")), null);
});

test("daily planner allowlist blocks hard-denied, inherited and unsafe calls", () => {
  assert.equal(dailyAllowed("spacemolt", "attack", {}), false);
  assert.equal(dailyAllowed("constructor", "get_status", {}), false);
  assert.equal(dailyAllowed("spacemolt", "buy", {id:"x", quantity:1}), false);
  assert.equal(dailyAllowed("spacemolt", "travel", {}), false);
  assert.equal(dailyAllowed("spacemolt", "travel", {id:"poi"}), true);
  assert.equal(dailyAllowed("spacemolt", "refuel", {quantity:201}), false);
  assert.equal(dailyAllowed("spacemolt_battle", "stance", {id:"board"}), false);
});

test("dock target search finds stations and skips the current POI", () => {
  const system = {pois:[
    {id:"here", type:"station"},
    {id:"belt", type:"asteroid_belt"},
    {id:"st-2", name:"Kestrel Station"},
    {poi_id:"out-3", poi_type:"outpost"},
  ]};
  assert.deepEqual(findDockTargets(system, "here"), ["st-2", "out-3"]);
});

test("docked state is read from location or ship", () => {
  assert.equal(isDocked({structuredContent:{location:{docked:true}}}), true);
  assert.equal(isDocked({structuredContent:{ship:{docked:false}, location:{}}}), false);
  assert.equal(isDocked({location:{docked_at:"st-1"}}), true);
});
