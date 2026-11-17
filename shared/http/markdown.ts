// Explicit Markdown preference; ordinary browser and wildcard requests stay HTML.
// Split HTTP lists/parameters without regex backtracking on untrusted headers.
function splitQuoted(value: string, separator: string): string[] {
  const parts: string[] = [];
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) escaped = false;
    else if (quoted && char === "\\") escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === separator) {
      parts.push(value.slice(start, i));
      start = i + 1;
    }
  }
  if (!quoted && !escaped) parts.push(value.slice(start));
  return parts;
}

export function prefersMarkdown(accept: string): boolean {
  const types = new Map<string, number>();
  for (const item of splitQuoted(accept.toLowerCase(), ",")) {
    const [type, ...params] = splitQuoted(item.trim(), ";");
    const quality = params.map(p => p.trim()).find(p => p.startsWith("q="));
    const raw = quality?.slice(2).trim();
    // An absent q means 1; explicitly malformed q excludes this media range.
    if (raw !== undefined && !/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)) continue;
    const q = raw === undefined ? 1 : Number(raw);
    if (type) types.set(type.trim(), q);
  }
  const md = types.get("text/markdown") ?? 0;
  return md > 0 && md >= (types.get("text/html") ?? types.get("text/*") ?? types.get("*/*") ?? 0);
}

export function wantsMarkdown(request: Request): boolean {
  return ["GET", "HEAD"].includes(request.method) && prefersMarkdown(request.headers.get("accept") ?? "");
}

export function varyAccept(headers: Headers): void {
  const values = (headers.get("vary") ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (!values.some(v => ["accept", "*"].includes(v.toLowerCase()))) values.push("Accept");
  headers.set("vary", values.join(", "));
}

export function markdownHeaders(headers: Headers): void {
  for (const name of ["content-length", "content-encoding", "etag", "last-modified", "content-range"]) headers.delete(name);
  headers.set("content-type", "text/markdown; charset=utf-8");
  headers.set("cache-control", "private, no-store");
  varyAccept(headers);
}

export async function markdownAsset(request: Request, assets: { fetch(request: Request): Promise<Response> }): Promise<Response | undefined> {
  if (new URL(request.url).pathname !== "/" || !wantsMarkdown(request)) return;
  let response: Response;
  try {
    response = await assets.fetch(new Request(new URL("/index.md", request.url), { method: request.method }));
  } catch (error) {
    console.warn("markdown asset fetch failed", error instanceof Error ? error.name : "unknown");
    return;
  }
  if (!response.ok) return;
  const headers = new Headers(response.headers);
  markdownHeaders(headers);
  return new Response(request.method === "HEAD" ? null : response.body, { headers });
}
