export type BenchProduct = "codebench" | "docbench" | "streambench";

const CONFIG = {
  codebench: {
    name: "Code Bench",
    host: "codebench.bartek.lol",
    description: "Local-only QR/barcode creation and scanning through browser WebMCP; no remote user-payload processing.",
    tools: ["read_code_state", "set_qr_code", "set_barcode", "export_code"],
    prompt: "Create a QR code using Code Bench in my browser",
  },
  docbench: {
    name: "Doc Bench",
    host: "docbench.bartek.lol",
    description: "Local-first document and PDF workspace with opt-in browser WebMCP access; no server-side document API.",
    tools: ["read_document", "set_document_text", "validate_document", "format_document"],
    prompt: "Validate an open local document in Doc Bench",
  },
  streambench: {
    name: "Streambench",
    host: "streambench.bartek.lol",
    description: "Browser playback and playlist management plus read-only provider discovery HTTP APIs.",
    tools: ["read_stream_state", "search_streams", "start_stream_playback", "stop_stream_playback"],
    prompt: "Find a radio station through Streambench",
  },
} as const;

function skill(product: BenchProduct): string {
  const cfg = CONFIG[product];
  const base = "https://" + cfg.host;
  const capabilities = product === "codebench" ? [
    "Manipulate visible QR and barcode editor state using Code Bench WebMCP tools.",
    "Keep QR payloads, personal data and camera frames inside the local browser.",
    "No server-side QR generation API; never send user payloads to a remote discovery endpoint.",
  ] : product === "docbench" ? [
    "Use Doc Bench WebMCP only with the current user's open browser document/workspace.",
    "Document text may be returned to the calling agent only through an explicit tool call.",
    "Do not send private documents to any remote endpoint. No server-side PDF/document API.",
  ] : [
    "Use browser WebMCP for the active playback state and loaded playlist.",
    "Public GET /api/providers discovers supported provider IDs; GET /api/catalog?provider=<id> reads a provider catalog.",
    "GET /api/playlist?provider=<id> returns an allowed provider playlist; this is not a general streaming proxy.",
    "Do not submit arbitrary URLs to the relay. The Worker verifies provider allowlists/signatures.",
  ];
  return [
    "---",
    "name: " + product + "-browser-tools",
    "description: " + cfg.description,
    "---",
    "",
    "# " + cfg.name + " agent access",
    "",
    ...capabilities.map((line) => "- " + line),
    "",
    "Available tools (where document.modelContext is supported): " + cfg.tools.join(", ") + ".",
    "Open " + base + "/ and use browser WebMCP; a plain remote HTTP client cannot invoke those tools.",
    "Full guide: " + base + "/llms-full.txt",
    "",
  ].join("\n");
}

function ardcatalog(product: BenchProduct): object {
  const cfg = CONFIG[product];
  const base = "https://" + cfg.host;
  const entries: Array<Record<string, unknown>> = [{
    "@context": "https://agenticresourcediscovery.org/context/v1",
    identifier: "urn:air:" + cfg.host + ":browser:webmcp",
    displayName: cfg.name + " browser tools",
    type: "text/html",
    url: base + "/",
    description: cfg.description,
    capabilities: [...cfg.tools],
    representativeQueries: [cfg.prompt, "Which agent tools does " + cfg.name + " expose?"],
  }];
  if (product === "streambench") entries.push({
    "@context": "https://agenticresourcediscovery.org/context/v1",
    identifier: "urn:air:" + cfg.host + ":api:providers",
    displayName: "Streambench public provider API",
    type: "application/linkset+json",
    url: base + "/.well-known/api-catalog",
    description: "Public read-only provider registry and constrained playlists.",
    capabilities: ["provider-discovery", "provider-catalog"],
    representativeQueries: ["List supported Streambench providers", "Find a public radio catalog"],
  });
  return {
    specVersion: "0.9",
    host: {
      displayName: cfg.name,
      identifier: cfg.host,
      documentationUrl: "https://github.com/travnie/twojstar/tree/main/benches/" + product,
    },
    entries,
  };
}

function streamApiCatalog(): object {
  const base = "https://streambench.bartek.lol";
  return { linkset: [{
    anchor: base + "/api/providers",
    "service-desc": [{ href: base + "/openapi.json", type: "application/json" }],
    "service-doc": [{ href: base + "/llms-full.txt", type: "text/plain" }],
    status: [{ href: base + "/health", type: "application/json" }],
  }] };
}

function streamOpenApi(): object {
  const response = (description: string, mediaType = "application/json") => ({
    "200": { description, content: { [mediaType]: { schema: { type: mediaType === "application/json" ? "object" : "string" } } } },
  });
  return {
    openapi: "3.1.0",
    info: { title: "Streambench public provider API", version: "1.0.0",
      description: "Read-only provider registry, catalogs and bounded provider playlists; not an open relay." },
    servers: [{ url: "https://streambench.bartek.lol" }],
    paths: {
      "/api/providers": {
        get: { operationId: "listProviders", responses: response("Provider registry") },
      },
      "/api/catalog": {
        get: {
          operationId: "getProviderCatalog",
          parameters: [{ name: "provider", in: "query", required: true, schema: { type: "string" } }],
          responses: response("Catalog for an allowlisted provider"),
        },
      },
      "/api/playlist": {
        get: {
          operationId: "getProviderPlaylist",
          description: "Provider-specific type and id parameters may be required; no arbitrary URL relay.",
          parameters: [
            { name: "provider", in: "query", required: true, schema: { type: "string" } },
            { name: "type", in: "query", required: false, schema: { type: "string" } },
            { name: "id", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: response("Provider playlist", "application/vnd.apple.mpegurl"),
        },
      },
      "/health": {
        get: { operationId: "streambenchHealth", responses: response("Worker health") },
      },
    },
  };
}

async function skillIndex(product: BenchProduct): Promise<object> {
  const text = skill(product);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hex = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [{
      name: product + "-browser-tools",
      type: "skill-md",
      description: CONFIG[product].description,
      url: "/.well-known/agent-skills/" + product + "-browser-tools/SKILL.md",
      digest: "sha256:" + hex,
    }],
  };
}

export function agentDiscoveryLink(product: BenchProduct): string {
  return '</.well-known/ard.json>; rel="ard"; type="application/ard+json"'
    + (product === "streambench"
      ? ', </.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"'
      : "");
}

export async function benchDiscoveryResponse(request: Request, product: BenchProduct): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const isSkill = path === "/.well-known/agent-skills/" + product + "-browser-tools/SKILL.md";
  const types: Record<string, string> = {
    "/.well-known/ard.json": "application/ard+json",
    "/.well-known/ai-catalog.json": "application/ai-catalog+json",
    "/.well-known/agent-skills/index.json": "application/json",
    ...(product === "streambench" ? {
      "/.well-known/api-catalog": 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
      "/openapi.json": "application/json",
    } : {}),
  };
  const type = isSkill ? "text/markdown" : types[path];
  if (!type) return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
  }
  const body = isSkill ? skill(product)
    : JSON.stringify(path.endsWith("/ard.json") || path.endsWith("/ai-catalog.json") ? ardcatalog(product)
      : path.endsWith("/index.json") ? await skillIndex(product)
        : path.endsWith("/api-catalog") ? streamApiCatalog()
          : streamOpenApi(), null, 2) + "\n";
  return new Response(request.method === "HEAD" ? null : body, {
    headers: {
      "content-type": type + "; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      ...(path === "/.well-known/api-catalog" ? { link: '</.well-known/api-catalog>; rel="api-catalog"' } : {}),
    },
  });
}
