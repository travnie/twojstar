# Connecting the Cloud servers

Google remote MCP servers support neither Dynamic Client Registration nor Client ID Metadata Documents ([authentication](https://docs.cloud.google.com/mcp/authenticate-mcp)). Installing a plugin therefore signs nobody in.

- **claude.ai, ChatGPT and other hosted chats:** add each server once as a custom connector/app with the same URL, choosing your own OAuth client. Create one Web OAuth client in a Google Cloud project and register each host's redirect URI (claude.ai: `https://claude.ai/api/mcp/auth_callback`; others: the URI the host shows). Client ID and secret go into the host's form only, never into a plugin, repo or chat.
- **Consent screen:** External + Testing issues refresh tokens that expire after 7 days; publish it. Unverified apps with sensitive scopes show a warning.
- **Scopes advertised by the servers (checked 2026-11):** Cloud CLI `cloud-platform`; Cloud Storage `devstorage.read_write`; Compute Engine `compute`; Monitoring `monitoring`.
- **Access:** enable each product API in the project; the account needs MCP Tool User (`roles/mcp.toolUser`) plus the resource roles. Least privilege applies to the signed-in account.
- **Permissions:** where the host supports per-tool approval, require it for Cloud CLI and for every write or destructive tool.
- **Local clients** with their own authenticated `gcloud` can instead send a short-lived bearer token plus `x-goog-user-project` (about 1 h lifetime; configure in the client, never in the plugin).
- Repeated re-authentication: check that the host requested offline access and kept the refresh token.
