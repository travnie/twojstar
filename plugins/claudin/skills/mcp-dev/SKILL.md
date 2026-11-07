---
name: "mcp-dev"
description: "Design, build, test and ship MCP servers and MCP Apps for Claude and ChatGPT/Codex: deployment choice, tool design, OAuth (CIMD/DCR), MCPB, directory review, spec changes. Use for any 'build/fix/review an MCP server or connector'."
license: Apache-2.0
---

# MCP servers + apps

The spec moved to **2026-07-28** (stateless: no `initialize` handshake, no `Mcp-Session-Id`, `server/discover`, elicitation/sampling via multi-round-trip results, `resultType` on every result). Hosts and SDKs migrate at different speeds — check `mcp-docs` (`/specification/<rev>/changelog.mdx`) and the SDK changelog before writing protocol-level code, and let the official SDK negotiate versions. Platform rules: `claude-ai-docs` (`/connectors/building/*`), `openai-docs` (`/plugins/build/mcp-server`, `/plugins/reference`).

## 1. Pick the shape (ask only what the brief doesn't answer)

| Connects to | Users | Shape |
|---|---|---|
| Cloud API / SaaS / pure logic | anyone | **Remote streamable HTTP** (default). Works in chat, Cowork, Code, ChatGPT |
| Local files, desktop app, localhost, OS | installers | **MCPB** bundle (runtime included) — Claude desktop/Code only; chat ignores local servers |
| Just me, prototype | me | local stdio (`npx`/`uvx`), upgrade path MCPB |
| Needs pickers, charts, previews in chat | any | **MCP App** = remote server + `ui://` resources → `references/apps.md` |
| Ships workflows/know-how with the tools | any | **Skills over MCP** (`io.modelcontextprotocol/skills`, SEP-2640) → `references/skills.md` |

Bartek default: Cloudflare Worker (`cloudflare` skill: `McpAgent`/Agents SDK, service bindings for same-account Worker calls). Portable: official TS SDK v2 = split packages `@modelcontextprotocol/server` (+ `client`, `node`, `express`); `@modelcontextprotocol/sdk` is the v1 line, keep it only in existing v1 code and never mix the two. Python: FastMCP (jlowin's 3.x, not the frozen 1.0 in `mcp`). Install with `npm install <pkg>`, never hand-typed versions.

## 2. Tools

Wrapping a REST/OpenAPI API: curate, don't mirror every endpoint (`references/tools.md` → OpenAPI). ≤15 actions → one tool each. 30+ → `search_actions` + `execute_action`, promote the top 3-5. Details and directory rules: `references/tools.md`. Non-negotiable for Claude's directory: read and write in separate tools, `title` + `readOnlyHint`/`destructiveHint` on every tool, names ≤64 chars, descriptions describe (never instruct the model), actionable errors.

## 3. Auth

Prefer: none → OAuth with CIMD (AS metadata advertises `client_id_metadata_document_supported: true` **and** `none` in `token_endpoint_auth_methods_supported`, else Claude falls back to DCR) → DCR. Callback `https://claude.ai/api/mcp/auth_callback`; Claude Code loopback needs port-agnostic `localhost` + `127.0.0.1`. No `client_credentials`; static header credentials are org-owner beta only. Validate token audience (RFC 8707); never pass the user's token upstream. ChatGPT side declares auth in portable `mcp.json` (`extensions.com.openai.auth`). More: `references/ship.md`.

## 4. Test

1. `python3 scripts/mcp_probe.py <url>` — detects spec era (`server/discover` vs `initialize`), lists tools with annotations, flags directory-rule violations; `--call name '{json}'` runs one tool. Works from the chat sandbox for public URLs.
2. MCP Inspector (`npx @modelcontextprotocol/inspector`) in Claude Code.
3. Real host: claude.ai Settings → Connectors → custom connector (Claude sends `clientInfo.name: "claude-ai"`); ChatGPT Plugins → Add custom MCP server; Grok Build `grok mcp add --transport http <n> <url>` + `grok mcp doctor <n>`. Local servers via tunnel.
4. Exercise every tool with valid and invalid input; check response size.
5. Quality, not just liveness: 10-question eval → `references/evals.md`.

Report the level reached — static review → syntax/build → server answers (`mcp_probe.py`) → real host loop — and what didn't run. "Files exist" is not "works".

## 5. Ship

Wrap the server in a plugin with a skill (`plugin-dev`) — the usual partner shape. Directory submission checklists: `references/ship.md`.

## Chat vs Claude Code

Chat sandbox: write code, run `mcp_probe.py` against deployed URLs, deploy via CI (house rule: workflow beats local). Claude Code: run servers locally, Inspector, `wrangler dev`, MCPB packing (`npx @anthropic-ai/mcpb pack`).
