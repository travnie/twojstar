# Other agent hosts

How a house-layout plugin (`.claude-plugin/` + `.codex-plugin/` + `.mcp.json` + `skills/`) lands outside Claude and Codex. Checked 2026-11 against each vendor's docs.

## Where to look things up

Only `xai-docs` ships in this plugin. For the rest, **don't assume a connector exists**: if the session's tool list happens to have it, use it; otherwise WebFetch the official pages. Mention the connector to the user as an optional faster path, nothing more.

| Host | Official docs | Optional connector, if the user has it |
|---|---|---|
| Grok Build | docs.x.ai/build | `xai-docs` (bundled) |
| GitHub Copilot CLI / cloud agent / VS Code | docs.github.com/en/copilot (`cli-plugin-reference`, `add-skills`) | GitHub MCP `github_support_docs_search` |
| Google Antigravity (`agy`, App, IDE) | antigravity.google/docs (`plugins`, `build-plugins`, `skills`, `mcp`, `hooks`) | Google Developer Knowledge MCP `developerknowledge.googleapis.com/mcp` |
| Gemini CLI | geminicli.com/docs (`extensions/reference`, `cli/skills`) | Google Developer Knowledge MCP |
| Microsoft 365 Copilot / Copilot Cowork | learn.microsoft.com/microsoft-365-copilot/cowork/cowork-plugin-development | Microsoft Learn MCP `learn.microsoft.com/api/mcp` |

## Compatibility at a glance

| Host | Reads Claude plugin as-is? | What to add for a clean fit |
|---|---|---|
| Grok Build | **Yes** — plugins, skills, MCP, agents, hooks, `CLAUDE.md` | nothing; optional `metadata.short-description` |
| Copilot CLI | **Yes** — legacy manifest search order `.plugin/` → root → `.github/plugin/` → `.claude-plugin/plugin.json`; `.mcp.json`, `hooks/hooks.json`, `agents/` (`*.agent.md`), `skills/`; marketplaces incl. `.claude-plugin/marketplace.json` | nothing. A root Agent Plugins `plugin.json` (`$schema` 1.0.0/1.1.0) **wins** and switches to strict mode: skills + root `mcp.json` only, Copilot extras under `com.github.copilot/` — don't add one casually |
| Antigravity | Skills yes; plugin via **`agy plugin import claude`** or an overlay | `.antigravity-plugin/plugin.json` (wins over root `plugin.json`; for repos that also ship `.claude-plugin/`) with `displayName`, `logo`, `suggestedPrompts` (≤3); MCP in root `mcp_config.json` (`serverUrl`); hooks in root `hooks.json`; `rules/`; validate `agy plugin validate --strict` |
| Gemini CLI | Skills yes; plugin no | `gemini-extension.json` (`name` = dir name, `version`, `description`, `mcpServers`, `contextFileName`, `settings[]` for env vars); skills in `skills/`, hooks `hooks/hooks.json`, agents `agents/` (preview), commands as TOML |
| M365 Copilot Cowork | Treats the Claude layout as the superset | convert with `atk import openplugin --path ./plugin --privacy-url … --terms-url …` (or `wiqd plugin import`) for the M365 store |

## Seven-host package (worked example: the account build of `claudin`)

```
claudin/
├── .claude-plugin/plugin.json        # Claude; also read by Copilot CLI, Grok
├── .codex-plugin/plugin.json         # Codex/ChatGPT overlay
├── .antigravity-plugin/plugin.json   # Antigravity overlay (displayName, logo, suggestedPrompts)
├── gemini-extension.json             # Gemini CLI (mcpServers with httpUrl)
├── .mcp.json                         # Claude/Codex/Copilot/Grok: type http + url
├── mcp_config.json                   # Antigravity: serverUrl
└── skills/  assets/  README.md
```

Three MCP files, one server list: change them together (`url` / `httpUrl` / `serverUrl`) — or, as in `travnie/twojstar`, keep one portable `mcp.json` and generate the rest at packaging. Gemini's `name` must equal the install directory name. Don't add a root Agent Plugins `plugin.json` here — it would win in Copilot and Codex and change their behavior.

## Cross-host traps

- **Skill locations everyone reads:** `.agents/skills/` (project) and `~/.agents/skills/` (personal) — Copilot, Antigravity, Grok, Codex. `.claude/skills/` is also read by Copilot CLI, Visual Studio and Grok.
- **`allowed-tools` means different things:** Claude Code pre-approves; Copilot auto-allows (pre-approving `shell` is a real risk); Grok ignores it. Don't rely on it for safety or for permissions.
- **Names:** Antigravity rejects `name`/`displayName` starting with "Claude", "Gemini", "Antigravity", "Cursor" in its marketplace; Agent Plugins names allow `.` but not `--`/`..`. Keep plain kebab-case.
- **Env vars:** `${CLAUDE_PLUGIN_ROOT}` is aliased by Copilot (agent `mcp-servers`) and by Codex in hook commands only (Codex `mcp.json` needs `${PLUGIN_ROOT}`); Antigravity wants relative `./scripts/…` in hooks instead; Gemini uses `${extensionPath}`; Grok sets `GROK_PLUGIN_ROOT`. Hook scripts that must run everywhere: resolve their own path (`$(dirname "$0")`).
- **MCP precedence differs:** Copilot = last loaded wins (a plugin overrides your same-named server); Gemini = `settings.json` wins over extensions; Grok = `config.toml` wins over `.mcp.json`/Claude configs. Use distinctive server names.
- **Remote MCP placeholders:** Copilot passes remote URLs/headers literally (no `${VAR}`); Grok and Gemini expand env vars. No secrets in URLs either way.

