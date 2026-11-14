# Privacy policy: twojstar plugins

Last updated: 2026-11-14. Applies to every plugin published from [travnie/twojstar](https://github.com/travnie/twojstar) (listed below) on Claude, ChatGPT and Codex.

## What the plugins are

Each plugin is a package of instructions (skills), icons and connection settings. The publisher runs no servers, analytics or telemetry for them, and receives no data from your use of them.

## What happens to your data

- **The AI app you use** (Claude, ChatGPT or Codex) processes your conversations under its own privacy policy.
- **Connected services.** Some plugins declare remote MCP servers. Once you connect one, the app sends that service the requests it needs, such as search queries, account operations or game commands. The provider handles that data under its own policy:

| Plugin | Connected services | Provider policy |
|---|---|---|
| spacemolt | `game.spacemolt.com` (game, docs) | [SpaceMolt](https://spacemolt.com/privacy) |
| cloudflare | `mcp.cloudflare.com` | [Cloudflare](https://www.cloudflare.com/privacypolicy/) |
| github-ops | `api.githubcopilot.com` | [GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) |
| google, google-dev-kit | `*.googleapis.com`, `gemini-api-docs-mcp.dev` | [Google](https://policies.google.com/privacy) |
| openai-dev-kit | `developers.openai.com` | [OpenAI](https://openai.com/policies/privacy-policy/) |
| claudin | Documentation search: `code.claude.com`, `claude.com`, `platform.claude.com`, `developers.openai.com`, `docs.x.ai`, `modelcontextprotocol.io`, `agentclientprotocol.com` | [Anthropic](https://www.anthropic.com/legal/privacy), [OpenAI](https://openai.com/policies/privacy-policy/), [xAI](https://x.ai/legal/privacy-policy). The MCP and ACP sites are public, sign-in-free documentation; the plugin sends them only search queries, under each site's own terms. |
| desktop-commander | `mcp.desktopcommander.app` | [Desktop Commander](https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/PRIVACY.md) |
| claudesign, docbench | None | — |

- **Credentials.** Sign-in depends on the service: most connections use the provider's OAuth flow inside your AI app, SpaceMolt uses its own game login or device link, and some clients let you add an API key or token in the app's connector settings. Credentials go only to that provider and the AI app. The plugins contain none and never ask you to paste one into chat.
- **Local files.** Some skills read or write files only where your AI app already has access, such as a connected folder or the session workspace.

## Your choices

Disconnect a service or uninstall a plugin at any time in your AI app. For data a provider holds, use that provider's own controls.

## Contact

See [Support](SUPPORT.md).
