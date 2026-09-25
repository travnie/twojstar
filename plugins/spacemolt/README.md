# SpaceMolt plugin

Portable plugin bundling the SpaceMolt skill and two official Streamable HTTP MCP servers:

- `game`: `https://game.spacemolt.com/mcp/v2?preset=full` for gameplay.
- `docs`: `https://game.spacemolt.com/mcp/docs` for client development and live contracts.

The skill is a bundled snapshot. Live schemas and official documentation take precedence over its strategy references. Player credentials and sessions are never packaged.

If gameplay MCP is unavailable in a **shell-capable** client, use the existing [`smx`](../../smx/) companion backed by the official SpaceMolt v2 CLI and HTTP API v2. Its session handling and multiple player profiles are already implemented. ChatGPT's hosted plugin environment cannot run that local fallback automatically; the gameplay MCP connection is necessary there.

The repo marketplace entry at `.agents/plugins/marketplace.json` makes the plugin available to compatible local installs. For hosted ChatGPT testing, connect the official MCP endpoint(s) through developer mode. This source package does not register a connection or publish a plugin by itself.
