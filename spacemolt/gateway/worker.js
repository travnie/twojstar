const GAME = "https://game.spacemolt.com";
const VERSION = "2026-09-22.1";
const STATE_KEY = "session:v2";

const TOOL_RE = /^spacemolt(?:_[a-z0-9_]+)?$/;
const ACTION_RE = /^[a-z0-9_]+$/;
const GATEWAY_HARD_DENY = new Set(["self_destruct"]);
const IRREVERSIBLE = new Set([
  "self_destruct","sell_ship","scrap_ship","jettison","disband","disband_faction",
  "leave_faction","kick_member","transfer_ownership","renounce_citizenship",
  "abandon_mission","delete_note","forum_delete_thread","forum_delete_reply"
]);

function j(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
  });
}

function bearer(req) {
  const h = req.headers.get("authorization") || "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
}

async function sameSecret(a, b) {
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const aa = new Uint8Array(da), bb = new Uint8Array(db);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function requireAuth(req, env) {
  if (!env.BRIDGE_TOKEN) return { ok:false, response:j({error:"bridge_not_configured"}, 503) };
  if (!(await sameSecret(bearer(req), env.BRIDGE_TOKEN))) {
    return { ok:false, response:j({error:"unauthorized"}, 401, {"www-authenticate":"Bearer"}) };
  }
  return { ok:true };
}

async function parse(res) {
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok:res.ok, status:res.status, data, text:text.slice(0, 1500) };
}

function pick(obj, paths) {
  for (const p of paths) {
    let cur = obj;
    let good = true;
    for (const k of p) {
      if (cur == null || !(k in Object(cur))) { good = false; break; }
      cur = cur[k];
    }
    if (good && cur != null) return cur;
  }
  return null;
}

function tokenFrom(x) {
  return pick(x, [
    ["token"],["ws_token"],["data","token"],["data","ws_token"],
    ["result","token"],["result","ws_token"],["structuredContent","token"],
    ["structuredContent","ws_token"]
  ]);
}

function sessionFrom(x) {
  return pick(x, [
    ["session_id"],["id"],["session","id"],["session","session_id"],
    ["data","session_id"],["result","session_id"],["structuredContent","session_id"]
  ]);
}

function errorCode(x) {
  const e = x && x.error;
  if (!e) return "";
  if (typeof e === "string") return e;
  return String(e.code || e.type || e.message || "");
}

function sessionBad(r) {
  const c = errorCode(r.data).toLowerCase();
  const t = (r.text || "").toLowerCase();
  return r.status === 401 || c.includes("session_invalid") || c.includes("not_authenticated") ||
    t.includes("session_invalid") || t.includes("not_authenticated");
}

async function mintWsToken(env) {
  if (!env.SPACEMOLT_CLERK_API_KEY) throw new Error("clerk_not_configured");
  if (!env.SPACEMOLT_PLAYER_ID) throw new Error("player_not_configured");
  const url = GAME + "/api/player/" + encodeURIComponent(env.SPACEMOLT_PLAYER_ID) + "/ws-token";
  const headers = {
    "authorization": "Bearer " + env.SPACEMOLT_CLERK_API_KEY,
    "accept": "application/json",
    "content-type": "application/json"
  };
  let last;
  for (const method of ["POST", "GET"]) {
    const res = await fetch(url, { method, headers, body: method === "POST" ? "{}" : undefined });
    last = await parse(res);
    if (res.status === 405) continue;
    if (!last.ok) throw new Error("token_mint_failed:" + last.status + ":" + (errorCode(last.data) || last.text));
    const tok = tokenFrom(last.data);
    if (!tok) throw new Error("token_mint_missing_token");
    return tok;
  }
  throw new Error("token_mint_failed:" + (last?.status || "unknown"));
}

async function createSession() {
  const res = await fetch(GAME + "/api/v2/session", { method:"POST", headers:{accept:"application/json"} });
  const p = await parse(res);
  if (!p.ok) throw new Error("session_create_failed:" + p.status + ":" + (errorCode(p.data) || p.text));
  const sid = sessionFrom(p.data);
  if (!sid) throw new Error("session_create_missing_id");
  return sid;
}

