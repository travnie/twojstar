# Claude Code components

Shapes only. Field lists grow every release — confirm on code.claude.com/docs (`en/plugins/manifest-reference`, `en/skills`, `en/hooks`, `en/sub-agents`, `en/plugins/marketplace-reference`) via the `claude-code-docs` MCP before writing.

## Skills vs commands

Commands were merged into skills: `commands/deploy.md` and `skills/deploy/SKILL.md` both give `/deploy`. New work → skills (supporting files, auto-loading). Claude Code-only frontmatter extras (`disable-model-invocation`, `allowed-tools` per-turn pre-approval, `disallowed-tools`, `context: fork`, `agent`, `argument-hint`, `model`, `paths`) are ignored or rejected elsewhere — keep portable skills to `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`.

## Agents (`agents/*.md`, Claude Code + Cowork only)

```markdown
---
name: code-reviewer            # unique, ≤256 chars
description: When to delegate — concrete triggers in prose
tools: Read, Grep, Glob        # omit = inherit all
model: inherit                 # or sonnet/opus/haiku/fable/full id
---
System prompt: role, inputs it gets, steps, output format, what not to do.
```

The agent starts cold: its prompt must carry everything. Reusable procedure that also matters in chat → make it a skill, keep the agent as a thin wrapper.

## Hooks (`hooks/hooks.json`, Claude Code + Cowork; Codex desktop manual)

```json
{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [
  { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh", "timeout": 10 } ] } ] } }
```

- Script reads JSON on stdin; returns JSON on stdout (e.g. `hookSpecificOutput.permissionDecision: "deny"` + reason) or exits 2 to block with stderr shown to Claude. Exit 0 with no output = no opinion.
- 30+ events now (SessionStart, UserPromptSubmit, Pre/PostToolUse, PostToolUseFailure, PermissionRequest, Stop, SubagentStart/Stop, PreCompact, FileChanged, Worktree*, …) and several handler types — list them from `en/hooks`, never from memory.
- Hooks are code the user didn't read: scope matchers tightly, fail open on parse errors unless blocking is the point, no network unless stated in README.
- Chat ignores `hooks.json`; chat-side behavior changes are **mods** (`plugin-authoring` skill).

## userConfig

`userConfig.<key>: { type, title, description, sensitive?, default? }`, referenced as `${user_config.key}`. Claude Code prompts; chat ignores MCP entries whose URL uses it; Cowork ignores without default; OpenAI never expands it. Credentials → MCP OAuth instead.

## LSP (`.lsp.json` or `lspServers`)

`{ "kotlin": { "command": "kotlin-lsp", "extensionToLanguage": { ".kt": "kotlin", ".kts": "kotlin" } } }` — strict keys (`command`, `extensionToLanguage` required; `args`, `env`, `initializationOptions`, `settings`, `startupTimeout`, `requestTimeout`, `restartOnCrash` …). Binary installed separately. Official ones live in `anthropics/claude-plugins-official` (`*-lsp`).

## MCP in a plugin

`.mcp.json` or `mcpServers` (path / inline / `.mcpb`). Remote: `{ "type": "http", "url": "…" }`. Local: `{ "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"] }` (Claude Code only). Same URL as an existing claude.ai connector → install reuses that connector and its sign-in.

## Marketplace (`.claude-plugin/marketplace.json`)

```json
{ "name": "trvny-plugins", "owner": { "name": "Bartek" },
  "plugins": [ { "name": "google", "source": "./plugins/google", "description": "…" } ] }
```

Relative `source` works only when the marketplace is a git repo (cloned whole). Bare-URL marketplaces need `{ "source": "github", "repo": "owner/repo" }` or archive sources. Codex reads `.claude-plugin/marketplace.json` as legacy-compatible, prefers `.agents/plugins/marketplace.json`.

## Checks

`claude plugin validate <dir>` (add `--strict` in CI), `claude plugin eval` for eval suites, `/plugin` → Errors tab, `claude --debug` for load traces.
