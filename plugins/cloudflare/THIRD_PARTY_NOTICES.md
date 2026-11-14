# Third-party notices

The bundled `cloudflare` skill and reference tree come from [`cloudflare/skills`](https://github.com/cloudflare/skills) (synced at `cbf893b`, 2026-11-10) and retain the Apache-2.0 license at `skills/cloudflare/LICENSE.txt` (copy: `LICENSE.cloudflare.txt`). The plugin wrapper and repository integration are ISC-licensed.

The plugin references Cloudflare's hosted `https://mcp.cloudflare.com/mcp`; the remote service is not redistributed.

## Local changes

- Upstream skills `cloudflare-app-bootstrap`, `frameworks-on-cloudflare` and `workers-development` are folded into `references/` as `app-bootstrap/`, `frameworks/` and `workers-development/`, with links rewritten to the local tree. The HTTP-error section is split out as `references/http-errors/`.
- Agents SDK examples await `routeAgentRequest()` and `getAgentByName()`, use `onStateChanged`, verify GitHub webhook signatures before parsing, and match the current durable-execution and Voice APIs.
- The skill text is MCP-key-agnostic so it works under any connector name.

None of these change the Cloudflare API workflow or authentication model.
