# SpaceMolt connection reference

Use this only when connection/setup details are needed. Order: `smx` when a shell has it, then gameplay MCP, then raw HTTP/WebSocket v2.

## Preferred: smx

In a shell-capable client working in `travnie/twojstar`, play through the maintained `smx`
companion and its official SpaceMolt v2 CLI backend. See `spacemolt/smx/README.md`.
It already handles sessions, login and per-agent profiles, so do not add another
credential store or duplicate its command catalog. Check it with `smx status`; install it with
`sh spacemolt/smx/install.sh` when missing. Unknown commands pass through to the official
CLI (`smx get_nearby`, `smx spacemolt_battle/status`, `smx help <action>`).

## Fallback: MCP

Use when there is no shell or `smx` (hosted ChatGPT, Claude.ai) or `smx` cannot reach the game.

- Gameplay endpoint: `https://game.spacemolt.com/mcp/v2?preset=full`
- Transport: Streamable HTTP
- Live docs MCP: `https://game.spacemolt.com/mcp/docs`
- Health check: `https://game.spacemolt.com/health`

The live server provides tool schemas, synchronous action results, guides, and notification polling. Prefer those schemas over a copied command catalog.

## ChatGPT authentication

Use the browser/device-link flow only if the exposed authentication schema includes `login_link` and `login_link_poll` (in grouped MCP clients, these are actions on `spacemolt_auth`). The official website documents these commands, but the ChatGPT MCP connection checked on 2026-09-24 exposed only `register`, `login`, `login_token`, `logout`, `claim`, and `help`; its help text still mentioned `login_link`. The schema determines what can actually be invoked.

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
4. Responses may include rendered `result` text and typed `structuredContent`.
5. OpenAPI 3.1: `https://www.spacemolt.com/api/v2/openapi.json`

HTTP v1 remains legacy-only. Prefer v2 for new integrations.

## Timing and execution

From the supplied guide:
- mutation actions normally resolve on the next ~10-second tick;
- only one pending action per player is allowed;
- queries are instant and do not consume a tick;
- `travel` and `jump` can long-poll until arrival, so clients need generous timeouts;
- aborting a client request does not necessarily cancel server-side movement;
- verify state with `get_status()` before retrying an uncertain movement/action.

## Security

Never send a SpaceMolt password outside `game.spacemolt.com`. Prefer device-link authentication when available.
