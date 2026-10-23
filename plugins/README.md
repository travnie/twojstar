# AI agent plugins

ChatGPT/Codex and Claude Code plugin sources live here: portable `plugin.json`, `mcp.json`, original `skills/`, and assets. See [Claude marketplace instructions](CLAUDE_MARKETPLACE.md).


## One plugin, one identity

Keep **one root `plugin.json` per plugin**, bundling its original `skills/` and `mcp.json`. [Agent Plugins 1.0](https://agent-plugins.org/specification) is the vendor-neutral package base. OpenAI/ChatGPT/Codex use `extensions.com.openai` and skill `agents/openai.yaml`; Anthropic Claude Code uses the **generated** `.claude-plugin/marketplace.json`. Adapters must reuse the same sources, not fork plugin identity, skills or MCP URLs. This also applies to other Agent Plugins-compatible clients.

**A single package cannot guarantee a single ChatGPT sidebar entry.** A separately registered MCP App may appear alongside the plugin and its bundled MCP. ZIP import cannot merge, remove or authenticate account-side Apps. Preserve working OAuth grants and connections; map an eligible existing MCP App ID into the plugin where supported, rather than registering a duplicate. Claude Code's marketplace is distinct from Claude.ai connectors.

## Component branding

Each marketplace plugin keeps `branding.json` next to `plugin.json`, with separate explicit icon paths for the plugin's **logo**, **composer icon**, **every MCP server**, and **every skill's small/large icons**. Paths are relative to the plugin root (`./...`). Two slots may deliberately reference one existing asset; separate fields do not require duplicate image files.

- Plugin logo and composer icon still use OpenAI's standard `extensions.com.openai.interface` fields; skill icons still use `skills/<slug>/agents/openai.yaml` when available. The branding inventory must agree with those native declarations.
- MCP icons in `branding.json` are **package/catalog hints**, not extra keys in standard `mcp.json`. Protocol-level MCP `serverInfo.icons` belong to the remote server and cannot be set by a portable package.
- Skills without a native icon declaration get explicit plugin-logo fallback paths in the branding inventory. Unsupported clients may ignore this inventory and choose their own presentation.
- Run `python plugins/_shared/validate_branding.py --check` to verify plugin identity, exact skill/MCP coverage, icon paths, containment and consistency. CI checks it for all marketplace entries, including Docbench.

`.agents/plugins/marketplace.json` remains the only maintained **plugin list**. `branding.json` holds per-component image assignments, not a second registry. `.claude-plugin/marketplace.json` remains generated.

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
