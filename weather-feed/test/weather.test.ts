import assert from "node:assert/strict";
import test from "node:test";
import { FEED_ID, renderAtom, warningEntries } from "../src/feed";
import worker, { completePendingCurrent, pushEntries } from "../src/index";
import { renderPage } from "../src/page";
import { fetchOpenMeteo, fetchOpenWeather, fetchPirateWeather, type Env } from "../src/sources";
import type { CurrentState, FeedEntry, Warning } from "../src/types";
import {
  reconcileWarnings, warningEndTimeMs,
} from "../src/warnings";

const meteo: Warning = {
  id: "meteo:1", category: "meteo", event: "Burze", level: 2,
  probability: 80, from: "2026-07-22T12:00:00",
  to: "2026-07-22T18:00:00", content: "Burze z gradem",
};
const hydro: Warning = {
  id: "hydro:1", category: "hydro",
  event: "Gwałtowne wzrosty stanów wody", level: 1,
  probability: null, from: null, to: null, content: "Możliwe wzrosty",
};
const beforeExpiry = Date.parse("2026-07-22T15:00:00Z");


test("Pirate Weather keeps the API key out of the URL and normalizes SI data", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let sentKey: string | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    sentKey = new Headers(init?.headers).get("apikey");
    return new Response(JSON.stringify({
      currently: {
        time: 1790160000,
        temperature: 12.3,
        apparentTemperature: 11.1,
        humidity: 0.81,
        pressure: 1018.4,
        windSpeed: 3.4,
        windBearing: 180,
        precipIntensity: 0.2,
        uvIndex: 1.2,
        icon: "rain",
      },
      daily: {
        data: [{
          time: 1790121600,
          temperatureMax: 15.4,
          temperatureMin: 7.6,
          precipAccumulation: 0.75,
          precipProbability: 0.7,
          precipType: "rain",
          uvIndex: 2.3,
          icon: "partly-cloudy-day",
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const result = await fetchPirateWeather({ PIRATEWEATHER_API_KEY: "super-secret" } as Env);
    assert.equal(sentKey, "super-secret");
    assert.doesNotMatch(requestedUrl, /super-secret/);
    assert.match(requestedUrl, /units=si/);
    assert.equal(result.current?.source, "pirateweather");
    assert.equal(result.current?.humidity, 81);
    assert.equal(result.current?.windMs, 3.4);
    assert.equal(result.current?.condition, "rain");
    assert.equal(result.days[0]?.precipMm, 7.5);
    assert.equal(result.days[0]?.precipProb, 70);
    assert.equal(result.days[0]?.condition, "clouds");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed IMGW category preserves its previous warnings", () => {
  const next = reconcileWarnings(
    [meteo, hydro],
    { warnings: [], succeeded: ["meteo"] },
    beforeExpiry,
  );
  assert.deepEqual(next, [hydro]);
  const entries = warningEntries([meteo, hydro], next);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.kind, "warning_lifted");
  assert.match(entries[0]?.title ?? "", /Burze/);
  assert.doesNotMatch(entries[0]?.title ?? "", /wzrosty/);
});

test("total IMGW outage preserves warnings before their end time", () => {
  const next = reconcileWarnings(
    [meteo, hydro],
    { warnings: [], succeeded: [] },
    beforeExpiry,
  );
  assert.deepEqual(next, [meteo, hydro]);
  assert.deepEqual(warningEntries([meteo, hydro], next), []);
});

test("expired warning is dropped even while IMGW is unavailable", () => {
  const afterExpiry = Date.parse("2026-07-22T16:01:00Z");
  const next = reconcileWarnings(
    [meteo, hydro],
    { warnings: [], succeeded: [] },
    afterExpiry,
  );
  assert.deepEqual(next, [hydro]);
});

test("IMGW wall time is interpreted in Europe/Warsaw", () => {
  assert.equal(
    warningEndTimeMs("2026-07-22 18:00:00"),
    Date.parse("2026-07-22T16:00:00Z"),
  );
});

test("expired warning entry says it expired rather than was cancelled", () => {
  const expired = { ...meteo, to: "2000-01-01T12:00:00Z" };
  const [entry] = warningEntries([expired], []);
  assert.match(entry?.title ?? "", /wygasło/);
  assert.doesNotMatch(entry?.title ?? "", /odwołano/);
});

test("warnings feed has its own id and self URL", () => {
  const xml = renderAtom(
    [], "Warnings", "https://weather.example",
    "/warnings.atom", `${FEED_ID}:warnings`,
  );
  assert.match(
    xml,
    /<id>tag:travny,2026:weather:koscielec:warnings<\/id>/,
  );
  assert.match(
    xml,
    /rel="self" href="https:\/\/weather\.example\/warnings\.atom"/,
  );
  assert.doesNotMatch(
    xml,
    /rel="self" href="https:\/\/weather\.example\/feed\.atom"/,
  );
});

test("Atom entries link to individual, readable event pages", async () => {
  const entry: FeedEntry = {
    id: `${FEED_ID}:current:2026-11-20T12:00:00Z`,
    kind: "current_change",
    title: "Test <weather>",
    summary: "Changed & updated.",
    published: "2026-11-20T12:00:00.000Z",
  };
  const xml = renderAtom([entry], "Weather", "https://weather.bartek.lol");
  const path = "/events/" + encodeURIComponent(entry.id);
  const entryXml = xml.match(/<entry>[\s\S]*?<\/entry>/)?.[0] ?? "";
  assert.ok(entryXml.includes(`<link rel="alternate" href="https://weather.bartek.lol${path}"/>`));

  const env = {
    WEATHER_KV: { get: async (key: string) => key === "entries" ? [entry] : null },
  } as unknown as Env;
  const response = await worker.fetch(new Request("https://weather.bartek.lol" + path), env);
  assert.equal(response.status, 200);
  const page = await response.text();
  assert.match(page, /Test &lt;weather&gt;/);
  assert.match(page, /Changed &amp; updated\./);
  assert.ok(page.includes(`rel="canonical" href="https://weather.bartek.lol${path}"`));

  const unknown = await worker.fetch(new Request("https://weather.bartek.lol/events/not-found"), env);
  assert.equal(unknown.status, 404);
});

test("Atom responses support stable validators and conditional GET", async () => {
  const entry: FeedEntry = {
    id: "test-etag", kind: "current_change", title: "Weather update",
    summary: "Update", published: "2026-11-20T12:00:00.000Z",
  };
  const env = {
    WEATHER_KV: { get: async (key: string) => key === "entries" ? [entry] : null },
  } as unknown as Env;
  const url = "https://weather.bartek.lol/feed.atom";
  const initial = await worker.fetch(new Request(url), env);
  assert.equal(initial.status, 200);
  const tag = initial.headers.get("etag");
  assert.match(tag ?? "", /^"[0-9a-f]{64}"$/);
  assert.equal(initial.headers.get("last-modified"), "Fri, 20 Nov 2026 12:00:00 GMT");
  const etagHit = await worker.fetch(new Request(url, { headers: { "if-none-match": tag! } }), env);
  assert.equal(etagHit.status, 304);
  assert.equal(await etagHit.text(), "");
  assert.equal(etagHit.headers.get("etag"), tag);

  const dateHit = await worker.fetch(new Request(url, { headers: { "if-modified-since": "Fri, 20 Nov 2026 12:00:00 GMT" } }), env);
  assert.equal(dateHit.status, 304);
  const wrongTag = await worker.fetch(new Request(url, { headers: {
    "if-none-match": '"wrong"',
    "if-modified-since": "Fri, 20 Nov 2026 12:00:00 GMT",
  } }), env);
  assert.equal(wrongTag.status, 200);
  assert.equal(await wrongTag.text(), await initial.text());
  const quotedComma = await worker.fetch(new Request(url, {
    headers: { "if-none-match": '"not,*,matching"' },
  }), env);
  assert.equal(quotedComma.status, 200);

  const modifiedEnv = {
    WEATHER_KV: { get: async (key: string) => key === "entries"
      ? [{ ...entry, summary: "New content" }] : null },
  } as unknown as Env;
  const modified = await worker.fetch(new Request(url), modifiedEnv);
  assert.notEqual(modified.headers.get("etag"), tag);
});

test("KV metadata uses whole-second revision dates and date validators can return 304", async () => {
  const entry: FeedEntry = {
    id:"rev", kind:"current_change", title:"Update",
    summary:"First", published:"2026-11-20T12:00:00.000Z",
  };
  let metadata = { updatedAt:"2026-11-20T12:00:00.123Z", warningsUpdatedAt:"2026-11-20T12:00:00.123Z" };
  const store = new Map([["entries",JSON.stringify([entry])]]);
  const kv = {
    async get(key: string) { return JSON.parse(store.get(key) || "null"); },
    async getWithMetadata(key: string) {
      return { value: JSON.parse(store.get(key) || "null"), metadata };
    },
    async put(key: string, value: string, options?: { metadata?: typeof metadata }) {
      store.set(key,value);
      if(options?.metadata) metadata=options.metadata;
    },
  } as unknown as KVNamespace;
  const env = { WEATHER_KV:kv } as Env;
  await pushEntries(env, [{ ...entry, id:"rev2", published:"2026-11-20T12:01:00.000Z" }]);
  assert.equal(Date.parse(metadata.updatedAt) % 1000,0);
  const url = "https://weather.bartek.lol/feed.atom";
  const first = await worker.fetch(new Request(url),env);
  const lastModified=first.headers.get("last-modified");
  assert.ok(lastModified);
  const second = await worker.fetch(new Request(url, {
    headers: {"if-modified-since":lastModified},
  }), env);
  assert.equal(second.status,304);

  // Two writes in the same wall-clock second still advance Last-Modified.
  await pushEntries(env, [{
    ...entry, id:"rev3", published:"2026-11-20T12:02:00.000Z",
  }]);
  const changed = await worker.fetch(new Request(url, {
    headers: {"if-modified-since":lastModified},
  }), env);
  assert.equal(changed.status,200);
  assert.notEqual(changed.headers.get("last-modified"),lastModified);
  assert.match(await changed.text(), /rev3/);
});

test("empty Atom feeds keep validators stable between polls", async () => {
  const env = { WEATHER_KV: { get: async () => null } } as unknown as Env;
  const url = "https://weather.bartek.lol/warnings.atom";
  const first = await worker.fetch(new Request(url), env);
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const repeat = await worker.fetch(new Request(url, { headers: { "if-none-match": etag } }), env);
  assert.equal(repeat.status, 304);
});

test("weather-only legacy update preserves an unchanged warning feed", async () => {
  const warning: FeedEntry = {
    id: "warning", kind: "warning_new", title: "Warning",
    summary: "Active", published: "2026-11-01T12:00:00.000Z",
  };
  let entries = [warning];
  let metadata: { updatedAt: string; warningsUpdatedAt: string } | null = null;
  const kv = {
    async get(key: string) { return key === "entries" ? entries : null; },
    async getWithMetadata(key: string) {
      return { value: key === "entries" ? entries : null, metadata };
    },
    async put(key: string, json: string, options?: { metadata?: typeof metadata }) {
      if (key === "entries") entries = JSON.parse(json) as FeedEntry[];
      metadata = options?.metadata ?? metadata;
    },
  } as unknown as KVNamespace;
  const env = { WEATHER_KV: kv } as Env;
  const url = "https://weather.bartek.lol/warnings.atom";
  const before = await worker.fetch(new Request(url), env);
  const tag = before.headers.get("etag");
  const previousDate = before.headers.get("last-modified");
  assert.ok(tag);
  assert.ok(previousDate);
  await pushEntries(env, [{
    id: "weather", kind: "current_change", title: "Weather",
    summary: "Changed", published: "2026-11-20T12:00:00.000Z",
  }]);
  const revalidated = await worker.fetch(new Request(url, {
    headers: { "if-none-match": tag },
  }), env);
  assert.equal(revalidated.status, 304);
  assert.equal(revalidated.headers.get("last-modified"), previousDate);
});

test("warning feed Last-Modified changes when pruning removes older warnings", async () => {
  const earlier = "2026-10-01T00:00:00.000Z";
  const store = new Map<string, string>();
  const initial = [{
    id: "old-warning", kind: "warning_new", title: "Old alert",
    summary: "Old", published: "2026-10-01T00:00:00.000Z",
  }, ...Array.from({ length: 59 }, (_, i) => ({
    id: "weather-" + i, kind: "current_change", title: "Weather",
    summary: "Update", published: new Date(Date.parse(earlier) + (i + 1) * 3600000).toISOString(),
  }))] as FeedEntry[];
  let metadata = { updatedAt: earlier, warningsUpdatedAt: earlier };
  store.set("entries", JSON.stringify(initial));
  const kv = {
    async get(key: string) { return JSON.parse(store.get(key) || "null"); },
    async getWithMetadata(key: string) {
      return { value: JSON.parse(store.get(key) || "null"), metadata };
    },
    async put(key: string, value: string, options?: { metadata?: typeof metadata }) {
      store.set(key, value);
      if (options?.metadata) metadata = options.metadata;
    },
  } as unknown as KVNamespace;
  const env = { WEATHER_KV: kv } as Env;
  const url = "https://weather.bartek.lol/warnings.atom";
  const before = await worker.fetch(new Request(url), env);
  assert.match(await before.text(), /Old alert/);
  await pushEntries(env, [{
    id: "new-weather", kind: "current_change", title: "Fresh update",
    summary: "Update", published: "2026-11-20T12:00:00.000Z",
  }]);
  const after = await worker.fetch(new Request(url, {
    headers: { "if-modified-since": before.headers.get("last-modified")! },
  }), env);
  assert.equal(after.status, 200);
  assert.doesNotMatch(await after.text(), /Old alert/);
  assert.notEqual(after.headers.get("last-modified"), before.headers.get("last-modified"));
});

test("weather page advertises its canonical and llms surface", () => {
  const html = renderPage("https://weather.trfny.com");
  assert.match(html, /rel="canonical" href="https:\/\/weather\.trfny\.com\/"/);
  assert.match(html, /rel="alternate" type="text\/markdown" href="\/index\.md"/);
  assert.match(html, /rel="alternate" type="text\/plain" href="\/llms\.txt"/);
  assert.match(html, /rel="describedby" href="\/llms\.txt"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /<script src="\/webmcp\.js" defer><\/script>/);
  assert.match(html, /Powered by Vaisala Xweather/);
  assert.match(html, /Pirate Weather/);
  assert.match(html, /href="https:\/\/www\.xweather\.com\/"/);
  assert.match(html, /href="https:\/\/bartek\.lol\/"/);
  const schemaScript = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(schemaScript);
  const schema = JSON.parse(schemaScript[1]);
  assert.equal(schema.creator["@id"], "https://bartek.lol/#creator");
  assert.equal(schema.isPartOf["@id"], "https://bartek.lol/#website");
});

test("weather page collapses long warning and change lists and keeps feed controls near the footer", () => {
  const warnings = Array.from({ length: 4 }, (_, index): Warning => ({
    id: `meteo:${index}`,
    category: "meteo",
    event: `Test ${index + 1}`,
    level: 1,
    probability: 80,
    from: "2026-09-28T10:00:00Z",
    to: "2026-09-28T12:00:00Z",
    content: "Test warning",
  }));
  const entries = Array.from({ length: 4 }, (_, index): FeedEntry => ({
    id: `entry:${index}`,
    kind: "current_change",
    title: `Change ${index + 1}`,
    summary: "Test change",
    published: `2026-09-28T0${index}:00:00.000Z`,
  }));
  const html = renderPage(
    "https://weather.trfny.com",
    { warnings } as unknown as CurrentState,
    entries,
  );

  assert.equal((html.match(/class="warn list-extra/g) ?? []).length, 1);
  assert.equal((html.match(/class="entry list-extra/g) ?? []).length, 1);
  assert.equal((html.match(/Pokaż więcej \(1\)/g) ?? []).length, 2);

  const controls = html.indexOf('<div class="btns">');
  const changes = html.indexOf('id="entries"');
  const footer = html.indexOf("<footer>");
  assert.ok(changes >= 0 && controls > changes);
  assert.ok(footer > controls);
});

test("workers.dev serves the dashboard without depending on trfny.com", async () => {
  const env = { WEATHER_KV: { get: async () => null } } as unknown as Env;
  const response = await worker.fetch(new Request("https://weather.travny.workers.dev/"), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  const body = await response.text();
  assert.match(body, /<div class="card" id="nowCard" aria-live="polite">/);
  assert.match(body, /rel="canonical" href="https:\/\/weather\.bartek\.lol\//);
});

test("weather discovery routes do not require storage", async () => {
  const expected = {
    "/robots.txt": "https://weather.bartek.lol/sitemap.xml",
    "/webmcp.js": "read_weather_state",
    "/sitemap.xml": "https://weather.bartek.lol/feed.atom",
    "/index.md": "https://weather.bartek.lol/state.json",
    "/llms.txt": "https://weather.bartek.lol/index.md",
    "/llms-full.txt": "https://weather.bartek.lol/state.json",
  };

  for (const [path, expectedUrl] of Object.entries(expected)) {
    const response = await worker.fetch(
      new Request(`https://weather.trfny.com${path}`),
      {} as Env,
    );
    assert.equal(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes(expectedUrl));
    if (path === "/robots.txt") {
      assert.match(body, /Content-Signal: ai-train=yes, search=yes, ai-input=yes/);
      assert.match(body, /User-agent: OAI-SearchBot/);
      assert.match(body, /User-agent: Claude-SearchBot/);
      assert.match(body, /User-agent: PerplexityBot/);
    }
    if (path === "/webmcp.js") {
      assert.match(body, /document\.modelContext/);
      assert.match(body, /registerTool\(tool, \{ signal: lifecycle\.signal \}\)/);
      assert.match(body, /additionalProperties: false/);
    }
  }
});

test("both dashboard aliases use durable canonicals and keep Atom identities", async () => {
  const origin = "https://weather.bartek.lol";
  const entry: FeedEntry = {
    id: `${FEED_ID}:warn:1:new`, kind: "warning_new", title: "Weather warning",
    summary: "An existing warning", published: "2026-10-01T12:00:00.000Z",
  };
  const env = { WEATHER_KV: { get: async (key: string) => key === "entries" ? [entry] : null } } as unknown as Env;
  for (const host of [origin, "https://weather.trfny.com"]) {
    const dashboard = await worker.fetch(new Request(`${host}/`), env);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get("location"), null);
    assert.ok((await dashboard.text()).includes(`<link rel="canonical" href="${origin}/">`));
    for (const path of ["/feed.atom", "/warnings.atom"]) {
      const response = await worker.fetch(new Request(host + path), env);
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert.ok(xml.includes(`<id>${FEED_ID}${path === "/warnings.atom" ? ":warnings" : ""}</id>`));
      assert.ok(xml.includes(`<id>${entry.id}</id>`));
      assert.ok(xml.includes(`<link rel="self" href="${origin}${path}"/>`));
      assert.ok(xml.includes(`<link rel="alternate" href="${origin}/"/>`));
    }
  }
});


test("pushEntries is idempotent and keeps newest entries first", async () => {
  const store = new Map<string, string>();
  const kv = {
    async get(key: string, type?: string) {
      const value = store.get(key);
      if (value == null) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) { store.set(key, value); },
  } as unknown as KVNamespace;
  const env = { WEATHER_KV: kv } as Env;
  const older: FeedEntry = {
    id: "same", kind: "current_change", title: "old", summary: "old",
    published: "2026-09-05T08:00:00.000Z",
  };
  const newer: FeedEntry = {
    id: "same", kind: "current_change", title: "new", summary: "new",
    published: "2026-09-05T10:00:00.000Z",
  };
  const middle: FeedEntry = {
    id: "middle", kind: "forecast_revision", title: "middle", summary: "middle",
    published: "2026-09-05T09:00:00.000Z",
  };
  store.set("entries", JSON.stringify([older, middle]));
  await pushEntries(env, [newer]);
  const saved = JSON.parse(store.get("entries") ?? "[]") as FeedEntry[];
  assert.deepEqual(saved.map((entry) => entry.id), ["same", "middle"]);
  assert.equal(saved[0]?.title, "new");
  await pushEntries(env, [older]);
  const afterRetry = JSON.parse(store.get("entries") ?? "[]") as FeedEntry[];
  assert.equal(afterRetry[0]?.title, "new");
});


test("pending current transaction retries without duplicating entries", async () => {
  const store = new Map<string, string>();
  let failEntries = true;
  const entry: FeedEntry = {
    id: "pending-current", kind: "current_change", title: "change", summary: "change",
    published: "2026-09-05T10:30:00.000Z",
  };
  store.set("pending:current", JSON.stringify({ entries: [entry], warnings: [meteo] }));
  const kv = {
    async get(key: string, type?: string) {
      const value = store.get(key);
      if (value == null) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key: string, value: string) {
      if (key === "entries" && failEntries) {
        failEntries = false;
        throw new Error("simulated KV failure");
      }
      store.set(key, value);
    },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
  const env = { WEATHER_KV: kv } as Env;

  await assert.rejects(() => completePendingCurrent(env), /simulated KV failure/);
  assert.ok(store.has("pending:current"));
  assert.ok(store.has("warnings:active"));
  assert.equal((JSON.parse(store.get("entries") ?? "[]") as FeedEntry[]).length, 0);

  assert.equal(await completePendingCurrent(env), true);
  assert.ok(!store.has("pending:current"));
  assert.ok(store.has("warnings:active"));
  const entries = JSON.parse(store.get("entries") ?? "[]") as FeedEntry[];
  assert.deepEqual(entries.map((item) => item.id), ["pending-current"]);
});

async function withFetch<T>(handler: (url: string) => Response, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("non-retryable HTTP errors throw instead of silently returning nothing", async () => {
  let calls = 0;
  await withFetch(() => { calls += 1; return new Response("bad key", { status: 401 }); }, async () => {
    await assert.rejects(fetchOpenWeather({ OPENWEATHER_KEY: "dead" } as Env, "current"), /HTTP 401/);
  });
  assert.equal(calls, 1);
});

test("Open-Meteo local wall time is converted to UTC and current mode skips daily data", async () => {
  let requested = "";
  const result = await withFetch((url) => {
    requested = url;
    return Response.json({ utc_offset_seconds: 7200, current: { time: "2026-10-11T14:00", temperature_2m: 12 } });
  }, () => fetchOpenMeteo("current"));
  assert.equal(result.current?.observedAt, "2026-10-11T12:00:00.000Z");
  assert.doesNotMatch(requested, /daily=/);
  assert.deepEqual(result.days, []);
});

test("OpenWeather drops partial forecast days built from too few 3h slots", async () => {
  // 2 slots on Oct 11 (partial), 8 slots on Oct 12 (full), all in Europe/Warsaw (UTC+2).
  const start = Date.parse("2026-10-11T18:00:00Z") / 1000;
  const list = Array.from({ length: 10 }, (_, i) => ({
    dt: start + i * 3 * 3600, main: { temp: 10 + i }, weather: [{ id: 800 }], pop: 0,
  }));
  const result = await withFetch(() => Response.json({ list }), () =>
    fetchOpenWeather({ OPENWEATHER_KEY: "k" } as Env, "forecast"));
  assert.deepEqual(result.days.map((day) => day.date), ["2026-10-12"]);
  assert.equal(result.current, null);
});

test("agent discovery describes real local weather endpoints and hashes the skill artifact", async () => {
  const base = "https://weather.bartek.lol";
  const index = await worker.fetch(new Request(base + "/.well-known/agent-skills/index.json"), {} as Env);
  assert.equal(index.status, 200);
  const skillIndex = await index.json() as { skills: Array<{ digest: string }> };
  const skillRes = await worker.fetch(new Request(base + "/.well-known/agent-skills/koscielec-weather/SKILL.md"), {} as Env);
  assert.equal(skillRes.status, 200);
  const skill = await skillRes.text();
  assert.match(skill, /name: koscielec-weather/u);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(skill));
  assert.equal(skillIndex.skills[0].digest, "sha256:" + [...new Uint8Array(digest)]
    .map((v) => v.toString(16).padStart(2, "0")).join(""));
  const api = await worker.fetch(new Request(base + "/.well-known/api-catalog"), {} as Env);
  assert.match(api.headers.get("content-type") || "", /^application\/linkset\+json/u);
  assert.equal((await api.json() as { linkset: Array<{ anchor: string }> }).linkset[0].anchor, base + "/state.json");
  const head = await worker.fetch(new Request(base + "/.well-known/api-catalog", { method: "HEAD" }), {} as Env);
  assert.equal(head.headers.get("link"), '</.well-known/api-catalog>; rel="api-catalog"');
  assert.equal(await head.text(), "");
  const denied = await worker.fetch(new Request(base + "/openapi.json", { method: "POST" }), {} as Env);
  assert.equal(denied.status, 405);
});
