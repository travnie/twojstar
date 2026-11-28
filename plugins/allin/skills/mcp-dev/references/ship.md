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

## Authless remote servers: abuse

No token means no per-user identity, and the stateless transport gives no session to key on. Rate-limit per client IP at the edge (Workers: Rate Limiting binding or WAF rule; read `CF-Connecting-IP`, not a client-supplied `X-Forwarded-For`), keep a per-instance token bucket as a backstop, and cache upstream responses so repeats skip the upstream call (they still cost a request, so caching complements limits, not replaces them). Many users of one host can share an egress IP, so a per-IP limit is a shared quota; per-user limits need auth. Host IP ranges are for tiering limits, not gating: hard-allowlisting Anthropic IPs locks out every other MCP host.

## MCP tunnels (private servers, research preview)

Reach an MCP server inside a private network with no inbound port: Anthropic's `mcp-proxy` plus `cloudflared` run next to it and dial out (`api.anthropic.com:443`, tunnel edge on 7844 TCP/UDP). Create the tunnel and register your own CA certificate in the Claude Console (the token goes in a gitignored `.env`, `ca.key`/`tls.key` never leave the host); the proxy terminates inner TLS with a cert from that CA, validates upstream IPs and routes by hostname to `https://<subdomain>.<tunnel-domain>/<path>`. Callers: Managed Agents (session in the tunnel's workspace) and the Messages API MCP connector (`mcp_servers`, beta header). Gotchas: proxy `routes` is a map, config isn't hot-reloaded (restart), `tls.key` permissions. No uptime commitment; read the security model first. Guided local setup: Anthropic's `mcp-tunnels` plugin (`/create-docker-mcp-tunnel`); hardened Compose/Helm and Workload Identity Federation: platform.claude.com `/agents-and-tools/mcp-tunnels/*`.

## Deploy

Cloudflare Worker via CI (`cloudflare` skill). Health: probe with `scripts/mcp_probe.py` after each deploy; for Bartek's servers, add the endpoint to `status-mcp`.
