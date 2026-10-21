# SpaceMolt plugin

Canonical portable source of **one SpaceMolt skill** routing gameplay, client development and host-workspace guidance through on-demand references, plus two official Streamable HTTP MCP servers:

- `game`: `https://game.spacemolt.com/mcp/v2?preset=full`
- `docs`: `https://game.spacemolt.com/mcp/docs`

`skills/spacemolt/SKILL.md` routes to `references/gameplay.md`, `references/development.md` and `references/workspace.md`. All 15 gameplay guides remain in `references/guides/`; do not preload them for development tasks. Live schemas and official docs override bundled strategy snapshots. Player credentials and sessions are never packaged.

On shell-capable hosts, prefer adjacent [smx](../../spacemolt/smx/) with the official SpaceMolt v2 CLI and multiple player profiles. Gameplay MCP is the fallback and the primary route when shell access is unavailable. Raw HTTP/WebSocket v2 is last resort.

The icon source is `assets/icon.svg`, with transparent PNG generated for ChatGPT. Branding belongs to SpaceMolt; ISC does not grant logo rights.

## ChatGPT: update the registered apps instead of installing wrappers

The existing ChatGPT **SpaceMolt gameplay MCP app** was updated in place to carry this repository's complete `skills/spacemolt/` tree, including **all references and 15 guides**. Its Skills and gameplay actions therefore share one app entry.

**SpaceMolt Docs remains a separately registered MCP app.** ChatGPT's app-backed plugin updater rejected an attempted change to the gameplay app's configuration/bindings to add the docs app. A portable manifest listing two remote endpoints does **not** merge those registered apps into one. Never claim that all gameplay and docs actions are in one entry or remove the Docs connection while its actions are needed.

For subsequent gameplay skill releases, copy the complete canonical `skills/spacemolt/` tree into the **existing App-backed gameplay plugin archive**, preserving its `.app.json`, generated manifest identity and existing MCP binding. Use Plugin Creator to update the existing release; verify Skills + Actions and compare the staged list of `references/` against source.

The old standalone `spacemolt` wrapper is a different private plugin record, even when it references both registered MCP apps. Upgrading game/docs apps does not delete that record. Removing obsolete private wrappers is a separate account-management step; an installed-app uninstall call may return `not_installed` for an owned private plugin and cannot be treated as proof of removal.

## Portable and optional wrapper distribution

Run from the repository root:

```sh
python spacemolt/scripts/package_plugin.py /tmp/spacemolt.zip
```

The packager validates branding, skills, references and both MCP URLs; its generated compatibility files remain derived from the portable source. The repository marketplace entry in `.agents/plugins/marketplace.json` supports compatible local installs. A portable ZIP alone does not register ChatGPT MCP apps.

For an environment that explicitly needs a dependency **wrapper**, use already registered, verified app IDs:

```sh
python spacemolt/scripts/package_plugin.py /tmp/spacemolt-private.zip \
  --game-app-id GAME_ID --docs-app-id DOCS_ID
```

This stages account-specific `.app.json` only in the ZIP, not the repository. **Do not install this wrapper just to combine the UI entries.** Public directory submissions use the With MCP flow without private app bindings. Verify live tool discovery before removing any existing connections.
