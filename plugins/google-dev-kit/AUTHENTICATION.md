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

The Gemini API Docs MCP server needs no authentication. For Developer
Knowledge in ChatGPT, use OAuth: ChatGPT cannot present customer-supplied API
keys or arbitrary custom authentication headers to an MCP server. The
`X-Goog-Api-Key` option is therefore only for local clients that can inject
that header themselves.

## Codex local / desktop

For a protected endpoint, use a pre-registered Google OAuth client and let Codex
store OAuth credentials in its configured credential store. Current Codex
supports pre-registered client IDs and client secrets. Register the exact
callback URL printed by Codex rather than guessing it.

Use the client ID to register the server and obtain the exact callback URL
without putting a client secret in source:

```sh
codex mcp add googleCloudRun \
  --url https://run.googleapis.com/mcp \
  --oauth-client-id "$GOOGLE_MCP_OAUTH_CLIENT_ID"
```

Register the exact callback URL printed by Codex with the Google OAuth client.
The first `codex mcp add` can fail its immediate login before that callback is
registered. After registering it, retry login explicitly with the
least-privileged scope required by the task, for example:

```sh
codex mcp login googleCloudRun \
  --scopes https://www.googleapis.com/auth/run.readonly
```

Complete any client-secret step through a host-managed authentication UI or
credential store when available. Do not expand a client secret into a shell
command line, because process listings and monitoring can expose command
arguments. If a local client only accepts the secret as a command-line
argument, prefer the ChatGPT/desktop connection flow for secret-bearing setup.

Use the endpoint-specific scope from `mcp-auth.json`. Use `readOnlyScopes`
when the profile publishes one. Some Google MCP servers, including Cloud CLI,
App Design Center, and Gemini Cloud Assist, officially publish only
`cloud-platform`; for read-only work on those servers, keep the documented
OAuth scope and narrow access with IAM roles and MCP tool policies instead of
inventing a narrower scope. Do not place the client secret in a repo-scoped
config file.

For Developer Knowledge, a local client can instead inject
`GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY` as the `X-Goog-Api-Key` header.

## Identity and permissions

OAuth scopes are only one gate. Google Cloud APIs must be enabled and the
authenticated principal still needs the appropriate IAM permissions. For
production automation, prefer a dedicated agent/workload identity with
least-privilege roles rather than a broad personal identity.

Gemini Cloud Assist MCP is currently private preview. App Design Center, Cloud
CLI, and Android Management MCP functionality is preview and can change.