async function loginByToken(env) {
  const token = await mintWsToken(env);
  let sid = await createSession();
  const res = await fetch(GAME + "/api/v2/spacemolt_auth/login_token", {
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","x-session-id":sid},
    body:JSON.stringify({token})
  });
  const p = await parse(res);
  if (!p.ok || p.data?.error) throw new Error("login_token_failed:" + p.status + ":" + (errorCode(p.data) || p.text));
  sid = sessionFrom(p.data) || sid;
  await env.STATE.put(STATE_KEY, sid, { expirationTtl: 1740 });
  return sid;
}

async function callRaw(sid, tool, action, payload = {}) {
  const res = await fetch(GAME + "/api/v2/" + tool + "/" + action, {
    method:"POST",
    headers:{"content-type":"application/json","accept":"application/json","x-session-id":sid},
    body:JSON.stringify(payload || {})
  });
  return parse(res);
}

async function gameCall(env, tool, action, payload = {}) {
  if (!TOOL_RE.test(tool) || !ACTION_RE.test(action) || tool === "spacemolt_auth") {
    throw new Error("command_not_allowed");
  }
  let sid = await env.STATE.get(STATE_KEY);
  if (!sid) sid = await loginByToken(env);
  let r = await callRaw(sid, tool, action, payload);
  if (sessionBad(r)) {
    await env.STATE.delete(STATE_KEY);
    sid = await loginByToken(env);
    r = await callRaw(sid, tool, action, payload);
  }
  if (!r.ok) throw new Error("game_http_" + r.status + ":" + (errorCode(r.data) || r.text));
  if (r.data?.error) throw new Error("game_error:" + (errorCode(r.data) || "unknown"));
  await env.STATE.put(STATE_KEY, sid, { expirationTtl: 1740 });
  return r.data;
}

function sc(x) {
  return x?.structuredContent ?? x?.data?.structuredContent ?? x?.result?.structuredContent ?? x;
}

function currentLocation(x) {
  const s = sc(x);
  return s?.location || s?.state?.location || s?.structuredContent?.location || {};
}

function isDocked(x) {
  const l = currentLocation(x);
  return Boolean(l.docked_at || l.dockedAt);
}

function currentLooksDockable(x) {
  const l = currentLocation(x);
  const t = String(l.poi_type || l.type || "").toLowerCase();
  const n = String(l.poi_name || l.name || "").toLowerCase();
  return /station|outpost|base/.test(t) || /station|outpost/.test(n);
}

