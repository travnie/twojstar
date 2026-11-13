# OpenAI side (Codex, ChatGPT)

From developers.openai.com/plugins, 2026-11. Re-check with the `openai-docs` MCP (`search_openai_docs` → `fetch_openai_doc`) before quoting field names.

## Three accepted shapes (newest first)

1. **Agent Plugins portable** — root `plugin.json` (`"$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`), root `skills/`, root `mcp.json`. OpenAI extras under `extensions["com.openai"]`: `interface`, `apps`, `hooks`, `onboardingSkill`.
2. **Codex overlay** — `.codex-plugin/plugin.json` with `skills`, `mcpServers`, `apps`, `hooks`, `interface`. Used only when root `extensions.com.openai` is absent (never merged).
3. **Claude format** — `.claude-plugin/plugin.json`; the submission portal converts it to `.codex-plugin/plugin.json`.

House default: (2)+(3) side by side — every surface already reads it. Add (1) when publishing to OpenAI's directory; then either keep (1) as source and generate (2) + `.mcp.json` at packaging, or maintain both by hand — never let them drift. Careful: a root Agent Plugins `plugin.json` also flips Copilot CLI into strict mode (`references/hosts.md`).

## Portable `mcp.json`

```json
{ "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": { "docs": { "type": "streamable-http", "url": "https://example.com/mcp",
    "extensions": { "com.openai": { "auth": { "type": "none" } } } } } }
```

Auth `type`: `none` · `oauth` (`client.mode`: `provided` + `clientId` | `dcr` | `cimd`) · `mixed` · `api_key` (`headerScheme`: `bearer` | `basic` | `custom_header` + `headerName`). Never a secret in the file. Don't just rename Claude's `.mcp.json`: portable needs `type: "streamable-http"`.

## `interface` fields

`displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities` (`Interactive`/`Read`/`Write`), `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`, `defaultPrompt[]` (≤3 good), `brandColor`, `composerIcon`, `logo`, `screenshots` (With-MCP submissions only). Paths `./`-relative, assets under `./assets/`.

## Registered MCP (`.app.json`) — private installs only

A remote URL in `mcp.json` doesn't prove ChatGPT imported a connectable app. For a private/workspace install: register the endpoint in ChatGPT (Plugins → Add custom MCP server → Create as a plugin), copy its ID, map it in `.app.json` referenced by `extensions.com.openai.apps: "./.app.json"`. A page ID `plugin_asdk_app_<id>` maps to `asdk_app_<id>`. Never invent the ID; keep it out of repo source (inject at packaging). Public submission: drop `.app.json` and every `apps` field, submit the endpoint via **With MCP**. Don't name the package and its connection identically — both show in the directory.

## Limits that bite

`interface.shortDescription`: one line, ≤240 chars to package, **≤30 for directory submission** — default to ≤30. `version` must change per upload. Paths `./`-relative inside the root.

## Claude → OpenAI conversion rules

| Claude thing | OpenAI |
|---|---|
| commands/, agents/ | turn into skills |
| hooks | remove for public directory; Codex desktop manual installs only, user must trust them |
| userConfig / `${user_config.*}` | not supported → MCP auth |
| live artifacts in skill instructions | not supported → plain output |
| bin/, settings, CLAUDE.md | keep helpers inside the plugin, call by package-relative path |
| LSP, output styles, themes, monitors, channels, dependencies | drop or move behavior into skills |
| "Claude" in skill text | provider-neutral ("the model") unless product-specific |
| skills-only ZIP | MCP config excluded unless org approved; submit remote MCP via "With MCP" |

Per-skill presentation stays in `skills/<n>/agents/openai.yaml` (see `skill-creator-v2` `references/openai-compat.md`).

## Local testing

Marketplace file: repo `.agents/plugins/marketplace.json` or `~/.agents/plugins/marketplace.json`; entries `{ name, source: { source: "local", path: "./plugins/x" }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" }, category }`. CLI: `codex plugin marketplace add owner/repo`. Installed cache: `~/.codex/plugins/cache/<market>/<plugin>/<version>/`. Enable per repo in `.codex/config.toml` `[plugins."name@market"] enabled = true`. Built-in `@plugin-creator` / `$plugin-creator` scaffolds the Codex layout.
