# Auth, packaging, submission

## Claude auth types (claude.com/docs/connectors/building/authentication)

| Type | Status |
|---|---|
| `none` | default |
| `oauth_cimd` | supported; chosen only when AS metadata advertises CIMD support + `none` token auth method |
| `oauth_dcr` | supported; fallback; registers a client per connection |
| Anthropic-held client creds | partner gives client id/secret, consent-gated (contact Anthropic) |
| `static_headers` | beta, limited orgs; org Owner enters key once |
| `client_credentials` (M2M) | not supported |

Server side: RFC 8414 AS metadata + protected-resource metadata, validate audience, refresh tokens, no token passthrough. SDK helpers (`mcpAuthRouter`, `bearerAuth`, proxy provider) or a host that runs the AS (Cloudflare `workers-oauth-provider`). Token storage: stateless remote → none; MCPB/local → OS keychain, never plaintext.

Bartek note: a connector URL with a token in the query string can't go into a plugin `.mcp.json` — move auth to OAuth or keep it a personal connector.

## MCPB (local bundles)

`manifest.json` + server + bundled runtime/deps → `npx @anthropic-ai/mcpb init` / `pack` (CLI 2.x as of 2026-11; check schema version in the anthropics/mcpb repo). Declare `user_config` for paths/keys (`sensitive: true` → keychain). Security: least filesystem scope, validate paths (no `..` escape), no shell interpolation of tool args, signed bundles for distribution. Chat ignores local servers; Claude desktop/Code/Cowork-local load them.

## Directory submission — Claude

Checklist from `/connectors/building/review-criteria`: read/write split; annotations; names ≤64; no prompt-injection patterns; first-party API (server domain matches service); every tool returns success on valid input and actionable errors; reasonable response size; no harvesting conversation/memory/files; test credentials with a populated account; allowed link URIs if using `ui/open-link`; public docs by publish date. Not accepted: moving money/crypto, AI image/video/audio generation. Labels: Community (auto-scan) → Verified (escalated functional review). Plugins have their own checklist (`/plugins/pre-submission-checklist`).

## Directory submission — OpenAI

Remote HTTPS MCP via "With MCP" (screenshots only there); skills-only ZIP excludes MCP config unless org-approved for local MCP; hooks not eligible; version must change per upload; developer name comes from the verified identity. Field reference: `/plugins/deploy/submission`.

## Deploy

Cloudflare Worker via CI (`cloudflare` skill). Health: probe with `scripts/mcp_probe.py` after each deploy; for Bartek's servers, add the endpoint to `status-mcp`.
