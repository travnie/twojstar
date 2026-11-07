---
name: "plugin-dev"
description: "Build, fix or port Claude plugins (skills, agents, hooks, .mcp.json, LSP, marketplaces) for claude.ai, Cowork, Claude Code, Codex, Grok Build, Copilot CLI, Antigravity and Gemini CLI."
license: Apache-2.0
---

# Plugins + Claude internals

Plugin and Claude-product facts change weekly (hook events, manifest keys, CLI flags). **Look up, don't recall.** This skill = where to look + what bites across surfaces. SKILL.md content and packaging → `skill-creator-v2`. Mods (chat panels, status lines, hook modules) → `plugin-authoring`. MCP servers, MCP Apps and skills served over MCP (SEP-2640) → `mcp-dev`.

## Live docs

Look facts up with `docs-lookup` (which server answers what, how to read pages). Building with the Claude API / SDKs → `references/claude-api.md` (pointers + drift table).

## Surface matrix (claude.com/docs/plugins/platform-support, 2026-11)

| Component | Chat | Cowork | Claude Code | Codex/ChatGPT | Grok Build |
|---|---|---|---|---|---|
| `skills/<n>/SKILL.md` | ✓ | ✓ | ✓ | ✓ (portable) | ✓ |
| `commands/*.md` | as a skill | `/plugin:cmd` | ✓ | convert to skills | ✓ (Claude compat) |
| `agents/*.md` | ignored | ✓ | ✓ | convert to skills | ✓ |
| `hooks/hooks.json` | ignored | ✓ | ✓ | Codex desktop manual installs only; not directory-eligible | ✓, only PreToolUse blocks, fail-open |
| remote MCP (`http`/`sse`, fixed URL) | Connectors tab, user connects | ✓ | ✓ | `mcp.json` `streamable-http` | ✓ reads `.mcp.json` |
| local MCP / `.mcpb` | ignored | local sessions | ✓ | desktop-only | stdio ✓ |
| `${user_config.*}` in MCP URL | ignored | ignored without default | prompts | not expanded — use MCP auth | use `${ENV}` instead |
| top-level `bin/` | **refuses whole plugin** | refuses | ✓ | keep helpers in skill `scripts/` | ? untested |
| LSP, output styles, themes, `settings` | ignored | ignored | ✓ | drop | LSP ✓, rest own config |

Other hosts (Grok Build, Copilot CLI, Antigravity, Gemini CLI, M365 Copilot Cowork): Grok and Copilot CLI load this layout as-is; Antigravity imports it (`agy plugin import claude`) or takes an `.antigravity-plugin/` overlay; Gemini CLI needs `gemini-extension.json`. Paths, overlays, traps, docs → `references/hosts.md`.

Design rule: put the value in **skills + remote MCP**; everything else is an add-on for Claude Code. Never put tokens in `.mcp.json` URLs (user connects/auths per surface).

## Portable layout (house convention)

```
plugin/
├── .claude-plugin/plugin.json   # Claude identity; mcpServers: "./.mcp.json"
├── .codex-plugin/plugin.json    # OpenAI overlay: skills, mcpServers, interface{displayName, shortDescription, longDescription, brandColor, composerIcon, logo, defaultPrompt[]}
├── .mcp.json                    # { "mcpServers": { name: { "type": "http", "url": … } } }
├── skills/<name>/SKILL.md (+ references/ scripts/ agents/openai.yaml assets/icon.svg)
├── assets/icon.svg + icon.png   # 512², rounded square
└── README.md
```

In `travnie/twojstar` the convention is inverted: root Agent Plugins `plugin.json` + `mcp.json` + `branding.json` are canonical, the Claude marketplace and Codex overlay are generated (`plugins/_shared/`); follow that repo's README there.

Optional overlays for Antigravity (`.antigravity-plugin/plugin.json` + `mcp_config.json`) and Gemini CLI (`gemini-extension.json`) sit beside these — full seven-host layout in `references/hosts.md`.

OpenAI's newer portable form (root `plugin.json` with `$schema: agent-plugins.org/.../plugin.schema.json` + `extensions.com.openai`, root `mcp.json` with `type: "streamable-http"`) wins over `.codex-plugin/` when present — not merged. Details, auth blocks, marketplace format: `references/openai.md`.

## Gotchas

- `name` kebab-case, stable: it's the namespace (`plugin:skill`) and the update key. Renaming = new plugin; tell the user to uninstall the old one.
- Bump `version` or users never get the update (Claude Code pins it; OpenAI rejects same version).
- Paths `./`-relative, inside the plugin root. Unknown top-level keys are stripped (warning); unknown keys inside `userConfig`/`lspServers`/`channels`/`monitors` fail the load.
- `${CLAUDE_PLUGIN_ROOT}` for bundled scripts; `${CLAUDE_PLUGIN_DATA}` for writable state. Codex sets `PLUGIN_ROOT`/`PLUGIN_DATA` and also the Claude names.
- Skill instructions say "the model"/"Claude" carefully: OpenAI review wants provider-neutral wording unless product-specific.
- claude.ai frontmatter allowlist and chat rewrites → `skill-creator-v2` `references/claude-ai-compat.md`.
- LSP plugins ship config, not the server: the binary must be on PATH where Claude Code runs. Chat never runs LSP.

## Verify

1. JSON parses; every referenced path exists; skill `quick_validate` (skill-creator-v2).
2. Claude Code available → `claude plugin validate <dir>` (authoritative), then `claude plugin eval` if the plugin has evals.
3. MCP URLs answer `initialize` (see `mcp-dev` probe).
4. Zip with the plugin folder contents at archive root; deliver; user uploads in Customize → Plugins (account) — it syncs to Claude Code next session.

Component deep dives (commands, agents, hooks, userConfig, marketplaces): `references/claude-code.md`.
