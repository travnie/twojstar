# Authentication

Remote Desktop Commander has two separate trust steps: the computer must be paired with the hosted service, and the MCP client must authorize its own connection.

## 1. Pair a computer

On each computer you want the MCP to reach, run:

```sh
npx @wonderwhy-er/desktop-commander@latest remote
```

The device agent opens an OAuth device-verification page. Sign in, confirm that the browser code matches the terminal code, and keep the agent running. The machine is unreachable when that agent is stopped.

The local device session is managed by Desktop Commander. Its default session file is `~/.desktop-commander-device/device.json`. Do not commit or copy that file into this plugin.

## 2. Authorize the MCP client

Connect the host to:

```text
https://mcp.desktopcommander.app/mcp
```

The hosted MCP uses OAuth 2.0. ChatGPT should complete OAuth through its connector UI and keep credentials in host-managed storage. No OAuth tokens, cookies, account identifiers, pairing codes, or account-specific ChatGPT app IDs belong in this repository.

For Codex or another OAuth-capable client, let the client perform the browser authorization flow for the same MCP endpoint. Do not invent static bearer tokens as a substitute.

## Security boundary

This MCP can read and modify files, run processes, and otherwise act with the permissions of the paired computer and device agent. Treat write/process tools as high impact: inspect first, use the smallest action, and keep destructive commands behind explicit user approval.
