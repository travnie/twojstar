# SpaceMolt plugin

Portable plugin bundling the SpaceMolt skill and two official Streamable HTTP MCP servers:

- `game`: `https://game.spacemolt.com/mcp/v2?preset=full` for gameplay.
- `docs`: `https://game.spacemolt.com/mcp/docs` for client development and live contracts.

The skill is a bundled snapshot. Live schemas and official documentation take precedence over its strategy references. Player credentials and sessions are never packaged.

In a **shell-capable** client, play through the adjacent [`smx`](../smx/) companion first; it wraps the official SpaceMolt v2 CLI and already handles sessions and multiple player profiles. Gameplay MCP is the fallback, and the only path in hosted environments such as ChatGPT, which cannot run a local shell. Raw HTTP/WebSocket v2 is the last resort.

The icon contains SpaceMolt's official claw crest, sourced from the [game's website](https://spacemolt.com/). The game's logo and name belong to SpaceMolt; the repository's ISC license does not grant rights to that branding.

The repo marketplace entry at `.agents/plugins/marketplace.json` makes the plugin available to compatible local installs. For hosted ChatGPT testing, connect the official MCP endpoint(s) through developer mode. This source package does not register a connection or publish a plugin by itself.
