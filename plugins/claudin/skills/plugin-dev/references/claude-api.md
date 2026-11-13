# Claude API — pointers, not a copy

Building against the Claude API / Anthropic SDKs. Source of truth: `claude-platform-docs` MCP (`search_docs`, `sdk_language` param); WebFetch `https://platform.claude.com/docs/en/<path>.md` only when that connector is unavailable (see `docs-lookup`). Full offline reference (8 SDK languages, Managed Agents, evals, migration and prompt-audit flows): Anthropic's upstream `claude-api` skill, `github.com/anthropics/skills/tree/main/skills/claude-api` — install it only if API work becomes regular.

## Rules that save rework

- Use the project's official SDK (`anthropic`, `@anthropic-ai/sdk`, `com.anthropic.*`, …); raw HTTP only for shell/cURL projects or no-SDK languages. Never OpenAI-compat shims.
- Never guess SDK names or signatures — read the SDK repo (`github.com/anthropics/anthropic-sdk-<python|typescript|java|go|ruby|csharp|php>`) or docs first. Network blocked → compile/run and iterate on errors.
- Model id, pricing, limits: look up (`about-claude/models/overview`, `about-claude/pricing`) every time.
- Long input/output or high `max_tokens` → stream (`get_final_message()` / `finalMessage()`).
- File already on another provider (OpenAI, Gemini, …) → ask before converting it.

## Drift points (training priors that are now wrong, per upstream 2026-11)

| Area | Stale | Current |
|---|---|---|
| Thinking | `{type: "enabled", budget_tokens}` | `{type: "adaptive"}` on 4.6+; `budget_tokens` rejected on newest models |
| Web search/fetch tool | `web_search_20250305`, `web_fetch_20250910` | `*_20260209` on current models (Vertex: basic search only) |
| Files / Skills API | `client.beta.files` / `beta.skills` + beta header | GA `client.files` / `client.skills`, no header |
| Managed Agents secrets | host-side custom tools | vault credentials substituted at egress |

Re-check this table against `about-claude/models/migration-guide` before relying on it.

## Where to look

| Topic | Docs path (under `/docs/en/`) |
|---|---|
| Models, migration, cost | `about-claude/models/overview`, `…/migration-guide`, `…/optimizing-for-cost-and-intelligence`, `about-claude/pricing` |
| Thinking, effort | `build-with-claude/adaptive-thinking`, `…/extended-thinking`, `…/effort` |
| Tools | `agents-and-tools/tool-use/overview`, `…/tool-search-tool`, `…/programmatic-tool-calling`, `…/code-execution-tool`, `…/computer-use-tool`, `…/memory-tool` |
| Caching, context | `build-with-claude/prompt-caching`, `…/context-windows`, `…/compaction`, `…/context-editing`, `…/token-counting` |
| Output, media | `build-with-claude/structured-outputs`, `…/streaming`, `…/citations`, `…/vision`, `…/pdf-support`, `…/files`, `…/batch-processing` |
| Skills via API | `build-with-claude/skills-guide`, `agents-and-tools/agent-skills/overview` |
| Managed Agents | `managed-agents/overview`, `…/environments`, `…/mcp-connector`, `…/memory`, `…/multiagent-orchestration`, `…/events-and-streaming` |
| Ops | `api/errors`, `api/rate-limits`, `manage-claude/admin-api`, `…/workspaces`, `…/usage-cost-api` |
| Clouds | `build-with-claude/claude-on-amazon-bedrock`, `…/claude-platform-on-aws` |

Claude Code users also have the `claude-code-guide` agent for API and Agent SDK questions; chat has the built-in `product-self-knowledge` skill.
