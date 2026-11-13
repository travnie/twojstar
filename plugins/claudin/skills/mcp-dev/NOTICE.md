# Attribution
Condensed from Anthropic **mcp-server-dev** (Apache-2.0) and the MCP **ext-apps** plugin (MIT, modelcontextprotocol/ext-apps), re-verified 2026-11 against modelcontextprotocol.io (spec 2026-07-28 changelog, MCP Apps), claude.com/docs/connectors (auth, review criteria) and developers.openai.com/plugins (MCP Apps compatibility, `_meta` reference). Old version pins (ext-apps 1.2.2, spec 2025-11-25 as latest) dropped. `scripts/mcp_probe.py` is original.

search/fetch standard, MCP Apps archetypes, stateful-widget patterns and the validation ladder adapted from travnie's `openai-dev-kit` (`chatgpt-plugin-builder`, Apache-2.0), re-checked against developers.openai.com 2026-11.

`references/skills.md` summarizes the MCP Skills extension (SEP-2640, modelcontextprotocol.io/extensions/skills, checked 2026-11-07). The OpenAPI mapping rules in `references/tools.md` are condensed from mcp-use's `openapi-to-mcp` skill (Apache-2.0, mcp-use/mcp-use); the 2026-11 ext-apps additions in `references/apps.md` (split SDK packages, `_meta.ui.csp` placement, handler order, hybrid apps, basic-host) come from the ext-apps `mcp-apps` plugin skills (MIT).

`references/evals.md` condenses Anthropic `mcp-builder` `reference/evaluation.md`; `scripts/eval/` is its harness (Apache-2.0, `anthropics/skills@683bc88`) with twojstar's local fixes, and the stale default model replaced by a required `-m`.
SDK v2 traps (codemod, Zod ^4.2, `register*`, per-request server) checked against Anthropic `mcp-builder` (`anthropics/skills@ca45fc4`, Apache-2.0) on 2026-11-13; WebMCP bridge from ext-apps v2.1.0 (MIT).
