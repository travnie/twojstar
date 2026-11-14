# MCP app and plugin build

## Select the shape

- Tools only: live retrieval/actions without in-chat visual controls.
- MCP Apps UI: inspection, comparison, editing, or repeated interaction benefits from a widget.
- Skill only: repeatable instructions and local resources suffice, no live external integration.
- Skill plus MCP: the workflow combines live tools with reusable instructions.

Choose the smallest usable shape. Plan one distinct user action per tool. Describe inputs, outputs, side effects, and authorization; use bounded machine-readable schemas and accurate `readOnlyHint`, `openWorldHint`, `destructiveHint` (and `idempotentHint` where appropriate). Supply `outputSchema` for structured results. Keep secrets and unnecessary personal data out of results.

For knowledge/connector workflows, check current [search/fetch guidance](https://developers.openai.com/plugins/build/mcp-server) before adopting the standard `search` and `fetch` tool shape. Use canonical URLs when citations matter.

## Build sequence

1. Check the current official [quickstart](https://developers.openai.com/plugins/quickstart), [examples](https://developers.openai.com/plugins/build/examples), and applicable SDK docs. Adapt the nearest maintained example; use the bundled Node scaffold only for a small vanilla fallback.
2. Implement MCP tools with results useful to the model independently of UI: concise `structuredContent`, helpful `content`, and private widget data in `_meta` only when warranted. `_meta` does not provide authorization.
3. If UI helps, register an MCP Apps resource and link selected tools through `_meta.ui.resourceUri`. Use the standard `ui/*` bridge for input, results, messages, and tool calls. Add `window.openai` only for ChatGPT capabilities the bridge lacks. Read [interaction-patterns.md](interaction-patterns.md) for persistent widgets.
4. Scope resource/CSP domains to actual requests. Keep UI resource identifiers stable within a version and change them deliberately when the template changes. Keep dev run instructions and the `/mcp` endpoint clear.
5. If packaging as a plugin, use the current portable root `plugin.json` shape; `.codex-plugin/plugin.json` is a supported compatibility layout. Include only real components and relative paths; registered MCP connection mappings require a real connection ID, never a placeholder claimed as working. See [plugin packaging](https://developers.openai.com/plugins/build/plugins).
6. Validate metadata and syntax, run the server, inspect MCP responses, then exercise ChatGPT developer mode if available. Report the highest level reached, not an implied end-to-end pass.

The scaffold script writes package files into the chosen output directory. It embeds SDK versions from its source date, so check and update generated dependencies and metadata against current docs before use.
