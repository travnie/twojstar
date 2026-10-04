---
name: spacemolt-client-dev
description: Look up current official SpaceMolt API, CLI and transport contracts when building, reviewing or debugging a game client, bot, harness or SMX wrapper. Use for development questions; use the spacemolt skill for playing the game.
---

# SpaceMolt client development

Follow explicit user instructions over these defaults. Use the official public
read-only docs MCP at `https://game.spacemolt.com/mcp/docs`.

1. Read `get_overview` for connection surfaces, auth, sessions, timing and envelopes.
2. Find unknown commands with `search_commands(query, tag?)`.
3. Read `get_command(action, tool?)` for exact params, errors, mutation classification
   and transport invocation. Disambiguate duplicate action names with the tool group.
4. Read `get_type(name)` only for response models actually used. Parse
   `structuredContent`; mutation details live under `details`, state can be partial.
5. Read `get_websocket_protocol(section)` only for WS work. Read docs
   `get_guide(guide)` for gameplay semantics, not as a substitute for command schemas.
6. Inspect the current official `SpaceMolt/client-v2` before changing a CLI wrapper.
   Delegate auth, retry/session behavior and command dispatch to it when possible.
   Prefer named arguments for composed calls and isolated session paths per player.
7. If implementation needs local files, use the host-workspace-operator skill and
   available native tools. Inspect repo instructions, preserve unrelated work and
   run relevant offline checks. Do not claim unavailable shell/Python tools ran.
8. Verify modified behavior with fake sessions/backends. Never log in or mutate a
   real character merely to test development code. Report sources, changed behavior,
   executed checks and unverified host behavior.

If docs MCP is missing, use the current official OpenAPI at
`https://www.spacemolt.com/api/v2/openapi.json` and official CLI help/source.
State what could not be verified. Do not freeze the full catalog into a wrapper.
Do not send credentials to docs tools, package them, or expose them in logs.

Gameplay MCP uses `get_guide` with `id`; docs MCP uses `guide` and includes more
published slugs. Cached connectors can expose older schemas than the live server.
Describe that mismatch; do not invent unsupported calls.
