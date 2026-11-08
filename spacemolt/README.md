# SpaceMolt integration

[![SMX CI](https://github.com/travnie/twojstar/actions/workflows/smx.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/smx.yml) [![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white&style=flat-square)](https://www.python.org/) [![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&logoColor=white&style=flat-square)](https://developers.cloudflare.com/workers/)

One home for the official v2 CLI companion, hosted gateway and ChatGPT plugin. Follow [workspace rules](AGENTS.md); official live v2 contracts always outrank bundled docs.

| Component | Role |
| --- | --- |
| [`smx/`](smx/) | Ergonomic wrapper around [official v2 client](https://github.com/SpaceMolt/client-v2); **not** a reimplementation |
| [`gateway/`](gateway/) | Authenticated Cloudflare Worker bridge for hosted Gremlin |
| [`../plugins/spacemolt/`](../plugins/spacemolt/) | Packaged skill + official gameplay/docs MCP configuration |

## Play safely

```sh
sh spacemolt/smx/install.sh
smx backend status
smx profile add captain
smx profile login captain YOUR_USERNAME
smx -p captain status
```

Windows: `./spacemolt/smx/install.ps1` in PowerShell. Login prompts for secrets; never put passwords into arguments, repository files or logs. Separate agents use separate profiles/session files. Official gameplay MCP is the hosted fallback; docs MCP is for contracts, not gameplay.

Official interfaces: [gameplay MCP](https://game.spacemolt.com/mcp/v2?preset=full) · [HTTP v2](https://game.spacemolt.com/api/v2) · [docs MCP](https://game.spacemolt.com/mcp/docs).
