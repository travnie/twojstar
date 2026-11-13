---
name: "docs-lookup"
description: "Get facts from live official docs through docs MCP connectors, not WebFetch or web search: Claude Code, claude.ai/Cowork, Claude API, MCP, ACP, OpenAI/Codex, xAI/Grok, plus any docs connector the session has. Use whenever a doc fact matters: answering, building, reviewing or debugging."
license: Apache-2.0
---

# Docs lookup

These products change weekly; memory is months old. Any time a fact from their docs matters (a flag, manifest key, hook event, API field, limit), get it from the docs **connector**, whether you are answering a question or halfway through building something. `plugin-dev`, `mcp-dev` and `skill-creator-v2` all look things up this way.

## Connectors first

- A docs connector for the domain is in the tool list → use it. Don't WebFetch or web-search pages of the same site: the connector returns the current page as clean text, searches the whole site and costs fewer calls.
- Fall back to WebFetch only when no connector covers it, or the connector errors or times out (say so in one line).
- Web search is for things outside official docs (issues, release chatter), never to find a page a connector can search.

## Where to ask

Bundled with this plugin, public and authless:

| Server | Ask it about |
|---|---|
| `claude-code-docs` — code.claude.com/docs | Claude Code: CLI, settings, permissions, hooks, subagents, skills, plugins, marketplaces, LSP, `claude plugin validate`/`eval`, Agent SDK |
| `claude-ai-docs` — claude.com/docs | claude.ai and Cowork: features, plugins & skills, **component support by surface**, connectors, directory submission + review criteria, MCP Apps in Claude |
| `claude-platform-docs` — platform.claude.com/docs | Claude API: Messages, tools, MCP connector, Managed Agents, models, pricing, SDK reference (`sdk_language` param) |
| `mcp-docs` — modelcontextprotocol.io | MCP spec revisions and changelogs, SDKs, extensions (Apps, Skills), Inspector |
| `acp-docs` — agentclientprotocol.com | Agent Client Protocol (editor ↔ coding agent): protocol v1/v2 and migration, sessions, tool calls, terminals, transports, libraries (TS, Python, Rust, Kotlin, Java), ACP registry, RFDs |
| `openai-docs` — developers.openai.com | OpenAI API, Codex, ChatGPT apps/plugins, Agent Plugins manifest, Apps SDK |
| `xai-docs` — docs.x.ai | Grok Build (plugins, skills, hooks, MCP, CLI) and the xAI API. Tools: `search_docs`, `get_doc_page` (slug), `list_doc_pages` |

Not bundled but often connected — use when present: GitHub docs (GitHub MCP `github_support_docs_search`), Google Developer Knowledge (Android, Chrome, Firebase, Gemini CLI), Microsoft Learn (Azure, .NET, M365), Cloudflare docs, Context7 (library and framework docs). Hosts without any connector (Antigravity, Copilot CLI pages): official URLs in `plugin-dev` `references/hosts.md`, via WebFetch. Claude plans, usage limits and pricing: `product-self-knowledge` too. Claude API model IDs and renamed params: `plugin-dev` `references/claude-api.md` drift table.

## How

1. Pick the server by product, not by keyword ("Claude Code hooks" → `claude-code-docs`, not `claude-ai-docs`). Unsure → search two in parallel.
2. Search with the product's own terms, then **read the full page** (`query_docs_filesystem…` `cat /path.mdx`, `fetch_openai_doc`, `get_doc_page`). Snippets drop the caveat that matters.
3. Use what the page says: answer from it, or build to it. Quote exact names (flags, keys, events) as written; say which version/date the page states when it has one.
4. Answers end with the page URL(s); while building, cite the URL in a code comment or commit only where a non-obvious choice depends on it. Docs silent or contradictory → say so; don't fill the gap from memory.
