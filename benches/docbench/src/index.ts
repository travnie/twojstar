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
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    const isHtml = asset.ok && headers.get("content-type")?.includes("text/html");
    const isQpdfWorker = asset.ok && new URL(request.url).pathname === "/vendor/qpdf-run/worker.js";
    if (isHtml || isQpdfWorker) {
      headers.set("content-security-policy", SECURITY_HEADERS["content-security-policy"].replace(
        "script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      ));
    }

    if (isHtml) {
      headers.set("cache-control", "no-cache");
      headers.set(
        "link",
        '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="alternate"; type="text/plain", </llms.txt>; rel="describedby"',
      );
    }

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
