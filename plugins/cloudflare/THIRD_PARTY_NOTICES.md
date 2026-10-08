# Third-party notices

The bundled `cloudflare` skill and reference tree were supplied with this task and retain the Apache-2.0 license included at `skills/cloudflare/LICENSE.txt`. The plugin wrapper and repository integration are ISC-licensed.

The plugin references Cloudflare's hosted `https://mcp.cloudflare.com/mcp`; the remote service is not redistributed.

## Local documentation patch

A few API-token setup examples are rewritten to prompt for or reference a local environment variable instead of embedding literal placeholder values. TypeScript zone CRUD and retry-header examples are updated to the current Cloudflare SDK signatures and Web `Headers` API. Agents SDK webhook body handling, durable-execution recovery, and Voice examples are refreshed against the current Cloudflare documentation. These compatibility fixes do not change the Cloudflare API workflow or authentication model.
