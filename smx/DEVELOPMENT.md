# Developing smx

`smx` has two deliberately separate SpaceMolt MCP relationships.

| Purpose | Endpoint | Rule |
| --- | --- | --- |
| Build and maintain `smx` | `https://game.spacemolt.com/mcp/docs` | Public, read-only docs MCP. Use it to inspect exact contracts. |
| Play SpaceMolt with an MCP agent | `https://game.spacemolt.com/mcp/v2?preset=full` | Gameplay MCP with the complete tool set. |

The docs MCP is not a runtime dependency of `smx`. The gameplay MCP is not a build dependency.

## Contract lookup flow

Before implementing or changing a wrapper:

1. `get_overview` once for current transport/session rules.
2. `search_commands` if the command name is unclear.
3. `get_command` for the exact command parameters, response schema, errors, and invocation forms.
4. `get_type` for any named response type that needs deeper inspection.
5. `get_websocket_protocol` only for WebSocket work.
6. `get_guide` for mechanics when a wrapper depends on gameplay behavior.

Do not freeze the whole command catalog into this repository. Store only the small piece of stable behavior that `smx` itself adds.

## Setup examples

Claude Code can connect directly over HTTP:

```bash
claude mcp add --transport http spacemolt-docs https://game.spacemolt.com/mcp/docs
```

Codex CLI can bridge through `mcp-remote`:

```bash
codex mcp add spacemolt-docs -- npx -y mcp-remote https://game.spacemolt.com/mcp/docs
```

For other MCP-capable development tools, add the same docs URL as a Streamable HTTP MCP server.

## Gameplay profile

When an agent is actually playing and complete tool access is wanted, use:

```text
https://game.spacemolt.com/mcp/v2?preset=full
```

Do not attach the docs MCP to a gameplay loop unless you are actively debugging client code. It adds a second documentation tool surface without improving ordinary turns.

## Fallbacks

If docs MCP is unavailable while developing, use the current official v2 client help or the current OpenAPI document at `https://game.spacemolt.com/api/v2/openapi.json`. Treat local field cards as hints, never as API contracts.

## Tests

Keep tests offline and deterministic:

```bash
python -m pip install ./smx
python -m unittest discover -s smx/tests -v
```

Use fake backends for command behavior. Never authenticate a real character from CI.
