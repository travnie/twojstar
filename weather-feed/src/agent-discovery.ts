const BASE = "https://weather.bartek.lol";
const SKILL = [
  "---",
  "name: koscielec-weather",
  "description: Read multi-source Kościelec/Chrzanów weather, local forecasts, air quality and IMGW alerts.",
  "---",
  "",
  "# Kościelec Weather",
  "",
  "- GET " + BASE + "/state.json for the latest published ensemble, warnings, air quality and station reference.",
  "- GET " + BASE + "/healthz to check the freshness of the current update (503 means stale/degraded).",
  "- GET " + BASE + "/feed.atom for significant weather changes; /warnings.atom for IMGW warning changes.",
  "- In a WebMCP-capable browser, use read_weather_state on the site's open page.",
  "- Prefer source timestamps and staleness checks; do not invent measurements or warnings.",
  "- The website is read-only. Weather observations are maintained by scheduled Worker updates, not by agents.",
  "- Machine-readable HTTP API catalog: " + BASE + "/.well-known/api-catalog",
  "",
].join("\n");

const ARD = {
  specVersion: "0.9",
  host: {
    displayName: "Kościelec Weather",
    identifier: "weather.bartek.lol",
    documentationUrl: "https://github.com/travnie/twojstar/tree/main/weather-feed",
  },
  entries: [
    {
      "@context": "https://agenticresourcediscovery.org/context/v1",
      identifier: "urn:air:weather.bartek.lol:api:state",
      displayName: "Kościelec live weather HTTP API",
      type: "application/linkset+json",
      url: BASE + "/.well-known/api-catalog",
      description: "Read-only multi-source weather state, air quality, IMGW alerts and health.",
      capabilities: ["weather-state", "warnings", "weather-changes"],
      representativeQueries: ["What is the weather in Kościelec, Chrzanów?", "Are there active IMGW warnings near Chrzanów?"],
    },
    {
      "@context": "https://agenticresourcediscovery.org/context/v1",
      identifier: "urn:air:weather.bartek.lol:browser:webmcp",
      displayName: "Kościelec Weather browser tool",
      type: "text/html",
      url: BASE + "/",
      description: "WebMCP read_weather_state on supporting browser hosts.",
      capabilities: ["read_weather_state"],
      representativeQueries: ["Read Kościelec weather from the browser", "Check local air quality"],
    },
  ],
};

const API_CATALOG = {
  linkset: [{
    anchor: BASE + "/state.json",
    "service-desc": [{ href: BASE + "/openapi.json", type: "application/json" }],
    "service-doc": [{ href: BASE + "/llms-full.txt", type: "text/plain" }],
    status: [{ href: BASE + "/healthz", type: "application/json" }],
  }],
};

const OPENAPI = {
  openapi: "3.1.0",
  info: { title: "Kościelec Weather public API", version: "1.0.0",
    description: "Public read-only local weather, warning and change feeds. Check /healthz before trusting freshness." },
  servers: [{ url: BASE }],
  paths: {
    "/state.json": { get: { operationId: "getWeatherState",
      responses: { 200: { description: "Latest stored state (may be stale; check /healthz)",
        content: { "application/json": { schema: { type: "object" } } } } } } },
    "/healthz": { get: { operationId: "getWeatherHealth",
      responses: { 200: { description: "Current cycle fresh", content: { "application/json": { schema: { type: "object" } } } },
        503: { description: "Current cycle stale or unavailable" } } } },
    "/feed.atom": { get: { operationId: "getWeatherChanges", responses: {
      200: { description: "Meaningful weather and alert changes as Atom",
        content: { "application/atom+xml": { schema: { type: "string" } } } },
    } } },
    "/warnings.atom": { get: { operationId: "getImgwWarningChanges", responses: {
      200: { description: "IMGW warning changes as Atom",
        content: { "application/atom+xml": { schema: { type: "string" } } } },
    } } },
  },
};

async function skillIndex(): Promise<object> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SKILL));
  const digest = Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [{
      name: "koscielec-weather", type: "skill-md",
      description: "Read current Kościelec/Chrzanów weather, alerts and weather changes.",
      url: "/.well-known/agent-skills/koscielec-weather/SKILL.md",
      digest: "sha256:" + digest,
    }],
  };
}

export const AGENT_DISCOVERY_LINK = '</.well-known/ard.json>; rel="ard"; type="application/ard+json", '
  + '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"';

export async function weatherAgentDiscovery(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const types: Record<string, string> = {
    "/.well-known/ard.json": "application/ard+json",
    "/.well-known/ai-catalog.json": "application/ai-catalog+json",
    "/.well-known/api-catalog": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
    "/openapi.json": "application/json",
    "/.well-known/agent-skills/index.json": "application/json",
    "/.well-known/agent-skills/koscielec-weather/SKILL.md": "text/markdown",
  };
  const type = types[path];
  if (!type) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const body = path.endsWith("/SKILL.md") ? SKILL
    : JSON.stringify(path.endsWith("/ard.json") || path.endsWith("/ai-catalog.json") ? ARD
      : path.endsWith("/api-catalog") ? API_CATALOG
        : path.endsWith("/index.json") ? await skillIndex() : OPENAPI, null, 2) + "\n";
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "content-type": type + "; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      ...(path.endsWith("/api-catalog") ? { link: '</.well-known/api-catalog>; rel="api-catalog"' } : {}),
    },
  });
}
