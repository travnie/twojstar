# Current OpenAI plugin docs workflow

Fetch current official OpenAI pages before implementation.

## Baseline

- `https://developers.openai.com/plugins/`
- `https://developers.openai.com/plugins/quickstart`
- `https://developers.openai.com/plugins/concepts/plugins`
- `https://developers.openai.com/plugins/build/plugins`
- `https://developers.openai.com/plugins/build/skills`
- `https://developers.openai.com/plugins/build/mcp-server`
- `https://developers.openai.com/plugins/build/chatgpt-ui`

## Conditional

Search the live `openai-docs` connector (via `docs-lookup`) or the official [plugin docs index](https://developers.openai.com/plugins/) for these topics; fetch only the matching page. Do not guess volatile paths.

- authentication,
- connect and test,
- [submission and publishing](https://developers.openai.com/plugins/deploy/submission),
- UI guidelines,
- metadata optimization,
- security and privacy,
- troubleshooting,
- plugin UI reference,
- MCP server review requirements.

## Routing rules

- Use `/plugins/...` as canonical.
- Old `/apps-sdk/...` pages may redirect, but do not generate new documentation links to the legacy path.
- Fetch the current plugin UI reference before deciding whether an OpenAI compatibility alias should remain.
- Fetch package and submission docs again before public release because fields and review requirements can change.
- Prefer official examples over a frozen local server scaffold.
