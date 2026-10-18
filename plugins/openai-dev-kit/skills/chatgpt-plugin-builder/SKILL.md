---
name: chatgpt-plugin-builder
description: Use the OpenAI Dev Kit to build, review, migrate, scaffold, validate, and package ChatGPT/Codex plugins or MCP Apps, and to answer OpenAI API, Codex, model, SDK, and submission questions with current official documentation. Choose only the relevant development or plugin-building reference.
---

# OpenAI Dev Kit

One self-contained skill for two related workflows. **Load only the reference needed for the user's request**, not both by default. Reference paths resolve from this skill root. This is a personal toolkit, not an official OpenAI plugin. Other installed plugins are optional and must never be assumed or required.

## Route by intent

- **Build, package, migrate, inspect, validate or distribute a ChatGPT/Codex plugin, skill, MCP server or MCP Apps UI:** read `references/plugin-building.md`. Use its targeted design references and existing `scripts/scaffold_plugin.py` / `scripts/validate_plugin.py` only when needed.
- **OpenAI API or Codex documentation, SDKs, model selection/migration, app server details, or submission requirements:** read `references/openai-workflows.md`. Use its task-specific `references/openai-dev/` guides as necessary.
- **Build a new MCP App or plugin where both concerns apply:** read both, use the documented smallest supported plugin shape, and fetch the current official contracts before implementation.
- **Generate a minimal Node MCP Apps prototype:** the optional `scripts/scaffold_node_ext_apps.mjs` is available; check its pinned dependency versions against current official docs before use.

## Live docs and safety

- The registered `openaiDeveloperDocs` MCP at `https://developers.openai.com/mcp` supplies **read-only official documentation**, not execution, deployment, account access, or app submission.
- Prefer current official MCP search/fetch/OpenAPI tools for volatile product and schema claims. If tools are missing, use official web docs. State what cannot be verified rather than guessing.
- Do not invent connected App IDs, authentication, approvals, deployments, or test results. Never embed secrets in manifests, skills or generated example code.
- Distinguish portable plugin packaging from private ChatGPT App registration and public submissions. Keep documentation and reference materials as guidance; enforcement belongs in the runtime and tests.

## Key references

- `references/plugin-building.md`: existing Plugin Builder workflow; its focused design references remain under `references/`.
- `references/openai-workflows.md`: OpenAI API/Codex/developer docs workflow, with topic guides under `references/openai-dev/`.
- `scripts/`: existing validation/scaffolding helpers; run only when the host supports execution.
