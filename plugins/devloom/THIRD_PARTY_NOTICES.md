# Third-party notices

The plugin wrapper and repository integration are ISC-licensed (`LICENSE.txt`). Each skill keeps its own license and attribution below.

## `mcp-dev`

Condensed from Anthropic **mcp-server-dev** (Apache-2.0) and the MCP **ext-apps** plugin (MIT, modelcontextprotocol/ext-apps), re-verified 2026-11 against modelcontextprotocol.io (spec 2026-07-28 changelog, MCP Apps), claude.com/docs/connectors (auth, review criteria) and developers.openai.com/plugins (MCP Apps compatibility, `_meta` reference). Old version pins (ext-apps 1.2.2, spec 2025-11-25 as latest) dropped. `scripts/mcp_probe.py` is original.

search/fetch standard, MCP Apps archetypes, stateful-widget patterns and the validation ladder adapted from travnie's `openai-dev-kit` (`chatgpt-plugin-builder`, Apache-2.0), re-checked against developers.openai.com 2026-11.

`references/evals.md` condenses Anthropic `mcp-builder` `reference/evaluation.md`; `scripts/eval/` is its harness (Apache-2.0, `anthropics/skills@683bc88`) with twojstar's local fixes, and the stale default model replaced by a required `-m`.

SDK v2 traps (codemod, Zod ^4.2, `register*`, per-request server) checked against Anthropic `mcp-builder` (`anthropics/skills@ca45fc4`, Apache-2.0) on 2026-11-13; WebMCP bridge from ext-apps v2.1.0 (MIT).

## `plugin-dev`

Condensed from Anthropic **plugin-dev** (Apache-2.0) and re-verified 2026-11 against code.claude.com/docs, claude.com/docs (platform support matrix) and developers.openai.com/plugins (Agent Plugins, Codex overlay, submission rules). Stale enumerations (hook events, manifest fields) replaced by routing to the live docs MCPs. Rewritten, not verbatim.

`.app.json` / private-install flow and submission limits in `references/openai.md` adapted from travnie's `openai-dev-kit` (`chatgpt-plugin-builder`, Apache-2.0).

`references/claude-api.md` is a pointer sheet distilled from Anthropic's `claude-api` skill (`anthropics/skills@683bc88`, Apache-2.0) `SKILL.md` drift table and `shared/live-sources.md`.

## Remote MCP servers

Referenced by URL in `mcp.json`, not redistributed: `claude-code-docs` (https://code.claude.com/docs/mcp), `claude-ai-docs` (https://claude.com/docs/mcp), `claude-platform-docs` (https://platform.claude.com/docs/mcp), `mcp-docs` (https://modelcontextprotocol.io/mcp), `openai-docs` (https://developers.openai.com/mcp), `xai-docs` (https://docs.x.ai/api/mcp).

OpenAI Dev Kit material (Apache-2.0): unique builder scripts and references preserved under `skills/plugin-dev/` and `skills/docs-lookup/references/`. Repository-owned packaging remains ISC-licensed (`LICENSE.txt`); legacy standalone packaging was replaced with the shared canonical packager.
