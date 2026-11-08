# Benches

[![Bench CI](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/) [![npm workspaces](https://img.shields.io/badge/npm_workspaces-CB3837?logo=npm&logoColor=white&style=flat-square)](https://docs.npmjs.com/cli/using-npm/workspaces)

Three **independent Workers**, one npm workspace/lockfile. Follow [scoped workspace rules](AGENTS.md).

| Product | Source | Focus | Library example |
| --- | --- | --- | --- |
| [Codebench](codebench/) | `codebench/public/index.html`, `codebench/src/index.ts` | QR, barcodes, camera, local exports | [zxing-wasm](https://www.npmjs.com/package/zxing-wasm) |
| [Docbench](docbench/) | `docbench/public/`, `docbench/src/` | Local documents/PDF, file inspector, safe merges | [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) |
| [Streambench](streambench/) | `streambench/public/`, `streambench/src/` | IPTV/radio/HLS, playlists and bounded relay | [hls.js](https://www.npmjs.com/package/hls.js) |

## Build and test

```sh
cd benches
npm ci
npm run check
npm run check:docbench  # or check:codebench / check:streambench
npm run build:docbench  # matching per-product build
```

Cloudflare Workers Builds uses `benches/` as the root, with `build:<name>`, `deploy:<name>` and `preview:<name>` scripts. All three are checked by [Benches portable release CI](../.github/workflows/benches-release.yml); a green shared badge is **not** an individual deployment signal.

## Source boundaries

- Shared versioned dependencies and lockfile: `package.json`, `package-lock.json`. Product-only dependencies belong in the product package.
- Shared browser i18n, WebMCP lifecycle and local-file ingress: [`shared/`](shared/). Generated copies are synced by [`scripts/`](scripts/). **Edit the maintained shared source**, never its generated consumer copy.
- Runtime UI, CSP, storage, permissions and Worker routes remain product-owned. No arbitrary local-file upload; WebMCP tools reuse visible UI/store operations.
- Match experiments to their domain (file/archiving → Docbench, image/QR → Codebench, playback → Streambench). New WASM/language/framework probes require a reproducible build and browser smoke test, not a novelty rewrite.
- [File Workbench roadmap](docbench/FILE_WORKBENCH.md) is the maintained archive/codec/metadata plan. Unsupported ideas are not shipped features.
