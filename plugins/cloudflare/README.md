# Cloudflare

Portable Agent Plugins 1.0 package combining the supplied `cloudflare` skill with `https://mcp.cloudflare.com/mcp`.

## Components

- `skills/cloudflare/` — the supplied workflow and supporting references.
- `mcp.json` — the hosted Streamable HTTP MCP endpoint.
- `mcp-auth.json` and `AUTHENTICATION.md` — public authentication policy and onboarding notes.
- `agents/openai.yaml` — source adapter retained from the supplied skill, with the product policy normalized to `[CHAT, CODEX]`.

The supplied skill includes its full product routing and reference tree, including Workers, Pages, KV/D1/R2, Workers AI, AI Gateway, Agents SDK, REST API, and Wrangler guidance.

## Authentication

See [`AUTHENTICATION.md`](AUTHENTICATION.md). No account credentials, bearer tokens, cookies, or ChatGPT-specific registered App IDs are committed to this portable source package.

## Package

From the repository root:

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/cloudflare /tmp/cloudflare-0.1.0.zip
```

## Local compatibility note

The API-reference examples avoid literal token-like placeholder assignments so repository secret scanners do not mistake documentation for credentials. The examples still use `CLOUDFLARE_API_TOKEN` from the local process environment. TypeScript zone CRUD and retry-header examples are also aligned with the current Cloudflare SDK named-parameter and Web `Headers` APIs. Agents SDK webhook, durable-execution, and Voice examples are refreshed against the current live APIs.
