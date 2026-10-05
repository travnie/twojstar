# Legacy Apps SDK migration

The older `chatgpt-apps` workflow centered on an MCP server plus optional
widget. The current plugin model is broader.

## Preserve

- tool schemas and annotations,
- MCP server behavior,
- resource templates and CSP,
- MCP Apps bridge behavior,
- useful `window.openai` enhancements,
- authentication and hosting configuration.

## Reframe

- App archetype becomes one part of plugin architecture.
- UI remains optional.
- Repeatable workflow instructions can be bundled as skills.
- A plugin can package registered or bundled MCP server connections.
- Hooks and install-surface assets belong at plugin root.
- `.codex-plugin/plugin.json` becomes the required package entry point.

## Legacy terms and paths

- Treat “Apps SDK” as compatibility terminology where existing code or
  metadata still uses it.
- Prefer current `/plugins/...` docs links.
- Do not mechanically remove `_meta["openai/outputTemplate"]`,
  `window.openai`, `.app.json`, or other compatibility surfaces without
  checking current official references.

## Remove from a standalone skill

- hard dependency on one named OpenAI docs MCP connector,
- frozen dependency versions in a generator,
- instructions that assume Codex-only invocation syntax,
- a second copy of the official app-building skill.
