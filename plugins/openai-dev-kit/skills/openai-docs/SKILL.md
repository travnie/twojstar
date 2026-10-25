---
name: openai-docs
description: Consult current official OpenAI developer docs for API, SDK, models, Codex, MCP, ChatGPT, and plugin submission questions. Use this for documentation and migration research, not plugin scaffolding.
---

# OpenAI Docs

Use the existing read-only `openaiDeveloperDocs` MCP at `https://developers.openai.com/mcp`. Search first, fetch exact pages, and inspect the OpenAPI schema for API shapes. This is not an account-management or deployment endpoint.

Read `references/openai-workflows.md` for task routing and only its relevant supporting guide under `references/openai-dev/`. Verify volatile details against live docs; never infer model identifiers, permissions, or publication status from old notes.

For building, validating, or packaging a plugin, use the sibling `chatgpt-plugin-builder` skill. Keep this skill focused on general developer documentation, SDKs, Codex, and API guidance. Other installed plugins are optional.
