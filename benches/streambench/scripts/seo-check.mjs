import { readFile } from "node:fs/promises";

const projectUrl = new URL("../", import.meta.url);
const publicUrl = new URL("public/", projectUrl);

async function text(path) {
  return readFile(new URL(path, publicUrl), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [
  index,
  robots,
  sitemap,
  llms,
  llmsFull,
  indexMarkdown,
  manifestSource,
  socialImage,
  notFound,
  staticHeaders,
  wranglerSource,
  webmcp,
] = await Promise.all([
  text("index.html"),
  text("robots.txt"),
  text("sitemap.xml"),
  text("llms.txt"),
  text("llms-full.txt"),
  text("index.md"),
  text("site.webmanifest"),
  text("og.svg"),
  text("404.html"),
  text("_headers"),
  readFile(new URL("wrangler.jsonc", projectUrl), "utf8"),
  text("webmcp.js"),
]);

const origin = "https://streambench.travny.workers.dev";
assert(index.includes(`<link rel="canonical" href="${origin}/">`), "canonical URL is missing");
assert(index.includes(`<meta property="og:url" content="${origin}/">`), "Open Graph URL is missing");
assert(index.includes('<meta name="twitter:card" content="summary_large_image">'), "Twitter card is missing");
assert(index.includes("max-image-preview:large"), "crawler preview directives are missing");
assert(index.includes('<link rel="sitemap" type="application/xml" href="/sitemap.xml">'), "sitemap link is missing");
assert(index.includes('<link rel="alternate" type="text/markdown" href="/index.md"'), "Markdown alternate is missing");
assert(index.includes('<link rel="alternate" type="text/plain" href="/llms.txt"'), "llms.txt alternate discovery link is missing");
assert(index.includes('<link rel="describedby" href="/llms.txt"'), "llms.txt describedby link is missing");
assert(index.includes('application/ld+json'), "JSON-LD is missing");

assert(robots.includes(`Sitemap: ${origin}/sitemap.xml`), "robots sitemap URL is missing");
assert(robots.includes("Content-Signal: ai-train=yes, search=yes, ai-input=yes"), "robots Content-Signal policy is missing");
assert(robots.includes("Disallow: /api/"), "API crawler rule is missing");
assert(sitemap.includes(`<loc>${origin}/</loc>`), "sitemap application URL is missing");
assert(llms.includes("# Streambench"), "llms.txt title is missing");
const durable = "https://streambench.travny.workers.dev";
for (const [label, route] of [
  ["Application", "/index.md"],
  ["Full LLM guide", "/llms-full.txt"],
  ["Health", "/health"],
  ["Provider manifest", "/api/providers"],
]) {
  assert(llms.includes(`- [${label}](${durable}${route})`), `llms.txt machine link is stale: ${label}`);
}
assert(llmsFull.includes(`Source: ${durable}/`), "llms-full.txt durable origin is missing");
assert(indexMarkdown.includes(`- [Application](${durable}/)`), "Markdown guide durable application link is missing");
assert(llmsFull.startsWith("# Streambench full documentation"), "llms-full.txt title is missing");
assert(indexMarkdown.startsWith("# Streambench"), "index.md title is missing");
assert(llms.split("\n").some(line => line === "- [TRAVNY hub](https://travny.pages.dev/): family landing page."), "TRAVNY hub is missing from llms.txt");
assert(index.includes("https://travny.pages.dev/#creator"), "JSON-LD creator identity is stale");
assert(index.includes("https://travny.pages.dev/#website"), "JSON-LD parent identity is stale");
assert(index.includes('<script src="/webmcp-lifecycle.js"></script>'), "WebMCP lifecycle script is missing");
assert(index.includes('<script type="module" src="/webmcp.js"></script>'), "WebMCP page module is missing");
for (const toolName of ["read_stream_state", "search_streams", "start_stream_playback", "stop_stream_playback"]) {
  assert(webmcp.includes(`name: "${toolName}"`), `WebMCP module is missing tool: ${toolName}`);
}

const manifest = JSON.parse(manifestSource);
assert(manifest.id === "/", "manifest id is missing");
assert(manifest.lang === "pl", "manifest language is missing");
assert(manifest.categories?.includes("utilities"), "manifest category is missing");
assert(socialImage.includes('viewBox="0 0 1200 630"'), "social preview dimensions are invalid");
assert(/>streambench\.travny\.workers\.dev<\/text>/u.test(socialImage), "social preview canonical domain label is missing");

const wrangler = JSON.parse(wranglerSource);
const workerRoutes = wrangler.assets?.run_worker_first;
assert(wrangler.assets?.not_found_handling === "404-page", "404 asset handling is missing");
assert(Array.isArray(workerRoutes), "Worker asset routing is not selective");
assert(workerRoutes.includes("/"), "homepage does not run through Worker for discovery headers");
assert(workerRoutes.includes("/index.html"), "index alias does not run through Worker");
assert(workerRoutes.includes("/api/*"), "API routes do not run through Worker");
assert(workerRoutes.includes("/health"), "health route does not run through Worker");
assert(!workerRoutes.includes("/*"), "all static assets still run through Worker");
assert(notFound.includes('<meta name="robots" content="noindex">'), "404 page can be indexed");
assert(staticHeaders.includes("Content-Security-Policy:"), "static CSP is missing");
assert(staticHeaders.includes("X-Frame-Options: DENY"), "static frame protection is missing");

console.log("SEO and discovery checks passed");
