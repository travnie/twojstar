# Authentication

`https://mcp.desktopcommander.app/mcp` is Desktop Commander Remote MCP. It requires a Desktop Commander account and a connected device. Authentication is completed through the provider's browser-based sign-in flow; this plugin stores no account password, access token, device token, or private App ID.

## Device setup

On each computer you want to control, install Node.js 18 or newer and start the Remote Device:

```sh
npx @wonderwhy-er/desktop-commander@latest remote
```

The command opens Desktop Commander's device-authorization flow. Confirm the browser code matches the terminal code, sign in, and keep this process running while the computer should be reachable. Closing it takes the device offline; starting the same command again normally reuses the saved device session.

## ChatGPT

Connect the hosted MCP through the host's OAuth / connection flow using the same Desktop Commander account as the paired device. The AI-side connection and the local Remote Device must both be active. Any ChatGPT registered App ID is account- or workspace-specific and must not be committed to this portable repository.

## Other MCP clients

Add the HTTPS Streamable HTTP endpoint and complete the provider login when the client prompts. Desktop Commander also offers a separate local MCP server, but this plugin intentionally targets the hosted Remote MCP URL requested here.

Keep device access narrow: Desktop Commander's own allowed directories and blocked commands remain the enforcement boundary.
