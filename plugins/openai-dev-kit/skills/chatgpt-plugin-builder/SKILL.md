---
name: chatgpt-plugin-builder
description: Design, scaffold, migrate, review, validate, and package ChatGPT and Codex plugins that combine reusable skills, MCP servers, registered MCP connections, lifecycle hooks, and optional MCP Apps UI. Use when the user asks to create a plugin, package skills into a portable `plugin.json`, add or connect an MCP server, migrate an older ChatGPT Apps SDK project, prepare a local marketplace entry, review plugin structure, or make a plugin ready for testing or submission. For detailed MCP server and widget implementation, use the installed OpenAI Developers app-building workflow when available and fetch current official plugin docs first.
---

# ChatGPT Plugin Builder

Build the smallest plugin shape that satisfies the use case.

## First decision: choose the plugin shape

1. **Skills only**: instructions, references, templates, or deterministic scripts are enough.
2. **MCP server only**: live data or controlled actions are needed, but extra workflow instructions are not.
3. **Skills + MCP server**: skills guide repeatable workflows through MCP tools.
4. **MCP server + UI**: visual interaction materially improves an MCP-backed workflow.

UI is optional. Do not create a widget merely because the platform supports one.

## Docs-first routing

Before changing plugin architecture or metadata:

1. Use the bundled `openaiDeveloperDocs` MCP search/fetch tools to retrieve current official OpenAI Plugins docs. If unavailable, browse the official docs directly; do not block an answer on installation.
2. For straightforward plugin packaging, prefer the current built-in `plugin-creator` workflow when available; use this skill for repository-specific architecture, migration, and validation.
3. Treat `/plugins/...` as the canonical documentation surface.
4. Treat old `/apps-sdk/...` links and “Apps SDK app” language as legacy compatibility terminology.
5. Prefer the installed OpenAI Developers `build-chatgpt-app` workflow for detailed MCP Apps UI/server implementation when available.
6. Use bundled references for stable design patterns, never as a substitute for current product rules, schemas, or submission requirements.

Read `references/plugin-docs-workflow.md` for page routing.

## Plugin workflow

### 1. Inventory use cases

Define recognizable user goals before files or tools.

For each use case, identify:

- expected input,
- user-visible output,
- whether live data or an external action is needed,
- whether a skill is helpful,
- whether a UI materially improves the task,
- read-only versus mutating behavior,
- authentication and external domains.

### 2. Choose components

- Put repeatable instructions and bundled resources in `skills/`.
- Put registered MCP connection mappings in `.app.json`.
- Put portable MCP server definitions in root `mcp.json`, with the MCP schema and transport `type`.
- Put lifecycle hooks in `hooks/` only when event-driven behavior is required.
- Put icons, logos, and screenshots in `assets/`.
- Put only `plugin.json` inside `.codex-plugin/`.

### 3. Create the manifest

Use root `plugin.json` with the Agent Plugins 1.0 schema. Put OpenAI-specific settings under
`extensions.com.openai`. Portable clients discover `skills/` and `mcp.json` at fixed paths.
Keep `.codex-plugin/plugin.json` only as an optional compatibility overlay; when the inline
OpenAI extension exists, it replaces that entire overlay instead of merging with it.

Manifest paths must:

- be relative to the plugin root,
- begin with `./`,
- stay inside the plugin root,
- point only to components that exist.

Use `scripts/scaffold_plugin.py` for a small skills-only or skills-plus-MCP starting structure.
Use `scripts/validate_plugin.py` before packaging or publication.

### 4. Build skills

Keep each skill focused on one recognizable workflow. A skill description
determines activation, so state both capability and trigger conditions.

Do not use a skill for:

- a one-off task,
- an always-on personality preset,
- live data that belongs behind MCP,
- permissions or mechanical enforcement that belongs in policy, hooks, or CI.

### 5. Build or connect MCP

Add MCP when the plugin needs live data, authentication, controlled actions,
or code running on infrastructure you operate.

For MCP server and optional widget implementation:

- plan tools before code,
- make one user intent per tool,
- mark annotations accurately,
- keep tools useful without UI,
- use MCP Apps UI as the portable baseline,
- add ChatGPT-specific `window.openai` features only when they improve the UX,
- verify current metadata, CSP, domain, and submission rules in official docs.

Read retained app references only when relevant:

- `references/app-archetypes.md`
- `references/interactive-state-sync-patterns.md`
- `references/window-openai-patterns.md`
- `references/search-fetch-standard.md`
- `references/repo-contract-and-validation.md`
- `references/upstream-example-workflow.md`

### 6. Validate in layers

1. Manifest and path validation.
2. Skill structure and trigger review.
3. MCP schemas and annotations.
4. Syntax or compile checks.
5. Local MCP runtime sanity.
6. ChatGPT/Codex host loop.
7. Submission checks when public distribution is intended.

Always report the deepest level actually reached.

### 7. Test and distribute

Distinguish:

- a standalone `.skill` installed directly in ChatGPT,
- a plugin folder exposed through a local or repository marketplace,
- a registered MCP connection referenced by `.app.json`,
- a public plugin submitted to the universal directory.

Do not claim that creating files installed, connected, or published the plugin.

## Migration from ChatGPT Apps SDK

When reviewing an older app package:

1. Preserve working MCP server and UI behavior.
2. Move the mental model from “app equals widget-backed MCP server” to
   “plugin may contain skills, MCP, hooks, and optional UI.”
3. Replace stale canonical docs links with `/plugins/...`.
4. Add portable root `plugin.json`; retain a synchronized `.codex-plugin/plugin.json` when an older client needs it.
5. Keep `.app.json` only for registered MCP connection mappings.
6. Keep root `mcp.json` for portable MCP configuration; generate `.mcp.json` only for older clients.
7. Do not remove compatibility metadata blindly. Verify the current plugin UI reference first.

Read `references/legacy-apps-sdk-migration.md`.

## Output

Return:

- chosen plugin shape,
- component and tool plan,
- generated or changed files,
- validation level reached,
- unresolved hosting, auth, marketplace, or submission requirements,
- packaged artifact when requested.
