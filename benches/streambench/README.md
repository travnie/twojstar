# [Streambench](https://streambench.travny.workers.dev/)

[![Bench CI](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml) [![hls.js](https://img.shields.io/badge/hls.js-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/hls.js) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)

Browser workshop for IPTV, radio, M3U/M3U8, XMLTV and HLS. **No open proxy:** the Worker relays only bundled or provider-signed media URLs. Local playlists, edits, history and preferences remain in browser `localStorage`.

## Implemented

- HLS with vendored `hls.js`, ICY/Radio Paradise metadata, playlist editing/filtering, M3U export, favorites/recent entries, XMLTV now/next via `tvg-id`, masked stream diagnostics.
- Provider catalog: Free-TV Lite, iptv-org and Radio Browser. Fixed allowlisted upstream hosts; user-provided URLs are **never** signed for relay.
- Supported video-site pages (YouTube/Twitch/Vimeo) open externally. No remote import of arbitrary playlist URLs.
- `public/portable.html` includes static player/playlist code; provider APIs, metadata and constrained relay still require the deployed Worker.
- Different browser origins keep **separate** local libraries; moving between Workers URL and custom domain does not migrate state.

## API and source

| Endpoint | Purpose |
| --- | --- |
| `GET /api/providers` | Provider registry |
| `GET /api/catalog?provider=<id>` | Allowed catalog |
| `GET /api/playlist?provider=<id>&type=<scope>&id=<value>` | Signed provider playlist |

Legacy `/api/providers/<id>/catalog|playlist` routes remain compatible. Product sources in `public/` and `src/`; shared browser lifecycle in [`../shared/`](../shared/).

```sh
cd benches
npm ci
npm run check:streambench
npm run dev --workspace=streambench
```

**Deploy:** Cloudflare Worker `streambench`, root `benches/`, scripts `build:streambench`, `deploy:streambench`, `preview:streambench`; set `STREAMBENCH_RELAY_SECRET` (≥32 random chars) in Worker secrets. Run the [smoke script](scripts/smoke.mjs) after deployment.
