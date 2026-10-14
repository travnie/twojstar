# AI agent plugins

ChatGPT/Codex and Claude Code plugin sources live here: portable `plugin.json`, `mcp.json`, original `skills/`, and assets. See [Claude marketplace instructions](CLAUDE_MARKETPLACE.md).


## Download ChatGPT plugin ZIPs

These are the **latest verified complete set** of packages built from `main` on **13 October 2026**. Each link downloads one ready-to-import GitHub Actions artifact; upload the downloaded ZIP directly in ChatGPT's plugin installer, **without extracting it**.

| Plugin | Download ZIP |
| --- | --- |
| [Claude Dev Kit](claude-dev-kit/) | [`claude-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11831380128) |
| [Cloudflare](cloudflare/) | [`cloudflare-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11831225299) |
| [Desktop Commander](desktop-commander/) | [`desktop-commander-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11831190369) |
| [GitHub Ops](github-ops/) | [`github-ops-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11830925953) |
| [Google Dev Kit](google-dev-kit/) | [`google-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11829754732) |
| [OpenAI Dev Kit](openai-dev-kit/) | [`openai-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11830069418) |
| [SpaceMolt](spacemolt/) | [`spacemolt-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/38430570205/artifacts/11830711579) |

GitHub Actions keeps these artifacts for **30 days** (until approximately **12 November 2026**). The links above point to this specific verified build, not an automatically updated release. For newer packages or expired downloads, open the [Plugin Packages workflow](https://github.com/travnie/twojstar/actions/workflows/plugin-packages.yml?query=branch%3Amain) and select the newest successful `main` run containing the desired `<name>-plugin` artifact. Builds are selective, so not every run contains all seven packages.

[SpaceMolt](spacemolt/) now lives alongside the other agent plugins. Its SMX client, gateway, and supporting gameplay tools remain in [`spacemolt/`](../spacemolt/).

The old [`spacemolt/plugin`](../spacemolt/plugin) path is a relative Git symlink for compatibility, not a second maintained source. On Windows, use `plugins/spacemolt` directly if the checkout does not materialize symlinks.

Audacity, Paint.NET, and Obsidian native extensions and patches live in [`addons/`](../addons/).
