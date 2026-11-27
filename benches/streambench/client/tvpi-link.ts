const TVPI_HUB = "https://bartek.lol/tv/";
const TVPI_WORKER = "https://tvpi.travny.workers.dev/";

export function tvpiLink(fragment: string) {
  const slug = new URLSearchParams(fragment.slice(1)).get("tvpi");
  return slug && /^[a-z0-9-]{1,32}$/.test(slug)
    ? { slug, url: TVPI_HUB + slug + ".m3u8", legacyUrl: TVPI_WORKER + slug + ".m3u8" }
    : null;
}
