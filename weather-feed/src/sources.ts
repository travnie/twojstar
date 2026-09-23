import { CONFIG } from "./config";
import type {
  AirQuality, Condition, DayForecast, PollenReading, Reading, StationReading, Warning,
} from "./types";

export interface Env {
  WEATHER_KV: KVNamespace;
  OPENWEATHER_KEY?: string;
  VISUALCROSSING_KEY?: string;
  XWEATHER_API_KEY?: string;
  XWEATHER_CLIENT_ID?: string;
  XWEATHER_CLIENT_SECRET?: string;
  PIRATEWEATHER_API_KEY?: string;
}

// ── shared fetch helper (resilient: timeout + retry/backoff + status check) ──
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string, init?: RequestInit): Promise<unknown | null> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= CONFIG.sourceRetries; attempt++) {
    if (attempt > 0) {
      await sleep(CONFIG.retryBaseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * CONFIG.retryBaseMs));
    }
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(CONFIG.sourceTimeoutMs) });
      if (res.ok) return res.json();
      if (RETRYABLE_STATUS.has(res.status)) { lastErr = new Error(`HTTP ${res.status}`); continue; }
      return null;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("getJson exhausted");
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// ── condition normalization ─────────────────────────────────────────────
function wmo(code: number | null): Condition {
  if (code === null) return "unknown";
  if (code === 0) return "clear";
  if (code <= 3) return "clouds";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "storm";
  return "unknown";
}
function owmCond(id: number | null): Condition {
  if (id === null) return "unknown";
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "fog";
  if (id === 800) return "clear";
  if (id > 800) return "clouds";
  return "unknown";
}
function vcCond(icon: unknown): Condition {
  const s = String(icon ?? "");
  if (s.includes("thunder")) return "storm";
  if (s.includes("snow")) return "snow";
  if (s.includes("rain")) return "rain";
  if (s.includes("fog")) return "fog";
  if (s.includes("cloud") || s === "wind") return "clouds";
  if (s.includes("clear")) return "clear";
  return "unknown";
}

function pwCond(value: unknown): Condition {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("thunder")) return "storm";
  if (s.includes("snow") || s.includes("sleet") || s.includes("ice-pellet")) return "snow";
  if (s.includes("drizzle")) return "drizzle";
  if (s.includes("rain") || s.includes("freezing")) return "rain";
  if (s.includes("fog") || s.includes("mist") || s.includes("haze") || s.includes("smoke")) return "fog";
  if (s.includes("clear")) return "clear";
  if (s.includes("cloud") || s.includes("overcast") || s.includes("wind")) return "clouds";
  return "unknown";
}

function xwCond(value: unknown): Condition {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("thunder") || s.includes("storm")) return "storm";
  if (s.includes("snow") || s.includes("sleet")) return "snow";
  if (s.includes("drizzle")) return "drizzle";
  if (s.includes("rain") || s.includes("shower") || s.includes("freezing")) return "rain";
  if (s.includes("fog") || s.includes("mist") || s.includes("haze")) return "fog";
  if (s.includes("clear") || s.includes("sunny") || s.includes("fair")) return "clear";
  if (s.includes("cloud") || s.includes("overcast")) return "clouds";
  return "unknown";
}

const CONDITION_SEVERITY: Record<Condition, number> = {
  storm: 7, snow: 6, rain: 5, drizzle: 4, fog: 3, clouds: 2, clear: 1, unknown: 0,
};
function majorityCondition(conditions: readonly Condition[]): Condition {
  const counts = new Map<Condition, number>();
  for (const condition of conditions) counts.set(condition, (counts.get(condition) ?? 0) + 1);
  let best: Condition = "unknown";
  let bestCount = -1;
  for (const [condition, count] of counts) {
    if (count > bestCount || (count === bestCount && CONDITION_SEVERITY[condition] > CONDITION_SEVERITY[best])) {
      best = condition;
      bestCount = count;
    }
  }
  return best;
}

