---
name: openai-dev
description: 'Use for OpenAI developer work needing current official docs: API or Codex documentation questions, model choices or migration, MCP servers and ChatGPT plugin UI, plugin packaging, and public submission. Apply only to OpenAI product development and documentation, not generic software work.'
---

# OpenAI developer workflows

Choose only the branch the request needs. The MCP endpoint below is **OpenAI documentation**, not an MCP server to package or submit as the user's own app.

## Source route

1. Use available OpenAI Developer Docs MCP search and fetch tools; check the OpenAPI spec tool for exact API shapes. For broad Codex behavior, use the current Codex manual when available. Search/fetch only the relevant pages, not the entire documentation.
2. If those tools are absent or insufficient, retrieve the relevant page from `developers.openai.com` or `platform.openai.com`. Prefer the page's `.md` version when available. Verify volatile model IDs, SDK APIs, limits, schemas, and submission rules for this task. Cite the official source when answering with current facts.
3. If no source is accessible, state the verification limit; do not invent current product behavior. Never require installation, restart, or authentication merely to answer from an accessible official source.

Official entry points: [Docs MCP](https://developers.openai.com/learn/docs-mcp), [API docs](https://developers.openai.com/api/docs), [Codex docs](https://developers.openai.com/codex), [Plugins](https://developers.openai.com/plugins), [MCP endpoint](https://developers.openai.com/mcp).

## Route by task

- **Docs, models, upgrades:** Verify the requested product and API surface. For “latest/default/best,” fetch current model guidance; preserve any explicitly requested target model. For migrations, inspect active code and prompt paths, then make the smallest behavior-preserving changes and test them. Read [model-guidance.md](references/model-guidance.md) for the migration checklist.
- **New MCP app or plugin:** Identify concrete user goals, input/output, external state, authentication, and need for UI. A skill supplies workflow; an MCP server supplies live tools; UI is optional. Build tools useful without UI first. Read [build-apps.md](references/build-apps.md); load [interaction-patterns.md](references/interaction-patterns.md) only for stateful widgets. Consult current [MCP server](https://developers.openai.com/plugins/build/mcp-server), [UI](https://developers.openai.com/plugins/build/chatgpt-ui), and [packaging](https://developers.openai.com/plugins/build/plugins) pages for the applicable shape.
- **Existing app:** Inspect actual server handlers, tool metadata, auth, resource URIs, UI bridge, and local run instructions before editing. Fix the user's issue and run the cheapest meaningful validation plus a host test when available.
- **Submission or review:** Read [submission.md](references/submission.md), inspect implementation rather than inferring behavior from tool names, and verify the current [submission requirements](https://developers.openai.com/plugins/deploy/submission) before writing review materials. Never invent publisher identity, domains, credentials, or approval status.

For a minimal Node and vanilla MCP Apps prototype, use `scripts/scaffold_node_ext_apps.mjs` **only** after verifying its SDK versions and generated metadata against current docs; it refuses to overwrite a nonempty directory by default. Prefer a close, maintained official example for other stacks and substantial apps.

Report the output, citations for changeable rules, validation actually run, and any remaining external hosting or review step. Creating files does not install, connect, or publish a plugin.
