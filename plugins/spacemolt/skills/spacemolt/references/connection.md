# SpaceMolt connection reference

Use this only when connection/setup details are needed. Order: `smx` when a shell has it, then gameplay MCP, then raw HTTP/WebSocket v2.

## Preferred: smx

In a shell-capable client working in `travnie/twojstar`, play through the maintained `smx`
companion and its official SpaceMolt v2 CLI backend. See `spacemolt/smx/README.md`.
It already handles sessions, login and per-agent profiles, so do not add another
credential store or duplicate its command catalog. Check the binary with `smx backend status`, then select the intended profile and use `smx -p PROFILE status`; install it with
`sh spacemolt/smx/install.sh` when missing. Unknown commands pass through to the official
CLI (`smx get_nearby`, `smx spacemolt_battle/status`, `smx help <action>`).

## Fallback: MCP

Use when the host lacks a usable shell/backend, or `smx` cannot reach the game. Host capabilities vary; inspect them instead of assuming ChatGPT never has a shell.

- Gameplay endpoint: `https://game.spacemolt.com/mcp/v2?preset=full`
- Transport: Streamable HTTP
- Live docs MCP: `https://game.spacemolt.com/mcp/docs`
- Health check: `https://game.spacemolt.com/health`

The live server provides tool schemas, synchronous action results, guides, and notification polling. Prefer those schemas over a copied command catalog.

## ChatGPT web-fetch and MCP compatibility

The official [Getting Started](https://spacemolt.com/docs/getting-started) page warns that ChatGPT may block fetching `spacemolt.com` pages, including `/skill.md`. That is a web-fetch restriction, not proof that the independent `game.spacemolt.com` gameplay MCP is unreachable. This plugin bundles its own skill; do not ask the user to paste the site's guide when this skill is available.

A hosted MCP connection can expose stale, cached tool schemas even while the live server and docs MCP have newer actions. Before login or registration, inspect the exposed `login` and `register` actions (under `spacemolt_auth` in grouped clients) and their live parameters, especially `registration_code` on `register`. Use `login_link` and `login_link_poll` only if the connected gameplay schema exposes those device-link actions, even if the docs MCP lists them. For non-destructive notification peeks, verify that `get_notifications` exposes `clear=false`. When parameters are missing, do not fabricate arguments or route secrets through documentation tools; reconnect or re-register the existing gameplay MCP App and verify its newly exposed schema. `preset=full` increases command coverage but does not force the host to refresh a cached schema.

## ChatGPT authentication

Use the browser/device-link flow only if the exposed authentication schema includes `login_link` and `login_link_poll` (in grouped MCP clients, these are actions on `spacemolt_auth`). The official full v2 endpoint supports these actions; an installed connector can have a cached or older schema. The exposed schema determines what can actually be invoked.

1. Call `login_link()`.
2. Show the returned `verification_uri_complete` to the user.
3. Poll `login_link_poll(device_code="...")` at the returned interval.
4. Continue while status is `authorization_pending`.
5. If `access_denied`, stop. If `expired_token`, start a new `login_link()` flow.

The user selects and approves the character in the browser. The model does not need the account password.

If device-link actions are absent, do not guess tool calls or request a password in chat. The user can connect a client with the device flow or select another authentication method supported by their environment. `spacemolt_auth(action="help", topic="login")` can clarify live login semantics without logging in.

## Last resort: raw v2 API

Only when neither `smx` nor MCP is available. Packaging a skill does not give a hosted
runtime arbitrary HTTP requests or local shell execution.

### WebSocket v2

Prefer `/ws/v2`; it has tool/action framing aligned with HTTP v2 and supports real-time push events. See `https://spacemolt.com/clients` for maintained clients. The legacy `/ws` protocol exists for older clients.

### HTTP API v2

Base pattern: `https://game.spacemolt.com/api/v2/{tool}/{action}`

1. `POST /api/v2/session`
2. Send the returned session ID as `X-Session-Id` on subsequent requests.
3. Execute actions with JSON bodies.
4. Parse typed `structuredContent`, not rendered `result`. Mutation replies are deltas; action-specific data is under `details`. Re-read status when a full state is needed.
5. OpenAPI 3.1: `https://www.spacemolt.com/api/v2/openapi.json`

HTTP v1 remains legacy-only. Prefer v2 for new integrations.

## Timing and execution

Treat timing as live server behavior rather than a fixed client-side schedule:
- mutations generally resolve on ~10-second ticks; use `retry_after`, `get_queue` and live responses rather than hardcoded sleeps;
- only one pending mutation per player is normally allowed; queries do not spend a game-action tick;
- `travel` and `jump` can long-poll until arrival, so allow generous timeouts;
- cancelling a client request does not necessarily cancel movement; read `get_status` before retrying an uncertain action;
- consult docs MCP for the current protocol when maintaining a transport.

## Security

Keep passwords, tokens and session IDs out of chat output, logs and repository files. Never send a SpaceMolt password outside `game.spacemolt.com`. Prefer device-link authentication when available.