// ── Open-Meteo (no key) ───────────────────────────────────────────────
export async function fetchOpenMeteo(): Promise<{ current: Reading | null; days: DayForecast[] }> {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(CONFIG.lat));
  u.searchParams.set("longitude", String(CONFIG.lon));
  u.searchParams.set("timezone", CONFIG.tz);
  u.searchParams.set("wind_speed_unit", "ms");
  u.searchParams.set("forecast_days", String(CONFIG.forecastDays));
  u.searchParams.set("current",
    "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,uv_index");
  u.searchParams.set("daily",
    "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,weather_code");

  const data = await getJson(u.toString());
  if (!isObj(data)) return { current: null, days: [] };

  let current: Reading | null = null;
  const c = data["current"];
  if (isObj(c)) {
    current = {
      source: "openmeteo",
      tempC: num(c["temperature_2m"]),
      feelsC: num(c["apparent_temperature"]),
      humidity: num(c["relative_humidity_2m"]),
      pressureHpa: num(c["pressure_msl"]),
      windMs: num(c["wind_speed_10m"]),
      windDir: num(c["wind_direction_10m"]),
      precipMm: num(c["precipitation"]),
      uvIndex: num(c["uv_index"]),
      condition: wmo(num(c["weather_code"])),
      observedAt: typeof c["time"] === "string" ? c["time"] : new Date().toISOString(),
    };
  }

  const days: DayForecast[] = [];
  const d = data["daily"];
  if (isObj(d) && Array.isArray(d["time"])) {
    const time = d["time"] as unknown[];
    const tmax = (d["temperature_2m_max"] ?? []) as unknown[];
    const tmin = (d["temperature_2m_min"] ?? []) as unknown[];
    const psum = (d["precipitation_sum"] ?? []) as unknown[];
    const pprob = (d["precipitation_probability_max"] ?? []) as unknown[];
    const uvmax = (d["uv_index_max"] ?? []) as unknown[];
    const code = (d["weather_code"] ?? []) as unknown[];
    for (let i = 0; i < time.length; i++) {
      days.push({
        source: "openmeteo",
        date: String(time[i]),
        tMaxC: num(tmax[i]), tMinC: num(tmin[i]),
        precipMm: num(psum[i]), precipProb: num(pprob[i]),
        uvIndexMax: num(uvmax[i]),
        condition: wmo(num(code[i])),
      });
    }
  }
  return { current, days };
}

// ── OpenWeather (key; free /data/2.5) ───────────────────────────────────
export async function fetchOpenWeather(env: Env): Promise<{ current: Reading | null; days: DayForecast[] }> {
  const key = env.OPENWEATHER_KEY;
  if (!key) return { current: null, days: [] };
  const q = `lat=${CONFIG.lat}&lon=${CONFIG.lon}&units=metric&appid=${key}`;

  const [currentResult, forecastResult] = await Promise.allSettled([
    getJson(`https://api.openweathermap.org/data/2.5/weather?${q}`),
    getJson(`https://api.openweathermap.org/data/2.5/forecast?${q}`),
  ]);
  let current: Reading | null = null;
  const w = currentResult.status === "fulfilled" ? currentResult.value : null;
  if (isObj(w) && isObj(w["main"]) && Array.isArray(w["weather"])) {
    const m = w["main"] as Record<string, unknown>;
    const wind = isObj(w["wind"]) ? w["wind"] : {};
    const wx = w["weather"][0] as Record<string, unknown> | undefined;
    const rain = isObj(w["rain"]) ? w["rain"] : {};
    current = {
      source: "openweather",
      tempC: num(m["temp"]), feelsC: num(m["feels_like"]),
      humidity: num(m["humidity"]), pressureHpa: num(m["pressure"]),
      windMs: num(wind["speed"]), windDir: num(wind["deg"]),
      precipMm: num(rain["1h"]) ?? 0,
      uvIndex: null,
      condition: owmCond(num(wx?.["id"])),
      observedAt: new Date((num(w["dt"]) ?? Date.now() / 1000) * 1000).toISOString(),
    };
  }

  // Free forecast = 5-day / 3-hour. Roll up to local Europe/Warsaw days.
  const days: DayForecast[] = [];
  const f = forecastResult.status === "fulfilled" ? forecastResult.value : null;
  if (isObj(f) && Array.isArray(f["list"])) {
    type Bucket = { max: number; min: number; precip: number; prob: number; conds: Condition[] };
    const byDay = new Map<string, Bucket>();
    const dateFormatter = new Intl.DateTimeFormat("en", {
      timeZone: CONFIG.tz, year: "numeric", month: "2-digit", day: "2-digit",
    });
    const localDate = (date: Date): string => {
      const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
      return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
    };
    for (const slot of f["list"] as unknown[]) {
      if (!isObj(slot)) continue;
      const epoch = num(slot["dt"]);
      const date = epoch === null ? "" : localDate(new Date(epoch * 1000));
      if (!date) continue;
      const m = isObj(slot["main"]) ? slot["main"] : {};
      const wx = Array.isArray(slot["weather"]) ? (slot["weather"][0] as Record<string, unknown>) : undefined;
      const rain = isObj(slot["rain"]) ? slot["rain"] : {};
      const snow = isObj(slot["snow"]) ? slot["snow"] : {};
      const t = num(m["temp"]) ?? NaN;
      const b = byDay.get(date) ?? { max: -Infinity, min: Infinity, precip: 0, prob: 0, conds: [] };
      if (Number.isFinite(t)) { b.max = Math.max(b.max, t); b.min = Math.min(b.min, t); }
      b.precip += (num(rain["3h"]) ?? 0) + (num(snow["3h"]) ?? 0);
      b.prob = Math.max(b.prob, (num(slot["pop"]) ?? 0) * 100);
      b.conds.push(owmCond(num(wx?.["id"])));
      byDay.set(date, b);
    }
    for (const [date, b] of byDay) {
      days.push({
        source: "openweather", date,
        tMaxC: b.max === -Infinity ? null : Math.round(b.max * 10) / 10,
        tMinC: b.min === Infinity ? null : Math.round(b.min * 10) / 10,
        precipMm: Math.round(b.precip * 10) / 10,
        precipProb: Math.round(b.prob),
        uvIndexMax: null,
        condition: majorityCondition(b.conds),
      });
    }
  }
  return { current, days };
}

