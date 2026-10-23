# twojstar Claude Code marketplace

The same plugin sources are available in both ChatGPT/Codex and Claude Code.
Do not duplicate skill files, OAuth credentials, or MCP URLs for Claude. Keep the same vendor-neutral plugin identity across Claude Code, OpenAI/ChatGPT/Codex and compatible agent clients.

## Install in Claude Code

In the Claude Code terminal:

```sh
claude plugin marketplace add travnie/twojstar
claude plugin install cloudflare@twojstar
claude plugin install devkit-claude@twojstar
claude plugin install spacemolt@twojstar
```

Or use `/plugin` and choose the `twojstar` marketplace to browse the eight available plugins:

- `spacemolt` (game and docs MCPs, three skills)
- `docbench` (skills only)
- `openai-dev-kit`
- `google-dev-kit` (ten declared remote MCP endpoints, many requiring separate credentials)
- `devkit-claude` (shown as **Claude Dev Kit**, renamed because Claude Code reserves `claude-*` identifiers)
- `desktop-commander`
- `cloudflare`
- `github-ops`

Plugin MCPs are declared under the plugin's marketplace entry and should appear as `plugin:<plugin-name>:<server>` in Claude Code's `/mcp` view. Authenticate there as needed. **Installing a plugin does not sign in to its third-party servers or replace an existing Claude.ai connector.**

This is a **Claude Code plugin marketplace**, not the Claude.ai connector directory or the Claude.ai website's Marketplace.

## Single source of truth

- `.agents/plugins/marketplace.json`: existing source directories and plugin list
- `*/plugin.json`: names, descriptions, versions, display metadata
- `*/mcp.json`: remote MCP endpoint URLs
- `*/skills/`: original bundled skills
- `*/branding.json`: explicit plugin/MCP/skill image slots; checked against native icon fields
- `.claude-plugin/marketplace.json`: **generated Claude Code adapter**, do not edit

To refresh after changing a canonical manifest:

```sh
python plugins/_shared/claude_marketplace.py --write
python plugins/_shared/claude_marketplace.py --check
```

The shared `Plugin Packages` workflow checks catalog freshness. Claude uses
marketplace-level MCP definitions because these plugin directories intentionally
have no `.claude-plugin/plugin.json` overrides. This allows one source manifest
and no duplicated `.mcp.json` endpoint list in Git.

ChatGPT uses portable `plugin.json` + `mcp.json` ZIPs. **A ZIP import does not
automatically create a single registered ChatGPT MCP App**, and manually
registering MCP Apps may show additional entries in the ChatGPT UI. Claude Code's
marketplace mechanism does not change those account-side connections. Do not
delete or revoke working Apps or OAuth grants as a packaging migration.
