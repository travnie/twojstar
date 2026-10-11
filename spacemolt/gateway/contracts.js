// Pure gateway contracts: command policy, daily allowlist, MCP tool schemas, response helpers.
// No I/O here; worker.js owns sessions and game calls. Imported directly by tests.

export const GATEWAY_HARD_DENY = new Set(["self_destruct"]);

// Commands that run without allow_irreversible=true: reads plus routine, recoverable
// gameplay. Everything else, including any action added to the game later, needs the override.
export const SAFE_ACTIONS = new Set([
  // reads (core and uniquely named actions)
  "analyze_market","browse_ships","captains_log_get","captains_log_list","catalog",
  "commission_quote","commission_status","completed_missions","estimate_purchase",
  "find_route","forum_get_thread","forum_list",
  "get_achievements","get_action_log","get_active_missions","get_base","get_cargo","get_chat_history",
  "get_commands","get_empire_info","get_faction_achievements","get_guide","get_invites",
  "get_location","get_map","get_missions","get_nearby","get_notes","get_notification_settings",
  "get_player","get_poi","get_queue","get_ship","get_skills","get_state","get_status","get_system",
  "get_system_agents","get_tax_estimate","get_trades","get_version","help","inspect","list_ships",
  "read_note","search_systems","view_completed_mission","view_market","view_orders",
  "view_ship_buy_orders",
  "base_cost","faction_list","garages","intel_status","list_missions","query_intel","query_trade_intel","rooms",
  "tax_estimate","trade_intel_status",
  // reads (grouped v2 names shared by tools, e.g. spacemolt_drone/list; each is a read in every tool)
  "get","list","info","status","log","summary","view","quote","wrecks","policies",
  // routine gameplay (captains_log_add is left out: on a full log it evicts the oldest entry)
  "travel","jump","dock","undock","refuel","repair","mine","scan","survey_system",
  "accept_mission","complete_mission","decline_mission","chat",
  "tow","loot","recall"
]);

// buy skips the override only as a capped market buy: core tool, no auto_list (escrowed order
// plus listing fee), quantity and estimate_purchase total within these caps. Override per Worker
// with BUY_SAFE_MAX_QUANTITY / BUY_SAFE_MAX_CREDITS vars.
export const BUY_DEFAULT_MAX_QUANTITY = 100;

export const BUY_DEFAULT_MAX_CREDITS = 2000;

// Self-defence inside a battle someone else started. These require an active battle, so they
// cannot start a fight; attack, hunt, engage and advance still need the override.
export const DEFENSIVE_BATTLE_ACTIONS = new Set(["retreat","stance","target","reload"]);

// The board stance captures the enemy ship rather than defending against it.
export const DEFENSIVE_STANCES = new Set(["fire","evade","brace","flee"]);

// Upstream refused the command itself (bad args, no fuel, ...): not retryable, report as 4xx.
export function gameRejection(error) {
  const match = /^(game_error|game_http_4(?!01|03|29)\d\d|command_not_allowed)(?::(.*))?$/s.exec(String(error?.message || ""));
  if (!match) return null;
  const detail = String(match[2] || match[1]).trim();
  return /^[a-z0-9_]{1,64}$/i.test(detail) ? detail.toLowerCase() : "rejected";
}

export function sc(input) {
  return input?.structuredContent ?? input?.data?.structuredContent ?? input?.result?.structuredContent ?? input;
}

export function currentLocation(input) {
  const status = sc(input);
  return status?.location || status?.state?.location || status?.structuredContent?.location || {};
}

export function isDocked(input) {
  const loc = currentLocation(input);
  if (typeof loc.docked === "boolean") return loc.docked;
  const status = sc(input);
  const ship = status?.ship || status?.state?.ship || status?.structuredContent?.ship || {};
  if (typeof ship.docked === "boolean") return ship.docked;
  return Boolean(loc.docked_at || loc.dockedAt);
}

export function findDockTargets(root, excludeId) {
  const seen = new Set();
  const found = [];
  function walk(node) {
    if (node == null || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node)) {
      const id = node.poi_id || node.id || node.base_id;
      const type = String(node.poi_type || node.type || node.kind || "").toLowerCase();
      const name = String(node.poi_name || node.name || node.base_name || "").toLowerCase();
      if (id && String(id) !== excludeId && !found.includes(String(id)) && (/station|outpost|base/.test(type) || /station|outpost/.test(name))) {
        found.push(String(id));
        return;
      }
    }
    for (const key of Object.keys(node)) walk(node[key]);
  }
  walk(root);
  return found;
}

export function mcpTools() {
  return [
    {
      name:"spacemolt_state",
      description:"Get Gremlin-5 current SpaceMolt status through the secure gateway.",
      annotations:{readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:true},
      inputSchema:{type:"object",properties:{}}
    },
    {
      name:"spacemolt_command",
      description:"Call an authenticated SpaceMolt v2 tool/action. Only reads, routine actions (travel, dock, mine, refuel, missions, chat, ...), capped market buys (spacemolt/buy without auto_list, up to the gateway quantity and credit caps) and self-defence in an active battle (retreat, target, reload, stance other than board) run as-is; anything else requires allow_irreversible=true.",
      annotations:{readOnlyHint:false, destructiveHint:true, idempotentHint:false, openWorldHint:true},
      inputSchema:{
        type:"object",
        properties:{
          tool:{type:"string",description:"SpaceMolt tool, e.g. spacemolt or spacemolt_social"},
          action:{type:"string"},
          payload:{type:"object",additionalProperties:true},
          allow_irreversible:{type:"boolean",default:false}
        },
        required:["tool","action"]
      }
    },
    {
      name:"spacemolt_ensure_docked",
      description:"Best-effort safety action: if not docked, dock at the current POI or a station/outpost in the current system. Does not jump systems.",
      annotations:{readOnlyHint:false, destructiveHint:true, idempotentHint:false, openWorldHint:true},
      inputSchema:{type:"object",properties:{}}
    },
    {
      name:"spacemolt_health",
      description:"Check gateway readiness without exposing secrets.",
      annotations:{readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false},
      inputSchema:{type:"object",properties:{}}
    }
  ];
}

