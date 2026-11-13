# Plugin shapes and files

Use root `plugin.json` with the Agent Plugins 1.0 schema. Portable clients discover
`skills/` and `mcp.json` at fixed paths. Do not add top-level compatibility fields
(`skills`, `mcpServers`, `apps`, `interface`) to the portable manifest.

- **Skills:** `skills/<name>/SKILL.md`; optional metadata in `agents/openai.yaml`.
- **Portable MCP:** root `mcp.json`, MCP schema, named `mcpServers`, explicit transport `type`.
- **Private registered MCP:** `.app.json`, with `extensions.com.openai.apps: "./.app.json"`.
  Use verified underlying App IDs. A connection page ID `plugin_asdk_app_<id>` maps to
  `asdk_app_<id>`; never invent the ID or assume an endpoint auto-registers during import.
- **Assets:** root `assets/`; interface asset paths relative to the plugin root.
- **Compatibility:** only `plugin.json` inside `.codex-plugin/`. Generate `.mcp.json`
  and `skills`/`mcpServers` declarations for older clients when needed.

When `extensions.com.openai` exists, it replaces the whole compatibility overlay.
For public directory submission, exclude `.app.json` and all `apps` declarations;
submit the verified remote endpoint through the supported With MCP flow.
