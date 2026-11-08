# [Weather Feed](https://weather.travny.workers.dev/)

[![Weather CI](https://github.com/travnie/twojstar/actions/workflows/weather-ci.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/weather-ci.yml) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)

Cloudflare Worker for Kościelec/Chrzanów (50.14 N, 19.42 E). Normalizes up to five weather sources; publishes **changes**, not repeated readings. [Canonical host](https://weather.travny.workers.dev/) stays authoritative for schema, sitemap and Atom IDs.

## Public routes

| Route | Output |
| --- | --- |
| `/` | Weather dashboard |
| `/feed.atom` | Condition/forecast change events |
| `/warnings.atom` | IMGW alerts |
| `/state.json` | Ensemble, warnings, air quality, station reference |
| `/healthz` | 503 for stale/unhealthy cycle |

## Schedule / behavior

- `0 */2 * * *`: current observations, air quality and IMGW warnings. `0 5 * * *`: forecast revisions.
- Ensemble: median and spread. Change triggers include ≥3 °C, rain start/stop, major forecast revision. OpenWeather 3-hour slots use `Europe/Warsaw` days.
- IMGW meteo limited to powiat `1203`, hydro to Małopolskie. Partial outages preserve still-valid alerts and **never fabricate an alert-cleared event**. Station readings are reference only, not blended.
- Read-only HTTP paths; scheduled events own KV writes. Quotas cap refresh frequency.

## Work / deploy

```sh
cd weather-feed
npm ci
npm run check
npm run dev
# Set up the environment before a production deploy (examples):
# npx wrangler kv namespace create WEATHER_KV  # new environments only; bind ID in wrangler.jsonc
# npx wrangler secret put OPENWEATHER_KEY
# npx wrangler secret put VISUALCROSSING_KEY
# npx wrangler secret put XWEATHER_CLIENT_ID
# npx wrangler secret put XWEATHER_CLIENT_SECRET
# npx wrangler secret put PIRATEWEATHER_API_KEY
# npm run deploy
```

Secrets: `OPENWEATHER_KEY`, `VISUALCROSSING_KEY`; Xweather uses `XWEATHER_CLIENT_ID` + `XWEATHER_CLIENT_SECRET` or `XWEATHER_API_KEY`; Pirate Weather uses `PIRATEWEATHER_API_KEY`. Open-Meteo/IMGW need no keys, so missing paid providers degrade coverage rather than break the service. The current `wrangler.jsonc` binds production `WEATHER_KV`; use a **separate KV namespace** for a new environment. CI validates TypeScript/tests (IMGW outages, expiry, Warsaw time, Atom IDs). See [workflow](../.github/workflows/weather-ci.yml).