## Check per host

`claude plugin validate` · `copilot plugin install ./dir` + `/skills list` · `agy plugin validate --strict ./dir` · `gemini extensions link .` · `grok inspect` / `grok plugin validate`.

# Grok Build detail

Re-check with `xai-docs` (`search_docs` → `get_doc_page` by slug, e.g. `build/features/skills-plugins-marketplaces`).

### Compatibility

Grok Build reads Claude Code marketplaces, plugins, skills, MCP configs, agents, hooks and `CLAUDE.md` / `CLAUDE.local.md` / `.claude/rules/` with zero config, plus `AGENTS.md` and `~/.agents/skills|commands/`. A house-layout plugin (`.claude-plugin/` + `.mcp.json` + `skills/`) works as-is — no third manifest. Don't add `.grok/` files unless something Grok-only is needed.

### Where it looks

| Thing | Paths |
|---|---|
| Skills | `./.grok/skills/` (walked to repo root), `~/.grok/skills/`, enabled plugins' `skills/`, `[skills] paths` in `~/.grok/config.toml` |
| Plugins | `./.grok/plugins/`, `~/.grok/plugins/`, `~/.grok/plugins/marketplaces/`, `[plugins] paths`, `--plugin-dir <PATH>` |
| Hooks | `~/.grok/hooks/*.json`, project `.grok/hooks/` (needs `/hooks-trust`), plugins, `.claude/settings.json`, `.cursor/hooks.json` |
| MCP | `~/.grok/config.toml` `[mcp_servers.<n>]`, project `.grok/config.toml` (walked to git root), then `~/.claude.json`, `.cursor/mcp.json`, project `.mcp.json` (lower priority; `[compat.claude] mcps = false` to disable) |
| Agents | `.grok/agents/`, `~/.grok/agents/` (+ Claude agents); personas = tone overlays only |

### Skill frontmatter differences

- Extra keys ignored, so portable SKILL.md is fine.
- Adds `when-to-use` (extra trigger phrases), `user-invocable` (literal `true` only; `false` hides from user **and** model), `paths` (gitignore globs, hidden until a matching file is touched).
- `allowed-tools` accepted but neither grants nor restricts. `model`, `effort`, `license`, `compatibility` accepted, not applied.
- `metadata.author` / `metadata.short-description` show in the UI — cheap win, set them.

### Hooks differences

- Events mirror Claude's names (SessionStart/End, UserPromptSubmit, Pre/PostToolUse, PostToolUseFailure, PermissionDenied, Stop/StopFailure, Notification, SubagentStart/Stop, Pre/PostCompact). Claude tool names (`Bash`, `Read`, `Edit`) map automatically in `matcher`.
- **Only `PreToolUse` blocks**: exit 2 or explicit `deny`. Timeouts, crashes, malformed output **fail open**. Default timeout 5 s (Claude's is longer) — keep guard scripts fast.
- Handler types `command` and `http`. Env: `GROK_PLUGIN_ROOT`, `GROK_PLUGIN_DATA`, `GROK_HOOK_EVENT`, `GROK_SESSION_ID`, `GROK_WORKSPACE_ROOT`. Whether `${CLAUDE_PLUGIN_ROOT}` expands in Claude-format plugin hooks isn't documented — test with `grok inspect` before relying on it.

### MCP config

`grok mcp add --transport http <name> <url> [--header "Authorization: Bearer ${TOKEN}"]`; OAuth runs a browser flow, tokens in `~/.grok/mcp_credentials.json`. `${VAR}` / `${VAR:-default}` expand in `url`, `command`, `args`, `env`, `headers` — secrets stay in env. Tools namespaced `<server>__<tool>`. `tool_timeout_sec` default 6000 (long blocking tools OK).

### Check

`grok inspect [--json]` (everything discovered + origin), `grok plugin validate`, `grok mcp doctor [name]`, stderr logs in `~/.grok/logs/mcp/<server>.stderr.log`. Claude flags accepted as aliases (`--allowedTools`, `--append-system-prompt`, `-p` headless); `grok agent stdio` runs it as an ACP agent.

### Grok as a model (xAI API)

Current model ids, pricing, structured outputs, prompt caching, multi-agent, Batch API: query `xai-docs` (`developers/models`, `developers/model-capabilities/text/*`, `developers/advanced-api-usage/*`). Also on Vertex AI and Microsoft Foundry. Don't hardcode model names — they rotate (e.g. `grok-4.7` as of 2026-11).