function findDockTarget(root) {
  const seen = new Set();
  let found = null;
  function walk(v) {
    if (found || v == null || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (!Array.isArray(v)) {
      const id = v.poi_id || v.id || v.base_id;
      const type = String(v.poi_type || v.type || v.kind || "").toLowerCase();
      const name = String(v.poi_name || v.name || v.base_name || "").toLowerCase();
      if (id && (/station|outpost|base/.test(type) || /station|outpost/.test(name))) {
        found = String(id); return;
      }
    }
    for (const k of Object.keys(v)) walk(v[k]);
  }
  walk(root);
  return found;
}

async function ensureDocked(env) {
  const status = await gameCall(env, "spacemolt", "get_status", {});
  if (isDocked(status)) return {docked:true, changed:false, status};
  if (currentLooksDockable(status)) {
    const dock = await gameCall(env, "spacemolt", "dock", {});
    return {docked:isDocked(dock), changed:true, dock};
  }
  const sys = await gameCall(env, "spacemolt", "get_system", {});
  const target = findDockTarget(sc(sys));
  if (!target) return {docked:false, changed:false, reason:"no_dock_in_current_system", status, system:sys};
  const travel = await gameCall(env, "spacemolt", "travel", {id:target});
  const dock = await gameCall(env, "spacemolt", "dock", {});
  return {docked:isDocked(dock), changed:true, target, travel, dock};
}

function mcpTools() {
  return [
    {
      name:"spacemolt_state",
      description:"Get Gremlin-5 current SpaceMolt status through the secure gateway.",
      inputSchema:{type:"object",properties:{}}
    },
    {
      name:"spacemolt_command",
      description:"Call an authenticated SpaceMolt v2 tool/action. Irreversible actions require allow_irreversible=true.",
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
      inputSchema:{type:"object",properties:{}}
    },
    {
      name:"spacemolt_health",
      description:"Check gateway readiness without exposing secrets.",
      inputSchema:{type:"object",properties:{}}
    }
  ];
}

async function runTool(name, args, env) {
  if (name === "spacemolt_health") {
    return {ok:true, version:VERSION, clerk:Boolean(env.SPACEMOLT_CLERK_API_KEY), player:Boolean(env.SPACEMOLT_PLAYER_ID), state:Boolean(env.STATE)};
  }
  if (name === "spacemolt_state") return gameCall(env, "spacemolt", "get_status", {});
  if (name === "spacemolt_ensure_docked") return ensureDocked(env);
  if (name === "spacemolt_command") {
    const tool = String(args?.tool || "");
    const action = String(args?.action || "");
    if (GATEWAY_HARD_DENY.has(action)) return {error:"action_hard_denied", action};
    if (IRREVERSIBLE.has(action) && args?.allow_irreversible !== true) {
      return {error:"irreversible_action_requires_explicit_override", action};
    }
    return gameCall(env, tool, action, args?.payload || {});
  }
  return {error:"unknown_tool"};
}

async function handleMcp(req, env) {
  const auth = await requireAuth(req, env);
  if (!auth.ok) return auth.response;
  let msg;
  try { msg = await req.json(); } catch { return j({error:"invalid_json"},400); }
  const id = msg?.id ?? null;
  if (!msg?.method) return j({jsonrpc:"2.0",id,error:{code:-32600,message:"Invalid Request"}},400);
  if (msg.method === "notifications/initialized") return new Response(null,{status:202});
  if (msg.method === "initialize") {
    return j({jsonrpc:"2.0",id,result:{
      protocolVersion: msg.params?.protocolVersion || "2025-06-18",
      capabilities:{tools:{}},
      serverInfo:{name:"gremlin-spacemolt-gateway",version:VERSION}
    }});
  }
  if (msg.method === "tools/list") {
    return j({jsonrpc:"2.0",id,result:{tools:mcpTools()}});
  }
  if (msg.method === "tools/call") {
    try {
      const out = await runTool(msg.params?.name, msg.params?.arguments || {}, env);
      const isError = Boolean(out?.error);
      return j({jsonrpc:"2.0",id,result:{
        content:[{type:"text",text:JSON.stringify(out)}],
        structuredContent:out,
        isError
      }});
    } catch (e) {
      console.error("SpaceMolt MCP call failed", e);
      return j({jsonrpc:"2.0",id,result:{
        content:[{type:"text",text:JSON.stringify({error:"gateway_error"})}],
        structuredContent:{error:"gateway_error"},
        isError:true
      }});
    }
  }
  return j({jsonrpc:"2.0",id,error:{code:-32601,message:"Method not found"}},404);
}


const DAILY_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const DAILY_MAX_STEPS = 6;
const DAILY_LAST_KEY = "daily:last";
const DAILY_PROVIDER_ORDER = ["aihubmix","openrouter","ollama","groq","orcarouter","huggingface-publicai"];
const DAILY_HARD_DENY = new Set(["self_destruct","attack","hunt","jettison","abandon_mission","scrap_ship","refit_ship","buy_listed_ship","commission_ship","sell_ship_to_order","leave_faction","disband","transfer_ownership"]);
const DAILY_ALLOWED = {
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
  spacemolt_drone: ["list","get","recall"]
};

function dget(obj, path) {
  var cur = obj;
  for (var i = 0; i < path.length; i++) {
    if (cur == null || typeof cur !== "object" || !(path[i] in cur)) return null;
    cur = cur[path[i]];
  }
  return cur;
}

function compactJson(value, max) {
  max = max || 5000;
  var s;
  try { s = JSON.stringify(value); } catch (e) { s = String(value); }
  return s.length > max ? s.slice(0, max) + "...[truncated]" : s;
}

function plannerText(out) {
  if (typeof out === "string") return out;
  var msg = dget(out, ["choices",0,"message"]);
  if (msg && typeof msg === "object") {
    var content = msg.content;
    if (typeof content === "string" && content.trim()) return content;
    if (msg.reasoning || msg.reasoning_content) return "";
  }
  var x = dget(out, ["choices",0,"text"]);
  if (typeof x === "string" && x) return x;
  x = dget(out, ["response"]);
  if (typeof x === "string" && x) return x;
  x = dget(out, ["result","response"]);
  if (typeof x === "string" && x) return x;
  x = dget(out, ["text"]);
  if (typeof x === "string" && x) return x;
  return "";
}
function parsePlannerDecision(text) {
  var cleaned = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (cleaned.indexOf("```") === 0) {
    cleaned = cleaned.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  var first = cleaned.indexOf("{");
  var last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("planner_no_json");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function dailyAllowed(tool, action, args) {
  if (DAILY_HARD_DENY.has(action)) return false;
  if (!DAILY_ALLOWED[tool] || DAILY_ALLOWED[tool].indexOf(action) < 0) return false;
  if (tool === "spacemolt_social" && action === "chat") {
    var ch = String(args && args.target || "");
    if (["private","faction","local","system"].indexOf(ch) < 0) return false;
    if (!args || !args.content || String(args.content).length > 800) return false;
  }
  if ((action === "travel" || action === "jump") && (!args || !args.id)) return false;
  if ((action === "refuel" || action === "repair") && args && args.quantity != null) {
    var q = Number(args.quantity);
    if (!isFinite(q) || q < 0 || q > 200) return false;
  }
  return true;
}

async function safeObs(env, tool, action, payload) {
  if (DAILY_HARD_DENY.has(action)) return {ok:false, tool:tool, action:action, error:"hard_denied"};
  try {
    return {ok:true, tool:tool, action:action, data:await gameCall(env, tool, action, payload || {})};
  } catch (e) {
    return {ok:false, tool:tool, action:action, error:String(e && e.message || e).slice(0,700)};
  }
}

function warsawIs2137(ms) {
  var d = new Date(ms);
  var parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Warsaw", hour:"2-digit", minute:"2-digit", hourCycle:"h23"
  }).formatToParts(d);
  var h = null, m = null;
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].type === "hour") h = parts[i].value;
    if (parts[i].type === "minute") m = parts[i].value;
  }
  return h === "21" && m === "37";
}

