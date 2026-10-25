---
name: chatgpt-plugin-builder
description: Build, audit, migrate, validate, scaffold, and package ChatGPT/Codex plugins, MCP servers, and MCP Apps with current OpenAI contracts. Use when implementing plugin components or reviewing their packaging.
---

# ChatGPT Plugin Builder

Use `references/plugin-building.md` as the canonical build workflow. Load only focused design references and existing `scripts/scaffold_plugin.py` / `scripts/validate_plugin.py` as needed. For a minimal Node MCP Apps prototype, `scripts/scaffold_node_ext_apps.mjs` is available after verifying its dependencies against current official docs.

Use the read-only `openaiDeveloperDocs` MCP at `https://developers.openai.com/mcp` for live contracts. Do not assume another installed plugin, verified App ID, credentials, deployment, or publication. Preserve the existing MCP server and OAuth boundaries. Review `https://github.com/openai/mcp-extensions/blob/main/docs/spec.md` when implementing host-specific MCP Apps Extensions; add only capabilities supported by the target host and runtime.

General API, Codex, SDK, and model-documentation questions belong to the sibling `openai-docs` skill. Keep plugin construction and docs lookup independently activated inside the same OpenAI Dev Kit package.
