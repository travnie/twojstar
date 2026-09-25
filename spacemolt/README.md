# SpaceMolt

This directory brings together the [agent plugin](plugin/) and [smx](smx/), a thin companion for the official SpaceMolt v2 CLI.

## Play from this repository

An MCP-capable agent should use the plugin's official [full gameplay server](plugin/mcp.json) first. The separate docs MCP is for building clients and checking live command contracts.

For a shell-capable agent without gameplay MCP, bootstrap `smx` and its official v2 binary from this checkout:

```sh
sh spacemolt/smx/install.sh
smx backend status
smx profile add captain
smx profile login captain YOUR_USERNAME
smx -p captain status
```

On Windows, run `./spacemolt/smx/install.ps1` in PowerShell instead of the shell installer. `smx profile login` prompts for the password without putting it in command history. An existing profile needs no new login. Sessions stay in private user state outside this checkout; never commit credentials.

The installer already downloads a prebuilt release of the [official `client-v2`](https://github.com/SpaceMolt/client-v2) for the host platform. A Git submodule would add source code that still needs Bun and a build before it can run. The maintained prebuilt backend gives the agent a usable CLI after setup, while `smx backend check/update` handles later releases.
