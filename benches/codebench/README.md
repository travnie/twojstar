# [Codebench](https://codebench.travny.workers.dev/)

[![Bench CI](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/benches-release.yml) [![zxing-wasm](https://img.shields.io/badge/zxing-wasm-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/zxing-wasm) [![bwip-js](https://img.shields.io/badge/bwip-js-CB3837?logo=npm&logoColor=white&style=flat-square)](https://www.npmjs.com/package/bwip-js) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)

Browser-only QR/barcode maker and camera scanner. Input and generated values never leave the browser. The Worker serves static assets with security headers; vendor libraries/fonts are pinned and self-hosted. Camera needs HTTPS/localhost.

## Work here

| Concern | Maintained file |
| --- | --- |
| UI and application | `public/index.html` |
| Input validation/exports | `client/hardening.ts` (source; compiled to generated `public/hardening.js`) |
| Worker headers/HTML injection | `src/index.ts` |
| Vendor and portable build | `scripts/vendor.mjs`, `scripts/portable.mjs` |
| Shared browser utilities | [`../shared/`](../shared/) |

```sh
cd benches
npm ci
npm run check:codebench
npm run dev --workspace=codebench
```

`npm run build:codebench` also generates ignored `codebench/public/portable.html` with embedded dependencies and ZXing WASM. Do not edit generated `public/vendor/`, `public/fonts/`, `worker-configuration.d.ts`, or the portable HTML.

**Deploy:** Cloudflare Worker `codebench`, root `benches/`, commands `npm run build:codebench`, `deploy:codebench`, `preview:codebench`; watch `benches/codebench/**`, `benches/package.json` and `benches/package-lock.json`. [CI](../../.github/workflows/benches-release.yml) runs checks across the workspace.