// ── Visual Crossing (key; one call gives current + days) ─────────────────
export async function fetchVisualCrossing(env: Env): Promise<{ current: Reading | null; days: DayForecast[] }> {
  const key = env.VISUALCROSSING_KEY;
  if (!key) return { current: null, days: [] };
  const u = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${CONFIG.lat},${CONFIG.lon}`
    + `?unitGroup=metric&include=current,days&key=${key}&contentType=json`;

  const data = await getJson(u);
  if (!isObj(data)) return { current: null, days: [] };

  let current: Reading | null = null;
  const cc = data["currentConditions"];
  if (isObj(cc)) {
    const windKmh = num(cc["windspeed"]);
    current = {
      source: "visualcrossing",
      tempC: num(cc["temp"]), feelsC: num(cc["feelslike"]),
      humidity: num(cc["humidity"]), pressureHpa: num(cc["pressure"]),
      windMs: windKmh === null ? null : Math.round((windKmh / 3.6) * 10) / 10,
      windDir: num(cc["winddir"]),
      precipMm: num(cc["precip"]) ?? 0,
      uvIndex: num(cc["uvindex"]),
      condition: vcCond(cc["icon"]),
      observedAt: typeof cc["datetimeEpoch"] === "number"
        ? new Date(cc["datetimeEpoch"] * 1000).toISOString() : new Date().toISOString(),
    };
  }

  const days: DayForecast[] = [];
  if (Array.isArray(data["days"])) {
    for (const d of (data["days"] as unknown[]).slice(0, CONFIG.forecastDays)) {
      if (!isObj(d)) continue;
      days.push({
        source: "visualcrossing",
        date: String(d["datetime"]),
        tMaxC: num(d["tempmax"]), tMinC: num(d["tempmin"]),
        precipMm: num(d["precip"]) ?? 0, precipProb: num(d["precipprob"]),
        uvIndexMax: num(d["uvindex"]),
        condition: vcCond(d["icon"]),
      });
    }
  }
  return { current, days };
}


// ── Vaisala Xweather Weather API (keyed) ───────────────────────────────
type XweatherMode = "current" | "forecast" | "both";

function xweatherCredentials(env: Env): { clientId: string; clientSecret: string } | null {
  const clientId = env.XWEATHER_CLIENT_ID?.trim();
  const clientSecret = env.XWEATHER_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) return { clientId, clientSecret };

  // Convenience form used by Xweather MCP/bearer auth: client_id_client_secret.
  const combined = env.XWEATHER_API_KEY?.trim();
  if (!combined) return null;
  const separator = combined.indexOf("_");
  if (
    separator <= 0
    || separator === combined.length - 1
    || separator !== combined.lastIndexOf("_")
  ) return null;
  return {
    clientId: combined.slice(0, separator),
    clientSecret: combined.slice(separator + 1),
  };
}

function xweatherUrl(endpoint: "conditions" | "forecasts", env: Env): string | null {
  const credentials = xweatherCredentials(env);
  if (!credentials) return null;
  const u = new URL(`https://data.api.xweather.com/${endpoint}/${CONFIG.lat},${CONFIG.lon}`);
  u.searchParams.set("client_id", credentials.clientId);
  u.searchParams.set("client_secret", credentials.clientSecret);
  if (endpoint === "forecasts") {
    u.searchParams.set("filter", "day");
    u.searchParams.set("plimit", String(CONFIG.forecastDays));
  }
  return u.toString();
}

