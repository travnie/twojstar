# SpaceMolt compatibility audit

Checked 2026-10-04 against the official server v0.612.0, API v2.0.0 and
`SpaceMolt/client-v2` v1.5.67. This is a dated audit, not a promise that future
game mechanics or host schemas stay unchanged.

## Sources and scope

- https://game.spacemolt.com/mcp/docs — overview, command/type contracts and guides.
- https://www.spacemolt.com/api/v2/openapi.json — current generated API schema.
- https://www.spacemolt.com/changelog — gameplay changes, including opt-in rescues.
- https://github.com/SpaceMolt/client-v2 — CLI parser, sessions and releases.
- https://developers.openai.com/plugins/build/plugins — portable plugin manifest.
- https://developers.openai.com/codex/mcp — native Streamable HTTP configuration.

Reviewed SMX command dispatch, profiles, projections, maintenance, local cards and
installers; gateway API calls, daily allowlist and MCP contracts; all plugin skills,
guide snapshots, assets, manifests and packaging. No real player was authenticated
or changed during verification.

## Changes

- SMX reports the selected backend's version even when a different managed binary
  exists. Installers reuse the verified, atomic updater; Windows prefers uv when
  available. Codex setup uses native HTTP instead of a redundant bridge.
- Gateway chat validation enforces the official 500-character maximum and private
  recipient requirement. MCP annotations expose read/write behavior correctly.
- Gameplay references use v2 structured state, partial deltas, grouped commands,
  opt-in distress missions and current reload/prize service contracts. Upstream
  mission/fuel guides still describe automatic rescue assignment; bundled copies
  correct that drift. Strategies and prices remain snapshots, not execution schemas.
- Plugin 0.2.1 includes gameplay, client-development and canonical host-workspace
  skills; exactly two official MCPs; static vector branding recreated from the
  supplied image. A deterministic packager generates legacy compatibility adapters
  from the canonical portable manifests.

## Verification and limits

SMX: 67 offline unit tests, POSIX installer syntax, and real official v1.5.67 help
through the wrapper. Gateway: three contract tests and Node syntax validation.
PowerShell parsing is covered by the existing Windows CI job. Remote checks are
limited to MCP initialization/catalog discovery and public documentation queries.

Private plugin validation covers paths, skills, safe SVGs, both MCP configurations,
archive integrity and repeatable bytes. The older public-submission validator also
requires real privacy, terms and support URLs; those are intentionally not invented
for this private package. Public-directory readiness is a separate unfinished task.

The Wrangler dry-run check was blocked by automatic approval review over possible
code transfer to Cloudflare. Local gateway tests and syntax checks passed instead.
No direct production deployment was run. Character authorization and end-to-end
gameplay inside a newly installed ChatGPT plugin still require the user's host.
