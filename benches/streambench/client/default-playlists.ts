import {
  dedupePlaylist,
  parseM3uWorkspace,
  serializeM3u,
  type PlaylistItem,
} from "./playlist-format.ts";

const TVPI_BASE = "https://bartek.lol/tv/";

export function tvpiStreamFromFragment(fragment: string): string | null {
  const slug = new URLSearchParams(fragment.slice(1)).get("tvpi");
  return slug && /^[a-z0-9-]{1,32}$/.test(slug) ? new URL(slug + ".m3u8", TVPI_BASE).href : null;
}

type DefaultPlaylist = {
  path: string;
  defaultRadio: boolean;
  direct?: boolean;
};

declare global {
  interface Window {
    streambenchBundledUrls: Set<string>;
  }
}

const DEFAULT_PLAYLISTS: DefaultPlaylist[] = [
  { path: "/playlists/iptv.m3u8", defaultRadio: false },
  { path: "/playlists/internet_radio.m3u8", defaultRadio: true },
  { path: TVPI_BASE + "playlist.m3u", defaultRadio: false, direct: true },
];

async function readPlaylist(source: DefaultPlaylist): Promise<PlaylistItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(source.path, {
      headers: { accept: "audio/x-mpegurl,text/plain" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${source.path} returned ${response.status}`);

    const text = (await response.text()).replace(/^\uFEFF/, "").trim();
    if (!text.startsWith("#EXTM3U")) {
      throw new Error(`${source.path} is not an M3U playlist`);
    }

    return parseM3uWorkspace(text, {
      providerId: source.direct ? "tvpi" : "bundled",
      providerLabel: source.direct ? "TVPI" : "Wbudowane",
      defaultRadio: source.defaultRadio,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function loadDefaults(): Promise<void> {
  const textarea = document.querySelector<HTMLTextAreaElement>("#playlistText");
  const parseButton = document.querySelector<HTMLButtonElement>("#parsePlaylist");
  const entryCount = document.querySelector<HTMLElement>("#entryCount");
  if (!textarea || !parseButton) return;

  const sources = await Promise.allSettled(DEFAULT_PLAYLISTS.map(readPlaylist));
  for (const [index, result] of sources.entries()) {
    if (result.status === "rejected") {
      console.warn(`Streambench skipped ${DEFAULT_PLAYLISTS[index].path}`, result.reason);
    }
  }

  const itemsBySource = sources.map((result) => result.status === "fulfilled" ? result.value : []);
  const items = dedupePlaylist(itemsBySource.flat());
  window.streambenchBundledUrls = new Set(itemsBySource
    .flatMap((entries, index) => DEFAULT_PLAYLISTS[index].direct ? [] : entries)
    .map((item) => item.url));
  if (Number(entryCount?.textContent || 0) > 0 || textarea.value.trim()) return;

  if (items.length) {
    textarea.value = serializeM3u(items, { dedupe: false });
    parseButton.click();
    queueMicrotask(() => {
      textarea.value = "";
    });
  } else {
    console.warn("Streambench default playlists are unavailable");
  }

  const linkedStream = tvpiStreamFromFragment(location.hash);
  const input = document.querySelector<HTMLInputElement>("#streamUrl");
  if (!linkedStream || !input?.form || input.value.trim()) return;

  const index = items.findIndex((item) => item.url === linkedStream);
  const action = document.querySelector<HTMLButtonElement>(
    `#playlistEntries button.entry-action[data-playlist-index="${index}"]`,
  );
  if (action) {
    action.click();
  } else {
    input.value = linkedStream;
    input.form.requestSubmit();
  }
}

if (typeof document !== "undefined") {
  loadDefaults().catch((error: unknown) => {
    console.warn("Streambench could not load its default playlists", error);
  });
}