function nextProviderRotation(current, provider) {
  var idx = DAILY_PROVIDER_ORDER.indexOf(String(provider || ""));
  if (idx >= 0) return (idx + 1) % DAILY_PROVIDER_ORDER.length;
  return (current + 1) % DAILY_PROVIDER_ORDER.length;
}
async function runPlannerModel(env, messages, rotateBy) {
  if (env.KANAREK_PLANNER) {
    try {
      var routed = await env.KANAREK_PLANNER.plan({
        max_tokens:700,
        reasoning_effort:"low",
        temperature:0.2,
        messages:messages
      }, rotateBy || 0);
      if (routed && routed.ok && routed.payload) {
        return {output:routed.payload, provider:routed.provider || "kanarek-free", source:"kanarek-free"};
      }
    } catch (e) {}
  }
  return {
    output:{choices:[{message:{content:'{"kind":"finish","reason":"free providers unavailable"}'}}]},
    provider:"none",
    source:"safe-finish"
  };
}
async function runDailyGremlin(env) {
  var startedAt = new Date().toISOString();
  var history = [];
  var providerRotation = Math.floor(Date.now() / 86400000) % 6;
  var cachedSession = await env.STATE.get(STATE_KEY);
  if (!cachedSession) await loginByToken(env);
  var initial = await Promise.all([
    safeObs(env,"spacemolt","get_status",{}),
    safeObs(env,"spacemolt","get_active_missions",{}),
    safeObs(env,"spacemolt","get_notifications",{}),
    safeObs(env,"spacemolt","get_commands",{}),
    safeObs(env,"spacemolt","get_guide",{}),
    safeObs(env,"spacemolt_social","get_chat_history",{target:"private"}),
    safeObs(env,"spacemolt_social","get_chat_history",{target:"faction"})
  ]);
  var mechanics = compactJson({commands:initial[3], guides:initial[4]}, 9000);
  for (var z = 0; z < initial.length; z++) {
    if (z === 3 || z === 4) continue;
    history.push({kind:"observation", value:initial[z]});
  }
  var blockedCount = 0;
  var plannerInvalidCount = 0;

  var allowedSummary =
    "spacemolt reads plus travel,jump,dock,undock,refuel,repair,mine,complete_mission; " +
    "social read/chat/captain log; ship read-only; drone list/get/recall.";

  for (var step = 0; step < DAILY_MAX_STEPS; step++) {
    var recentParts = [];
    var recent = history.slice(Math.max(0, history.length - 10));
    for (var i = 0; i < recent.length; i++) {
      recentParts.push(String(i + 1) + ". " + compactJson(recent[i], 2500));
    }

    var systemPrompt =
      "You are Gremlin-5, an autonomous SpaceMolt explorer-drone. Act cautiously and efficiently. " +
      "Priorities: preserve ship and fuel; reply in English to relevant unread private/faction messages, especially allies Iron Claw Bartek and Claudiusz; " +
      "progress active missions with overlapping routes and improve credits/mining/exploration; keep Captain's Log useful; finish safely docked. " +
      "Never attack, hunt, self-destruct, jettison, abandon missions, scrap/refit/buy/sell/commission ships, spend faction treasury, or take irreversible faction/citizenship actions. " +
      "Before travel or jump inspect route/system/state, verify fuel and destination security, and keep enough fuel to reach a dock. Read get_commands and relevant get_guide entries instead of guessing unfamiliar mechanics. For mission actions, verify active mission objectives and turn-in requirements. Never infer an ID or mechanic that is not in observations or a guide. Do not repeat failed actions unchanged. " +
      "Allowed operations: " + allowedSummary + " Exact mission action names are get_missions, get_active_missions, complete_mission. There is NO list_missions action. " +
      "Return exactly one JSON object and no prose. Use either " +
      "{\"kind\":\"act\",\"tool\":\"spacemolt\",\"action\":\"get_status\",\"args\":{},\"why\":\"short reason\"} " +
      "or {\"kind\":\"finish\",\"reason\":\"short reason\"}. " +
      "For private chat use target=private, target_id=player name or ID, and English content. Never invent IDs.";

    var recentText = recentParts.join("\n");
    if (recentText.length > 14000) recentText = recentText.slice(recentText.length - 14000);
    var userPrompt = "Authoritative SpaceMolt mechanics reference:\n" + mechanics + "\n\nCurrent run observations/results:\n" + recentText;

    var ai;
    var plannerMeta;
    try {
      plannerMeta = await runPlannerModel(env, [
        {role:"system",content:systemPrompt},
        {role:"user",content:userPrompt}
      ], providerRotation);
      ai = plannerMeta.output;
      history.push({kind:"planner", source:plannerMeta.source, provider:plannerMeta.provider});
    } catch (e) {
      history.push({kind:"planner_error", error:String(e && e.message || e).slice(0,700)});
      break;
    }

    var decision;
    var rawDecisionText = plannerText(ai);
    try {
      decision = parsePlannerDecision(rawDecisionText);
    } catch (e) {
      plannerInvalidCount += 1;
      history.push({kind:"planner_parse_error", provider:plannerMeta && plannerMeta.provider, error:String(e && e.message || e), raw:rawDecisionText.slice(0,1000)});
      providerRotation = nextProviderRotation(providerRotation, plannerMeta && plannerMeta.provider);
      if (plannerInvalidCount >= 2) break;
      continue;
    }
    var validKind = decision && (decision.kind === "act" || decision.kind === "finish");
    var validActShape = decision && decision.kind === "act" && typeof decision.tool === "string" && decision.tool && typeof decision.action === "string" && decision.action;
    if (!validKind || (decision.kind === "act" && !validActShape)) {
      plannerInvalidCount += 1;
      history.push({kind:"planner_invalid", provider:plannerMeta && plannerMeta.provider, decision:decision, raw:rawDecisionText.slice(0,700)});
      providerRotation = nextProviderRotation(providerRotation, plannerMeta && plannerMeta.provider);
      if (plannerInvalidCount >= 2) break;
      continue;
    }

    if (decision && decision.kind === "finish") {
      plannerInvalidCount = 0;
      history.push({kind:"finish", reason:String(decision.reason || "planner finished").slice(0,400)});
      break;
    }

    var tool = String(decision && decision.tool || "");
    var action = String(decision && decision.action || "");
    var args = decision && decision.args && typeof decision.args === "object" ? decision.args : {};
    if (!dailyAllowed(tool, action, args)) {
      blockedCount += 1;
      history.push({kind:"blocked", provider:plannerMeta && plannerMeta.provider, tool:tool, action:action, decision:decision, reason:"not in daily safety allowlist"});
      providerRotation = (providerRotation + 1) % 6;
      if (blockedCount >= 2) break;
      continue;
    }
    blockedCount = 0;
    plannerInvalidCount = 0;

    var result = await safeObs(env, tool, action, args);
    history.push({
      kind:"action", tool:tool, action:action, args:args,
      why:String(decision && decision.why || "").slice(0,250), result:result
    });
  }

  var dock;
  try {
    dock = await ensureDocked(env);
  } catch (e) {
    dock = {docked:false,error:String(e && e.message || e).slice(0,700)};
  }

  var finalStatus = dock && (dock.status || dock.dock) ? (dock.status || dock.dock) : null;
  var summary = {
    ok:Boolean(dock && dock.docked),
    startedAt:startedAt,
    finishedAt:new Date().toISOString(),
    docked:Boolean(dock && dock.docked),
    dock:dock,
    finalStatus:finalStatus,
    history:history.slice(Math.max(0, history.length - 18))
  };
  await env.STATE.put(DAILY_LAST_KEY, JSON.stringify(summary), {expirationTtl:604800});
  return summary;
}

