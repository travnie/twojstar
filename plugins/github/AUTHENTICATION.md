# Authentication

The plugin connects to GitHub's official remote MCP toolset at `https://api.githubcopilot.com/mcp/x/all`. The endpoint requires authentication.

## ChatGPT and OAuth-capable hosts

Prefer the server-advertised OAuth flow. Let the host store OAuth credentials; do not commit account-specific registered App IDs, access tokens, refresh tokens, cookies, or client secrets to this portable package.

## Local/custom clients

Clients that explicitly support a static `Authorization: Bearer ...` header may use a GitHub personal access token instead. Keep the token in the client's credential or secret store, never in `mcp.json`, plugin source, shell history, or chat. Grant only the repository and organization permissions required for the task.

Authentication does not bypass GitHub branch protection, rulesets, required reviews, or workflow permissions. The bundled skill's merge gate still applies.
