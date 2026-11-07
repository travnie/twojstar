---
name: "docs-lookup"
description: "Answer questions about Claude Code, claude.ai/Cowork, the Claude API, MCP, OpenAI/Codex/ChatGPT and xAI/Grok from their live official docs, with links. Use for any 'how does X work', 'is there a flag/setting for', 'what changed', limits or config question about these, even when nothing is being built."
license: Apache-2.0
---

# Docs lookup

These products change weekly; memory is months old. **Search the docs, read the page, answer with the link.** No building required. Building something → `plugin-dev` (plugins), `mcp-dev` (MCP servers/Apps), `skill-creator-v2` (skills).

## Where to ask

Bundled with this plugin, public and authless:

| Server | Ask it about |
|---|---|
| `claude-code-docs` — code.claude.com/docs | Claude Code: CLI, settings, permissions, hooks, subagents, skills, plugins, marketplaces, LSP, `claude plugin validate`/`eval`, Agent SDK |
| `claude-ai-docs` — claude.com/docs | claude.ai and Cowork: features, plugins & skills, **component support by surface**, connectors, directory submission + review criteria, MCP Apps in Claude |
| `claude-platform-docs` — platform.claude.com/docs | Claude API: Messages, tools, MCP connector, Managed Agents, models, pricing, SDK reference (`sdk_language` param) |
| `mcp-docs` — modelcontextprotocol.io | MCP spec revisions and changelogs, SDKs, extensions (Apps, Skills), Inspector |
| `openai-docs` — developers.openai.com | OpenAI API, Codex, ChatGPT apps/plugins, Agent Plugins manifest, Apps SDK |
| `xai-docs` — docs.x.ai | Grok Build (plugins, skills, hooks, MCP, CLI) and the xAI API. Tools: `search_docs`, `get_doc_page` (slug), `list_doc_pages` |

Anything else (GitHub Copilot, Antigravity, Gemini CLI, M365): official pages listed in `plugin-dev` `references/hosts.md`; use a matching connector only if it's already in the session's tool list, else WebFetch. Claude plans, usage limits and pricing: `product-self-knowledge` too. Claude API model IDs and renamed params: `plugin-dev` `references/claude-api.md` drift table.

## How

1. Pick the server by product, not by keyword ("Claude Code hooks" → `claude-code-docs`, not `claude-ai-docs`). Unsure → search two in parallel.
2. Search with the product's own terms, then **read the full page** (`query_docs_filesystem…` `cat /path.mdx`, `fetch_openai_doc`, `get_doc_page`). Snippets drop the caveat that matters.
3. Answer from the page. Quote exact names (flags, keys, events) as written; say which version/date the page states when it has one.
4. End with the page URL(s). Docs silent or contradictory → say so; don't fill the gap from memory.
