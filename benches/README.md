# Benches

Shared npm workspace for the three browser tools in the Bench family:

- [`codebench/`](codebench/) — QR and barcode studio;
- [`docbench/`](docbench/) — local-first document and PDF studio;
- [`streambench/`](streambench/) — IPTV, radio, HLS, M3U and XMLTV workshop.

The applications remain separate Cloudflare Workers with independent runtime
boundaries and `wrangler.jsonc` files. The workspace centralizes dependency
installation, lockfile maintenance and common CI entry points.

Shared browser primitives now live under [`shared/`](shared/). Existing i18n
and WebMCP lifecycle code is synced to each application. The reusable local-file
drop/byte-size controller is maintained in
[`shared/local-files.js`](shared/local-files.js), with one generated copy in
Docbench. Other Benches can opt into the same source via
[`scripts/sync-local-files.mjs`](scripts/sync-local-files.mjs) as they add
compatible features. Layout, theme, permissions and Worker routes remain
product-owned; do not maintain parallel helper copies.

```sh
cd benches
npm ci
npm run check
```

Run one project with `npm run check:<name>` or `npm run build:<name>`.
Cloudflare Workers Builds uses `benches` as the root directory and the matching
`build:<name>`, `deploy:<name>` and `preview:<name>` scripts for each Worker.

A dependency or source change inside one Bench should normally trigger only that
Worker. Changes to `benches/package.json` and `benches/package-lock.json` are shared policy and should trigger all
three builds.

## Experiment routing

Each Bench is a standalone product and a practical playground for engines,
frameworks, codecs and language toolchains. Keep the experiment attached
to the product that benefits, **not** to whichever repo discovered it.

- **Docbench:** local files, documents/PDF, archives, file inspections and
  conversions. An imaging/media engine starts here only if it helps files.
- **Codebench:** QR/barcode scanner and maker, camera/image pipelines,
  SVG/canvas rendering, palette handling and raster exports.
- **Streambench:** audio/video/radio/HLS playback, live stream diagnostics,
  media/playlist parsing, track metadata and related tooling.
- **Shared:** small proven primitives already used by multiple products
  (i18n, WebMCP lifecycle and local-file ingress). Share additional code
  only after a second genuine consumer appears; keep one maintained copy.
- **Rejected here, useful there:** pass a prototype and its findings to the
  better-matched Bench instead of forcing it into Docbench.

### How to experiment

Prefer new or unusual candidates when useful: Svelte, Dart/Jaspr, Rust,
Swift/WASM + JavaScriptKit, Zig/WASM, C/C++/WASM and others. **No fixed
TypeScript/Kotlin monoculture**, but no novelty-only rewrite either.
A small reproducible compile and real browser smoke test outrank elaborate
millisecond charts. Keep successful builds, actual file/playback behavior,
mobile/desktop, CSP, single-file portable and truthful failure handling
as release gates. Check payload/memory only when it affects usability.
Pin toolchains and record why something works or fails.

### WebMCP and other agent surfaces

All three Benches already expose browser-side tools via
[`shared/webmcp-lifecycle.js`](shared/webmcp-lifecycle.js) and the
experimental `document.modelContext` API. Every new meaningful capability
should get an equivalent bounded WebMCP tool **when implemented**; tools
must execute the existing visible UI/service logic, not a hidden parallel
algorithm. Preserve local file permissions, user approval for consequential
actions, no silent uploads and short-lived source IDs. Unsupported browsers
retain the ordinary UI. Host-based MCP Apps are a separate permission
boundary, not interchangeable with WebMCP.

Docbench's [single File Workbench roadmap](docbench/FILE_WORKBENCH.md)
contains the detailed explorer, candidate engines, cross-Bench reuse and
WebMCP capability plan.

## Migration and license

This workspace was extracted from [`trvny/trvny`](https://github.com/trvny/trvny)
with its filtered `benches/` Git history preserved. Active development now lives
in [`travnie/twojstar`](https://github.com/travnie/twojstar).

The migrated Bench workspace remains licensed under [ISC](LICENSE). The root
workshop repository may use a different license for other components.