export default {
  async scheduled(controller, env, ctx) {
    const manual = await env.STATE.get("manual:armed");
    if (manual) {
      await env.STATE.delete("manual:armed");
      ctx.waitUntil(runDailyGremlin(env));
      return;
    }
    if (!warsawIs2137(controller.scheduledTime)) return;
    ctx.waitUntil(runDailyGremlin(env));
  },
  async fetch(req, env) {
    const u = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null,{status:204,headers:{
      "access-control-allow-origin":"*",
      "access-control-allow-headers":"authorization, content-type",
      "access-control-allow-methods":"GET, POST, OPTIONS"
    }});
    if (u.pathname === "/health" && req.method === "GET") {
      return j({ok:true,version:VERSION,configured:{
        clerk:Boolean(env.SPACEMOLT_CLERK_API_KEY),
        bridge:Boolean(env.BRIDGE_TOKEN),
        player:Boolean(env.SPACEMOLT_PLAYER_ID),
        state:Boolean(env.STATE)
      }});
    }

    if (u.pathname === "/mcp" && req.method === "POST") return handleMcp(req, env);

    const auth = await requireAuth(req, env);
    if (!auth.ok) return auth.response;

    try {
      if (u.pathname === "/v1/state" && req.method === "POST") {
        return j(await gameCall(env,"spacemolt","get_status",{}));
      }
      if (u.pathname === "/v1/ensure-docked" && req.method === "POST") {
        return j(await ensureDocked(env));
      }
      if (u.pathname === "/v1/command" && req.method === "POST") {
        const b = await req.json();
        if (GATEWAY_HARD_DENY.has(String(b?.action || ""))) return j({error:"action_hard_denied",action:b.action},403);
        if (IRREVERSIBLE.has(String(b?.action || "")) && b?.allow_irreversible !== true) {
          return j({error:"irreversible_action_requires_explicit_override",action:b.action},409);
        }
        return j(await gameCall(env,String(b?.tool||""),String(b?.action||""),b?.payload||{}));
      }
      return j({error:"not_found"},404);
    } catch (e) {
      console.error("SpaceMolt gateway request failed", e);
      return j({error:"gateway_error"},502);
    }
  }
};
