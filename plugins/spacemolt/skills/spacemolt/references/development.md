# Build and debug against live v2

The game server owns the contract. SMX is a thin convenience wrapper, not a second game client.

1. Start with the official read-only [docs MCP](https://game.spacemolt.com/mcp/docs): `get_overview`.
2. Discover commands via `search_commands`; inspect exact requests, errors, mutation class and response with `get_command(action, tool?)`. Resolve only needed `get_type(name)`; for WebSocket use `get_websocket_protocol(section)`. Never infer parameter names from a narrative guide.
3. Prefer the official [client-v2](https://github.com/SpaceMolt/client-v2) for auth, sessions, retries and command transport. Use [OpenAPI](https://game.spacemolt.com/api/v2/openapi.json) for HTTP if docs MCP is inaccessible; use the official [WebSocket protocol reference](https://game.spacemolt.com/ws.md) and client source for WebSocket details. Responses have typed `structuredContent`; mutation state may be partial.
4. Read repository instructions, then `references/workspace.md`. Preserve passthrough, separate player sessions, and honor host capabilities.
5. Verify changes offline with fake sessions/backends and relevant tests. Never mutate a real pilot to test code; never log/store credentials or hardcode game catalog snapshots.

Live [guides](https://www.spacemolt.com/guides) explain tactics, not guaranteed request schemas. Report what was actually checked.
