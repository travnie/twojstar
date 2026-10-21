# AI agent plugins

ChatGPT/Codex and Claude Code plugin sources live here: portable `plugin.json`, `mcp.json`, original `skills/`, and assets. See [Claude marketplace instructions](CLAUDE_MARKETPLACE.md).


## Download ChatGPT plugin ZIPs

These are the **latest verified complete set** of portable packages built successfully from `main` on **21 October 2026**. Each link downloads one ready-to-import GitHub Actions artifact; upload the downloaded ZIP directly in ChatGPT's plugin installer, **without extracting it**.

| Plugin | Download ZIP |
| --- | --- |
| [Claude Dev Kit](claude-dev-kit/) | [`claude-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12339872053) |
| [Cloudflare](cloudflare/) | [`cloudflare-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12340641660) |
| [Desktop Commander](desktop-commander/) | [`desktop-commander-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12340706669) |
| [GitHub Ops](github-ops/) | [`github-ops-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12339677307) |
| [Google Dev Kit](google-dev-kit/) | [`google-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12340496681) |
| [OpenAI Dev Kit](openai-dev-kit/) | [`openai-dev-kit-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39588120038/artifacts/12340057668) |
| [SpaceMolt](spacemolt/) | [`spacemolt-plugin.zip`](https://github.com/travnie/twojstar/actions/runs/39587425994/artifacts/12341086238) |


These ZIPs contain the canonical skills and remote MCP declarations. For ChatGPT Actions, an eligible existing MCP app registration must also be bound to the private plugin; an anonymous portable ZIP cannot automatically create a registered connection. App-backed private packages use the verified App ID options in each package's installer. Do not uninstall a functioning connection on the assumption that importing a ZIP replaces it.

GitHub Actions keeps these artifacts for **30 days** (until approximately **20 November 2026**). The links above point to this specific verified build, not an automatically updated release. For newer packages or expired downloads, open the [Plugin Packages workflow](https://github.com/travnie/twojstar/actions/workflows/plugin-packages.yml?query=branch%3Amain) and select the newest successful `main` run containing the desired `<name>-plugin` artifact. Builds are selective, so not every run contains all seven packages.

[SpaceMolt](spacemolt/) now lives alongside the other agent plugins. Its SMX client, gateway, and supporting gameplay tools remain in [`spacemolt/`](../spacemolt/).

The old [`spacemolt/plugin`](../spacemolt/plugin) path is a relative Git symlink for compatibility, not a second maintained source. On Windows, use `plugins/spacemolt` directly if the checkout does not materialize symlinks.

Audacity, Paint.NET, and Obsidian native extensions and patches live in [`addons/`](../addons/).
