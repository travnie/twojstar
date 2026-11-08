# Agent plugins

[![Plugin CI](https://github.com/travnie/twojstar/actions/workflows/plugin-packages.yml/badge.svg?branch=main)](https://github.com/travnie/twojstar/actions/workflows/plugin-packages.yml) [![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white&style=flat-square)](https://www.python.org/)

Portable ChatGPT/Codex and Claude Code plugin sources. [Agent Plugins 1.0](https://agent-plugins.org/specification) is the package base. Native Audacity/Paint.NET/Obsidian extensions live in [`addons/`](../addons/), **not here**.

## Source map

| Concern | Canonical file / rule |
| --- | --- |
| Plugin identity | One `<plugin>/plugin.json` per plugin; original `skills/`, `mcp.json`, assets |
| Plugin registry | [`../.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json); **one maintained list** |
| Claude marketplace | Generated `../.claude-plugin/marketplace.json`; do not edit independently |
| Branding | `branding.json` per plugin maps plugin, composer, each MCP and each skill's icon; no duplicate asset files needed |
| OpenAI metadata | `extensions.com.openai`; optional `skills/<slug>/agents/openai.yaml` |
| Packaging / CI | [Plugin Packages](../.github/workflows/plugin-packages.yml); `_shared/plugin_ci.py`, branding validator |

## Validate and package

```sh
python plugins/_shared/validate_branding.py --check
python plugins/_shared/claude_marketplace.py --check
EVENT_NAME=workflow_dispatch python plugins/_shared/plugin_ci.py plan
# CI owns packaging selected plugins via plugin_ci.py build
```

From [Plugin Packages runs on main](https://github.com/travnie/twojstar/actions/workflows/plugin-packages.yml?query=branch%3Amain), choose the newest successful run **containing the desired `<name>-plugin` artifact**. Builds select affected packages; not every run contains every ZIP. Artifacts expire, so **do not pin stale run IDs** into maintained docs. The ZIP is portable source/config, not an authenticated registered App.

## App binding is separate

- A private plugin may bind one or more **existing eligible App IDs** in `.app.json` with `extensions.com.openai.apps: "./.app.json"`. Verify `asdk_app_...` or `plugin_asdk_app_...` IDs; endpoint/MCP aliases are not App IDs.
- Public submission ZIPs must not contain `.app.json`. A published **With MCP** listing currently uses one MCP connection; do not register duplicate identities or revoke valid OAuth to change presentation.
- Claude's generated marketplace reuses portable source, not separate skills/MCP URLs. MCP `serverInfo.icons` belongs to the remote server; package `branding.json` is a catalog hint, **not** an `mcp.json` protocol field.

[OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins) · [Private App binding rules](https://developers.openai.com/plugins/deploy/submission-errors) · [Claude marketplace setup](CLAUDE_MARKETPLACE.md).

[SpaceMolt plugin](spacemolt/) owns its packaged skill; its CLI/gateway live in [`../spacemolt/`](../spacemolt/). Legacy `spacemolt/plugin` symlink is compatibility only; on Windows use `plugins/spacemolt/`.
