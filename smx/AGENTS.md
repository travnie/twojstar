# smx agent notes

Keep this project thin.

- Runtime wraps the official SpaceMolt v2 client. Do not reimplement auth, sessions, retries, rate limits, command catalogs, or response models.
- Before adding or changing a wrapper around a SpaceMolt command, use the public docs MCP at `https://game.spacemolt.com/mcp/docs`.
- Start with `get_overview`. Use `get_command` for exact params/errors and `get_type` for response shapes. Use `search_commands` when you do not know the command name.
- Never guess a live parameter or schema when docs MCP can answer it.
- Docs MCP is for development only. Do not make normal `smx` gameplay depend on it.
- Gameplay agents should use `https://game.spacemolt.com/mcp/v2?preset=full` when they need the complete MCP toolset.
- Authority: live game state > docs MCP/current official v2 help > bundled local cards.
- Bundled cards stay short and tactical. Do not copy the full manual/OpenAPI into the package.
- CI must not log in, mutate a real account, or require live SpaceMolt availability. Use unit/fake-backend tests.