function xweatherPeriods(data: unknown): Record<string, unknown>[] {
  if (!isObj(data) || data["success"] !== true || !Array.isArray(data["response"])) return [];
  const location = (data["response"] as unknown[]).find(isObj);
  if (!location || !Array.isArray(location["periods"])) return [];
  return (location["periods"] as unknown[]).filter(isObj);
}

export async function fetchXweather(
  env: Env,
  mode: XweatherMode = "both",
): Promise<{ current: Reading | null; days: DayForecast[] }> {
  const currentUrl = mode === "forecast" ? null : xweatherUrl("conditions", env);
  const forecastUrl = mode === "current" ? null : xweatherUrl("forecasts", env);
  if (!currentUrl && !forecastUrl) return { current: null, days: [] };

  const [currentResult, forecastResult] = await Promise.allSettled([
    currentUrl ? getJson(currentUrl) : Promise.resolve(null),
    forecastUrl ? getJson(forecastUrl) : Promise.resolve(null),
  ]);

  let current: Reading | null = null;
  const currentData = currentResult.status === "fulfilled" ? currentResult.value : null;
  const c = xweatherPeriods(currentData)[0];
  if (c) {
    const timestamp = num(c["timestamp"]);
    current = {
      source: "xweather",
      tempC: num(c["tempC"]),
      feelsC: num(c["feelslikeC"]),
      humidity: num(c["humidity"]),
      pressureHpa: num(c["pressureMB"]),
      windMs: num(c["windSpeedMPS"]),
      windDir: num(c["windDirDEG"]),
      precipMm: num(c["precipMM"]) ?? 0,
      uvIndex: num(c["uvi"]),
      condition: xwCond(c["weatherPrimary"] ?? c["icon"]),
      observedAt: typeof c["dateTimeISO"] === "string"
        ? c["dateTimeISO"]
        : timestamp === null ? new Date().toISOString() : new Date(timestamp * 1000).toISOString(),
    };
  }

  const days: DayForecast[] = [];
  const forecastData = forecastResult.status === "fulfilled" ? forecastResult.value : null;
  for (const period of xweatherPeriods(forecastData).slice(0, CONFIG.forecastDays)) {
    const iso = typeof period["dateTimeISO"] === "string" ? period["dateTimeISO"] : "";
    const date = iso.slice(0, 10);
    if (!date) continue;
    days.push({
      source: "xweather",
      date,
      tMaxC: num(period["maxTempC"]),
      tMinC: num(period["minTempC"]),
      precipMm: num(period["precipMM"]) ?? 0,
      precipProb: num(period["pop"]),
      uvIndexMax: num(period["uvi"]),
      condition: xwCond(period["weatherPrimary"] ?? period["icon"]),
    });
  }

  return { current, days };
}

// ── Pirate Weather (keyed; Dark Sky-compatible) ────────────────────────
type PirateWeatherMode = "current" | "forecast" | "both";

