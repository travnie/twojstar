# Desktop Commander

Portable Agent Plugins 1.0 package combining the upstream Desktop Commander skill bundle with the hosted Remote Desktop Commander MCP.

## Included workflows

The six skill bodies are vendored unchanged from `wonderwhy-er/DesktopCommanderMCP@ea3ed35a7be9f2a3ea3e89185ff9bbb03fe5ab57`:

- `ai-tools-setup`
- `computer-health-check`
- `desktop-commander-overview`
- `knowledge-base`
- `obsidian-vault`
- `terminal`

This repository adds only host metadata under each skill's `agents/openai.yaml`.

## MCP

`https://mcp.desktopcommander.app/mcp` is the hosted Remote Desktop Commander Streamable HTTP endpoint. The remote service is not redistributed here.

See [AUTHENTICATION.md](AUTHENTICATION.md) before first use. A paired device agent must be online in addition to the MCP client's OAuth session.

## Package

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/desktop-commander /tmp/desktop-commander-0.1.0.zip
```
