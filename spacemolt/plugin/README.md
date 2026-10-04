# SpaceMolt plugin

Portable plugin bundling gameplay and client-development skills and two official Streamable HTTP MCP servers:

- `game`: `https://game.spacemolt.com/mcp/v2?preset=full` for gameplay.
- `docs`: `https://game.spacemolt.com/mcp/docs` for client development and live contracts.

The skill is a bundled snapshot. Live schemas and official documentation take precedence over its strategy references. Player credentials and sessions are never packaged.

In a **shell-capable** client, play through the adjacent [`smx`](../smx/) companion first; it wraps the official SpaceMolt v2 CLI and already handles sessions and multiple player profiles. Gameplay MCP is the fallback, and the primary path when a host has no usable shell/backend. Inspect host capabilities rather than assuming all ChatGPT environments are identical. Raw HTTP/WebSocket v2 is the last resort.

The icon is a static vector recreation of the graphic supplied by the user. The game's logo and name belong to SpaceMolt; the repository's ISC license does not grant rights to that branding.

The repo marketplace entry at `.agents/plugins/marketplace.json` makes the plugin available to compatible local installs. For hosted ChatGPT testing, connect the official MCP endpoint(s) through developer mode. The downloadable package connects both official endpoints without credentials. Saving it to an account makes a private plugin available; installation and character authorization remain separate host steps.

## Package

Run `python spacemolt/scripts/package_plugin.py OUTPUT.zip` from the repository root. Portable root metadata stays canonical; the packager generates synchronized Codex compatibility files in its staging directory. It validates skills, paths and assets and builds a deterministic archive.
