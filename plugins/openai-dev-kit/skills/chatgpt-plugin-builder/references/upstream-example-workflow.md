# Upstream example workflow

Use current OpenAI plugin documentation and examples as the source of truth. Do not treat local scaffolds as copies of upstream starter apps.

## Pick the right starting point

1. For plugin packaging and manifest work, prefer the built-in `plugin-creator` workflow when available.
2. For a ChatGPT app with an MCP server or widget, start from the current OpenAI plugin examples and quickstart:
   - `https://developers.openai.com/plugins/build/examples`
   - `https://developers.openai.com/plugins/quickstart`
   - `https://developers.openai.com/plugins/build/mcp-server`
3. If you need MCP Apps bridge details, use the version-matched upstream MCP Apps examples rather than a copied local template.

## Local scaffold in this skill

`scripts/scaffold_plugin.py` only creates a lightweight plugin-package skeleton: `.codex-plugin/plugin.json`, optional `.mcp.json` / `.app.json`, and a starter skill directory. It does **not** scaffold an MCP server, widget UI, or Node app.

Use it when the repository already has the runtime pieces and only needs the plugin wrapper. Validate the result with `scripts/validate_plugin.py` and then compare it against the current OpenAI plugin schema/documentation before shipping.

## Why this is intentionally thin

OpenAI plugin and Apps SDK examples evolve. Keeping a second frozen copy here would age into decorative archaeology. Prefer current upstream examples and keep local scripts focused on stable packaging mechanics.