function pirateWeatherUrl(mode: PirateWeatherMode): string {
  const u = new URL(`https://api.pirateweather.net/forecast/key/${CONFIG.lat},${CONFIG.lon}`);
  u.searchParams.set("units", "si");
  u.searchParams.set("version", "2");
  u.searchParams.set("lang", "pl");
  const exclude = ["minutely", "hourly", "alerts", "summary"];
  if (mode === "current") exclude.push("daily");
  if (mode === "forecast") exclude.push("currently");
  u.searchParams.set("exclude", exclude.join(","));
  return u.toString();
}

function localDateFromEpoch(epoch: number): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: CONFIG.tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(epoch * 1000));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}

export async function fetchPirateWeather(
  env: Env,
  mode: PirateWeatherMode = "both",
): Promise<{ current: Reading | null; days: DayForecast[] }> {
  const key = env.PIRATEWEATHER_API_KEY?.trim();
  if (!key) return { current: null, days: [] };

  const data = await getJson(pirateWeatherUrl(mode), { headers: { apikey: key } });
  if (!isObj(data)) return { current: null, days: [] };

  let current: Reading | null = null;
  const c = data["currently"];
  if (mode !== "forecast" && isObj(c)) {
    const humidity = num(c["humidity"]);
    const timestamp = num(c["time"]);
    current = {
      source: "pirateweather",
      tempC: num(c["temperature"]),
      feelsC: num(c["apparentTemperature"]),
      humidity: humidity === null ? null : Math.round(humidity * 1000) / 10,
      pressureHpa: num(c["pressure"]),
      windMs: num(c["windSpeed"]),
      windDir: num(c["windBearing"]),
      precipMm: num(c["precipIntensity"]) ?? 0,
      uvIndex: num(c["uvIndex"]),
      condition: pwCond(c["icon"] ?? c["summary"]),
      observedAt: timestamp === null ? new Date().toISOString() : new Date(timestamp * 1000).toISOString(),
    };
  }

  const days: DayForecast[] = [];
  const daily = data["daily"];
  if (mode !== "current" && isObj(daily) && Array.isArray(daily["data"])) {
    for (const item of (daily["data"] as unknown[]).slice(0, CONFIG.forecastDays)) {
      if (!isObj(item)) continue;
      const timestamp = num(item["time"]);
      if (timestamp === null) continue;
      const probability = num(item["precipProbability"]);
      const accumulationCm = num(item["precipAccumulation"]);
      const precipType = String(item["precipType"] ?? "none").toLowerCase();
      const comparablePrecipMm = accumulationCm === null
        ? null
        : (precipType === "rain" || precipType === "none" || accumulationCm === 0)
          ? Math.round(accumulationCm * 100) / 10
          : null;
      days.push({
        source: "pirateweather",
        date: localDateFromEpoch(timestamp),
        tMaxC: num(item["temperatureMax"]),
        tMinC: num(item["temperatureMin"]),
        precipMm: comparablePrecipMm,
        precipProb: probability === null ? null : Math.round(probability * 1000) / 10,
        uvIndexMax: num(item["uvIndex"]),
        condition: pwCond(item["icon"] ?? item["summary"]),
      });
    }
  }

  return { current, days };
}

// ── Open-Meteo Air Quality (no key; CAMS European domain) ───────────────
export async function fetchOpenMeteoAirQuality(): Promise<AirQuality | null> {
  const u = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  u.searchParams.set("latitude", String(CONFIG.lat));
  u.searchParams.set("longitude", String(CONFIG.lon));
  u.searchParams.set("timezone", CONFIG.tz);
  const pollenParams = CONFIG.pollenSpecies.map((s) => `${s}_pollen`).join(",");
  u.searchParams.set("current", `european_aqi,pm2_5,pm10,${pollenParams}`);

  const data = await getJson(u.toString());
  if (!isObj(data)) return null;
  const c = data["current"];
  if (!isObj(c)) return null;

  const pollen: PollenReading[] = [];
  for (const s of CONFIG.pollenSpecies) {
    const g = num(c[`${s}_pollen`]);
    if (g !== null && g > 0) pollen.push({ species: s, grains: Math.round(g) });
  }
  pollen.sort((a, b) => b.grains - a.grains);

  return {
    observedAt: typeof c["time"] === "string" ? c["time"] : new Date().toISOString(),
    europeanAqi: num(c["european_aqi"]),
    pm25: num(c["pm2_5"]),
    pm10: num(c["pm10"]),
    pollen,
    topPollen: pollen[0] ?? null,
  };
}

