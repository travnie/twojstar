import { benchDiscoveryResponse, agentDiscoveryLink } from "../../shared/agent-discovery";

const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; "),
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const discovery = await benchDiscoveryResponse(request, "docbench");
    if (discovery) return discovery;
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    const { headers } = response;
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    const pathname = new URL(request.url).pathname;
    const isHtml = asset.ok && headers.get("content-type")?.includes("text/html");
    const isCachedHtml = asset.status === 304 && (
      headers.get("content-type")?.includes("text/html") || pathname === "/" || pathname === "/index.html"
    );
    const isQpdfWorker = (asset.ok || asset.status === 304) && pathname === "/vendor/qpdf-run/worker.js";
    if (isHtml || isCachedHtml || isQpdfWorker) {
      headers.set("content-security-policy", SECURITY_HEADERS["content-security-policy"].replace(
        "script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      ));
    }

    // URL opening needs HTTPS; script injection could also use this connection policy.
    if (isHtml || isCachedHtml) {
      const policy = headers.get("content-security-policy") || "";
      headers.set("content-security-policy", policy.replace("connect-src 'self'", "connect-src 'self' https:"));
    }

    if (isHtml) {
      headers.set("cache-control", "no-cache");
      headers.set(
        "link",
        '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="alternate"; type="text/plain", </llms.txt>; rel="describedby"' + ', ' + agentDiscoveryLink("docbench"),
      );
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