export function isDefensiveBattleAction(action, payload) {
  if (!DEFENSIVE_BATTLE_ACTIONS.has(action)) return false;
  if (action !== "stance") return true;
  // Grouped spacemolt_battle/stance takes `id`; the flat battle dispatcher takes `stance`.
  const stances = [payload?.id, payload?.stance].filter((value) => value !== undefined);
  return stances.length > 0 && stances.every((value) => DEFENSIVE_STANCES.has(String(value)));
}

export function buyLimits(env) {
  return {
    maxQuantity:positiveInt(env?.BUY_SAFE_MAX_QUANTITY, BUY_DEFAULT_MAX_QUANTITY, 100_000),
    maxCredits:positiveInt(env?.BUY_SAFE_MAX_CREDITS, BUY_DEFAULT_MAX_CREDITS, 10_000_000)
  };
}

export function isCappedBuy(tool, payload, limits) {
  const qty = payload?.quantity;
  return tool === "spacemolt" && payload?.auto_list !== true &&
    Number.isInteger(qty) && qty >= 1 && qty <= limits.maxQuantity;
}

export function isSafeAction(tool, action, payload, env) {
  if (action === "buy") return isCappedBuy(tool, payload, buyLimits(env));
  // get_notifications clears the queue unless clear:false is passed.
  if (action === "get_notifications") return payload?.clear === false;
  // The flat battle dispatcher carries the real action in payload.action.
  if (action === "battle") return isDefensiveBattleAction(String(payload?.action || ""), payload);
  if (DEFENSIVE_BATTLE_ACTIONS.has(action)) return isDefensiveBattleAction(action, payload);
  return SAFE_ACTIONS.has(action);
}

export function commandRejection(tool, action, allowIrreversible, payload, env) {
  action = String(action || "");
  // The flat battle dispatcher carries the real action in payload.action (e.g. self_destruct).
  const nested = action === "battle" ? String(payload?.action || "") : "";
  if (GATEWAY_HARD_DENY.has(action) || GATEWAY_HARD_DENY.has(nested)) return {error:"action_hard_denied", status:403};
  if (!isSafeAction(String(tool || ""), action, payload, env) && allowIrreversible !== true) {
    // Error code kept for existing clients; it now covers every action outside SAFE_ACTIONS.
    return {error:"irreversible_action_requires_explicit_override", status:409};
  }
  return null;
}

export const DAILY_HARD_DENY = new Set(["self_destruct","attack","hunt","jettison","abandon_mission","scrap_ship","refit_ship","buy_listed_ship","commission_ship","sell_ship_to_order","leave_faction","disband","transfer_ownership"]);

export const DAILY_ALLOWED = {
  spacemolt: [
    "get_status","get_state","get_player","get_location","get_queue","get_system","get_poi",
    "get_base","get_ship","get_cargo","get_skills","get_achievements","get_active_missions",
    "get_missions","completed_missions","view_completed_mission","get_notifications","get_map",
    "search_systems","find_route","get_commands","get_guide","inspect","scan",
    "travel","jump","dock","undock","refuel","repair","mine","complete_mission"
  ],
  spacemolt_social: [
    "get_chat_history","chat","captains_log_add","captains_log_list","captains_log_get",
    "get_action_log","get_notes","read_note"
  ],
  spacemolt_ship: ["list_ships","browse_ships","view_ship_buy_orders","commission_status"],
  spacemolt_drone: ["list","get","recall"],
  spacemolt_battle: ["status","retreat","stance","target","reload"]
};

export function dailyAllowed(tool, action, args) {
  if (DAILY_HARD_DENY.has(action)) return false;
  // Own-property check: planner output may name inherited keys such as "constructor".
  const allowed = Object.hasOwn(DAILY_ALLOWED, tool) ? DAILY_ALLOWED[tool] : null;
  if (!Array.isArray(allowed) || !allowed.includes(action)) return false;
  if (tool === "spacemolt_social" && action === "chat") {
    const ch = String(args?.target || "");
    if (["private","faction","local","system"].indexOf(ch) < 0) return false;
    if (typeof args?.content !== "string" || !args.content || [...args.content].length > 500) return false;
    if (ch === "private" && (typeof args.target_id !== "string" || !args.target_id)) return false;
  }
  if (tool === "spacemolt_battle" && action !== "status" && !isDefensiveBattleAction(action, args)) return false;
  if ((action === "travel" || action === "jump") && (!args || !args.id)) return false;
  if ((action === "refuel" || action === "repair") && args?.quantity != null) {
    const qty = Number(args.quantity);
    if (!isFinite(qty) || qty < 0 || qty > 200) return false;
  }
  return true;
}

export function positiveInt(raw, fallback, max) {
  const value = String(raw || "").trim();
  if (!/^\d+$/.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function buyEstimateRejection(estimate, env) {
  const {maxCredits} = buyLimits(env);
  const total = Number(sc(estimate)?.total_cost);
  if (!Number.isFinite(total)) return {error:"buy_estimate_unavailable", status:409};
  if (total > maxCredits) return {error:"buy_over_safe_limit", status:409, total_cost:total, max_credits:maxCredits};
  return null;
}
