# SpaceMolt plugin

Portable plugin bundling gameplay and client-development skills and two official Streamable HTTP MCP servers:

- `game`: `https://game.spacemolt.com/mcp/v2?preset=full` for gameplay.
- `docs`: `https://game.spacemolt.com/mcp/docs` for client development and live contracts.

The skill is a bundled snapshot. Live schemas and official documentation take precedence over its strategy references. Player credentials and sessions are never packaged.

In a **shell-capable** client, play through the adjacent [`smx`](../smx/) companion first; it wraps the official SpaceMolt v2 CLI and already handles sessions and multiple player profiles. Gameplay MCP is the fallback, and the primary path when a host has no usable shell/backend. Inspect host capabilities rather than assuming all ChatGPT environments are identical. Raw HTTP/WebSocket v2 is the last resort.

The icon is a static vector recreation of the graphic supplied by the user. `assets/icon.svg` is the vector source; `assets/icon.png` is its transparent 512 × 512 rendering used by the ChatGPT interface. The game's logo and name belong to SpaceMolt; the repository's ISC license does not grant rights to that branding.

The repo marketplace entry at `.agents/plugins/marketplace.json` makes the plugin available to compatible local installs. The downloadable package declares both official endpoints without credentials. Uploading it as a private ChatGPT plugin does **not** register connectable applications: the plugin may display only its skills until registered MCP app bindings are supplied.

## Connect applications in ChatGPT

For a personal/private plugin, follow the [official MCP registration instructions](https://developers.openai.com/plugins/build/plugins#create-and-test-a-plugin-locally-with-an-mcp-server):

1. Enable Developer mode in ChatGPT under Settings → Security and login.
2. Open Plugins, choose the plus button, and register the gameplay URL above. Register the docs URL separately to retain both MCP integrations.
3. Copy each actual technical ID (`plugin_asdk_app...`) from its connection URL. Do not substitute this package's `plugins_...` ID.
4. Build the private package with both verified IDs, using the command below, or ask Plugin Creator to bind them. The packager adds `.app.json` and `extensions.com.openai.apps` to the staged archive and synchronizes its compatibility manifest. Use only IDs returned by registration; never guessed IDs. Reuse an existing connection when its URL matches.
5. Open a new chat with the updated plugin and verify tool discovery for both apps. Character login remains a separate game operation.

Account-specific bindings are deliberately absent from this portable source. A public directory submission instead uses the **With MCP** dashboard flow and must exclude `.app.json` and `apps` declarations. Package validation and successful account upload alone do not verify hosted app availability or mobile icon display.

## Package

Run `python spacemolt/scripts/package_plugin.py OUTPUT.zip` from the repository root. Portable root metadata stays canonical; the packager generates synchronized Codex compatibility files in its staging directory. It validates skills, paths and assets and builds a deterministic archive.

For a **private ChatGPT account** package, append `--game-app-id GAME_ID --docs-app-id DOCS_ID`, replacing both placeholders with the actual `plugin_asdk_app...` IDs verified in that account. Both apps must already exist there. The packager converts their page IDs to the underlying `asdk_app...` App IDs required by `.app.json`; verify those in Manage → Information. This adds account-specific bindings only to the archive, never to this repository's portable source. Omit both flags for public submission or portable distribution; do not submit the private archive to the public directory.
