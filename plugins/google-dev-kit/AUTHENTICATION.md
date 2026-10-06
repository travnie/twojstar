# MCP authentication

`mcp-auth.json` is the source of truth for authentication policy. It contains
only public configuration metadata. Never add OAuth client secrets, access
tokens, refresh tokens, API-key values, or account-specific ChatGPT App IDs to
the plugin archive.

## Authentication groups

| Server | Authentication |
| --- | --- |
| Gemini API Docs | None |
| Developer Knowledge | Prefer `X-Goog-Api-Key`; OAuth is also supported |
| Cloud CLI, Cloud Storage, App Design Center, Android Management, Cloud Run, API Keys, Gemini Cloud Assist, IAM | Google OAuth 2.0 + IAM |

Google and Google Cloud remote MCP servers do not support Dynamic Client
Registration (DCR) or OAuth Client ID Metadata Documents (CIMD). OAuth
connections therefore need a pre-registered Google OAuth client. Use the scopes
from `mcp-auth.json`; IAM permissions and API enablement still apply separately.

## ChatGPT

For ChatGPT web or hosted Work, create the protected Google MCP connections as
custom MCP servers and complete Google OAuth in the connection UI. Use a Web
OAuth client when the flow requires a web redirect and register the exact
redirect URI shown by ChatGPT.

ChatGPT assigns each registered connection an account/workspace-specific
`plugin_asdk_app_...` ID. Keep those IDs out of the portable source. A private
installation can bind them later through `.app.json` /
`extensions.com.openai.apps`.

The Gemini API Docs MCP server needs no authentication. Developer Knowledge can
avoid OAuth by supplying a restricted API key in the `X-Goog-Api-Key` header.

## Codex local / desktop

For a protected endpoint, use a pre-registered Google OAuth client and let Codex
store OAuth credentials in its configured credential store. Current Codex
supports pre-registered client IDs and client secrets. Register the exact
callback URL printed by Codex rather than guessing it.

Example shape:

```sh
codex mcp add googleCloudRun \
  --url https://run.googleapis.com/mcp \
  --oauth-client-id "$GOOGLE_MCP_OAUTH_CLIENT_ID" \
  --oauth-client-secret "$GOOGLE_MCP_OAUTH_CLIENT_SECRET"
codex mcp login googleCloudRun
```

Use the endpoint-specific scope from `mcp-auth.json`. Prefer the read-only
scope where the task does not need writes. Do not place the client secret in a
repo-scoped config file.

For Developer Knowledge, a local client can instead inject
`GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY` as the `X-Goog-Api-Key` header.

## Identity and permissions

OAuth scopes are only one gate. Google Cloud APIs must be enabled and the
authenticated principal still needs the appropriate IAM permissions. For
production automation, prefer a dedicated agent/workload identity with
least-privilege roles rather than a broad personal identity.

Gemini Cloud Assist MCP is currently private preview. App Design Center, Cloud
CLI, and Android Management MCP functionality is preview and can change.