// ── IMGW: official warnings ─────────────────────────────────────────────
export type WarningCategory = "meteo" | "hydro";
export interface WarningFetchResult {
  warnings: Warning[];
  succeeded: WarningCategory[];
}

function matchesArea(w: Record<string, unknown>): boolean {
  const teryts: string[] = [];
  const wojs: string[] = [];
  const top = w["teryt"];
  if (Array.isArray(top)) teryts.push(...top.map(String));
  const obszary = w["obszary"];
  if (Array.isArray(obszary)) {
    for (const o of obszary) {
      if (!isObj(o)) continue;
      const t = o["teryt"];
      if (Array.isArray(t)) teryts.push(...t.map(String));
      if (o["wojewodztwo"] != null) wojs.push(String(o["wojewodztwo"]));
    }
  }
  if (w["wojewodztwo"] != null) wojs.push(String(w["wojewodztwo"]));
  if (teryts.some((c) => c.startsWith(CONFIG.terytPowiat))) return true;
  if (teryts.length === 0 && wojs.some((v) => v.toLowerCase() === CONFIG.wojewodztwo.toLowerCase())) return true;
  return false;
}

function parseWarnings(data: unknown, category: WarningCategory): Warning[] {
  if (!Array.isArray(data)) return [];
  const out: Warning[] = [];
  for (const w of data) {
    if (!isObj(w) || !matchesArea(w)) continue;
    const pick = (...keys: string[]): unknown => keys.map((k) => w[k]).find((v) => v != null);
    const str = (value: unknown): string | null =>
      typeof value === "string" && value.trim() !== "" ? value : null;
    const numer = String(pick("numer", "nr", "id") ?? "");
    const event = String(pick("zdarzenie", "nazwa_zdarzenia", "nazwa") ?? "Ostrzeżenie");
    const from = str(pick("data_od", "obowiazuje_od", "od"));
    out.push({
      category,
      id: `${category}:${numer || `${event}-${from ?? ""}`}`,
      event,
      level: num(pick("stopień", "stopien", "Stopien")),
      probability: num(pick("prawdopodobienstwo", "Prawdopodobienstwo")),
      from,
      to: str(pick("data_do", "obowiazuje_do", "do")),
      content: String(pick("przebieg", "tresc", "Tresc", "komentarz") ?? ""),
    });
  }
  return out;
}

export async function fetchImgwWarnings(): Promise<WarningFetchResult> {
  const base = "https://danepubliczne.imgw.pl/api/data/";
  const endpoints: readonly [WarningCategory, string][] = [
    ["meteo", `${base}warningsmeteo`],
    ["hydro", `${base}warningshydro`],
  ];
  const results = await Promise.all(endpoints.map(async ([category, url]) => {
    try {
      const data = await getJson(url);
      if (data === null) throw new Error("IMGW returned an unusable HTTP response");
      return { category, ok: true as const, warnings: parseWarnings(data, category) };
    } catch {
      return { category, ok: false as const, warnings: [] as Warning[] };
    }
  }));
  return {
    warnings: results.flatMap((result) => result.warnings),
    succeeded: results.filter((result) => result.ok).map((result) => result.category),
  };
}

// Nearest synop station — reference context only, not blended into the ensemble.
export async function fetchImgwStation(name: string): Promise<StationReading | null> {
  const data = await getJson("https://danepubliczne.imgw.pl/api/data/synop");
  if (!Array.isArray(data)) return null;
  const s = (data as unknown[]).find(
    (x) => isObj(x) && String(x["stacja"]).toLowerCase().includes(name.toLowerCase()),
  );
  if (!isObj(s)) return null;
  const at = `${String(s["data_pomiaru"])}T${String(s["godzina_pomiaru"]).padStart(2, "0")}:00:00`;
  return {
    source: "imgw",
    tempC: num(s["temperatura"]), feelsC: null,
    humidity: num(s["wilgotnosc_wzgledna"]), pressureHpa: num(s["cisnienie"]),
    windMs: num(s["predkosc_wiatru"]), windDir: num(s["kierunek_wiatru"]),
    precipMm: num(s["suma_opadu"]), uvIndex: null, condition: "unknown",
    observedAt: at,
  };
}
