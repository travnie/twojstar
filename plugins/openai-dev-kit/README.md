# OpenAI Dev Kit

Two supplied skills plus the official read-only OpenAI documentation MCP.

- **ChatGPT Plugin Builder:** choose, scaffold, migrate, validate, and package plugins.
- **OpenAI Dev Workflows:** current API/Codex documentation, model migration, MCP apps, and submission guidance.
- **MCP:** `https://developers.openai.com/mcp`, streamable HTTP, anonymous read-only documentation access.
- **Branding:** supplied Plugin Builder PNG artwork, reused for the package and both skills.

Personal toolkit maintained by travnie. Not an official OpenAI plugin. The MCP
reads documentation; it does not run API requests, deploy servers, or submit apps.

## Package

From the repository root:

```sh
python -m pip install -r plugins/openai-dev-kit/requirements.txt
python plugins/openai-dev-kit/scripts/package_plugin.py /tmp/openai-dev-kit-0.1.2.zip
```

The source contains portable Agent Plugins 1.0 manifests. Packaging generates
synchronized `.codex-plugin/plugin.json` and `.mcp.json` compatibility files.
The archive has one `openai-dev-kit/` root and no account-specific IDs.

## Private ChatGPT installation

A remote endpoint in `mcp.json` alone does not prove that ChatGPT imported a
connectable app. Register the official endpoint through developer mode, then
copy its verified connection page or underlying App ID:

```sh
python plugins/openai-dev-kit/scripts/package_plugin.py /tmp/openai-dev-kit-0.1.2-private.zip \
  --docs-app-id VERIFIED_ID_FROM_CHATGPT
```

This stages `.app.json` and matching OpenAI/compatibility declarations. A page ID
`plugin_asdk_app_<id>` is normalized to the underlying `asdk_app_<id>`. Keep those
bindings out of repository source. Install the resulting private archive only
after the user confirms that account changes may proceed.

Use **OpenAI Dev Kit** for the combined skills/tools workflow. A separately
registered dependency may remain visible as **OpenAI Docs MCP**. Removing an old
connection does not guarantee one directory entry. Avoid naming both the
combined package and its connection identically.

For public submission, use the supported With MCP flow and omit `.app.json` and
all `apps` declarations. This repository package is not a reviewed public listing.

## Validation

```sh
python plugins/openai-dev-kit/skills/chatgpt-plugin-builder/scripts/validate_plugin.py plugins/openai-dev-kit
python -m unittest discover -s plugins/openai-dev-kit/tests -v
```

Both uploaded skills retain their Apache-2.0 licenses and supporting files.
Packaging code: ISC, adapted from this repository's SpaceMolt packager.
Original supplied archives remain the provenance source. Local validation does
not prove account installation or live MCP discovery; verify those in ChatGPT.
