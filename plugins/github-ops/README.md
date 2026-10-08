# GitHub Ops

Portable Agent Plugins 1.0 package combining the supplied `github-ops` skill with GitHub's hosted full-toolset MCP endpoint, `https://api.githubcopilot.com/mcp/x/all`.

## Components

- `skills/github-ops/` — the supplied environment-first GitHub workflow and merge-gate reference, with narrow review-driven portability and safety fixes.
- `mcp.json` — the hosted Streamable HTTP MCP endpoint.
- `mcp-auth.json` and `AUTHENTICATION.md` — public auth policy and onboarding notes.
- `agents/openai.yaml` — the host adapter normalized to `[CHAT, CODEX]`.

The skill keeps its split between git/gh in an existing checkout and MCP in chat. Review-driven fixes remove unsafe ad-hoc CLI installation, use GraphQL for review threads, avoid undeclared host tools, and make annotation fallback deterministic. The plugin manifest reuses the skill's own SVG instead of maintaining a second logo copy.

## Authentication

See [`AUTHENTICATION.md`](AUTHENTICATION.md). No credentials or account-specific ChatGPT App IDs are committed.

## Package

From the repository root:

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/github-ops /tmp/github-ops-0.1.0.zip
```
