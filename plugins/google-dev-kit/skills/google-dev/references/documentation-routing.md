# Documentation routing

## Developer Knowledge

Preferred server: `googleDeveloperKnowledge`.

- Use conceptual QA for architecture, product choice, and multi-step guidance.
- Use focused search for command syntax, API fields, IAM permissions, and exact names.
- Fetch the source document when an answer depends on a specific page or exact wording.
- On generative QA quota exhaustion, retry with focused search rather than ungrounded memory.
- If MCP tools are unavailable, the REST API is a fallback only when valid Google credentials or an API key already exist.

## Google skills catalog

The upstream catalog is generated at `https://raw.githubusercontent.com/google/skills/main/index.json`.

For an uncovered workflow: fetch the current catalog, match at most three descriptions, fetch only those entrypoints, follow the fetched skill, then discard the snapshot. Never invent entries or reuse a stale catalog across sessions.
