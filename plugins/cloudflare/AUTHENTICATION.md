# Authentication

Cloudflare's recommended Code Mode MCP is `https://mcp.cloudflare.com/mcp`. OAuth is the preferred interactive path: connect the server and complete Cloudflare authorization, selecting only the permissions needed for the task.

The server also accepts a Cloudflare API token as a bearer credential for clients and automation environments that support static headers. Keep such tokens in the client's secret store; never place them in `mcp.json`, plugin source, shell history, or chat text. For ChatGPT, use the server's OAuth flow rather than trying to embed a token in this portable package.

The MCP exposes broad Cloudflare API coverage through a small Code Mode tool surface plus live documentation search. Authorization limits what the server can actually do on the account.
