# OpenAI Dev Kit

The canonical source of **one routed OpenAI Dev Kit skill**, its references and its scaffolding/validation scripts, paired with the official read-only OpenAI documentation MCP.

- **Plugin building:** `skills/chatgpt-plugin-builder/references/plugin-building.md` and focused references/scripts.
- **OpenAI development:** `skills/chatgpt-plugin-builder/references/openai-workflows.md`, with API, Codex, MCP Apps and submission guides.
- **MCP:** `https://developers.openai.com/mcp`, anonymous read-only documentation.
- **Branding:** supplied Plugin Builder artwork, used by the portable package and routed skill.

Personal toolkit maintained by travnie, **not an official OpenAI plugin**. The MCP retrieves docs; it cannot run API requests, deploy servers or submit apps.

## Portable package

From the repository root:

```sh
python -m pip install -r plugins/openai-dev-kit/requirements.txt
python plugins/openai-dev-kit/scripts/package_plugin.py /tmp/openai-dev-kit.zip
```

The portable Agent Plugins 1.0 source is the **single maintained source of truth**. The packager generates synchronized `.codex-plugin/plugin.json` and `.mcp.json`; the archive has one `openai-dev-kit/` root and no account-specific IDs.

## ChatGPT: update the existing MCP app in place

**Do not install the portable package as a second private ChatGPT plugin merely to attach the skills.** In the existing account, the registered **OpenAI Docs MCP** app was updated in place with the full `skills/chatgpt-plugin-builder/` tree, including `references/`, `scripts/`, `agents/openai.yaml`, assets and notices. That is the supported, tested layout combining one app's **Skills** and **read actions**.

For future updates, stage the canonical skill tree from this repository into the **existing App-backed plugin archive**, keeping its original `.app.json` binding and generated `.codex-plugin/plugin.json` identity/presentation. Update that plugin with Plugin Creator after checking the current release ID. Never replace the existing app binding with the portable MCP manifest or silently omit reference files. Confirm the Skills and Actions sections in the ChatGPT UI after updating.

The existing registered Docs MCP app and the portable wrapper are **different plugin records**. Updating the app does not delete an older wrapper, and declaring `mcpServers` in the portable package does not by itself prove ChatGPT will register a connectable app. Private-plugin removal is a separate account operation, not a packager effect.

The `--docs-app-id` option remains available for clients/installs that explicitly require a **wrapper with a verified app dependency**:

```sh
python plugins/openai-dev-kit/scripts/package_plugin.py /tmp/openai-dev-kit-private.zip \
  --docs-app-id VERIFIED_ID_FROM_CHATGPT
```

**Do not use that wrapper mode when the goal is one plugin entry.** Keep account-specific IDs out of source. Public directory submissions use the supported With MCP flow and omit private bindings.

## Validation

```sh
python plugins/openai-dev-kit/skills/chatgpt-plugin-builder/scripts/validate_plugin.py plugins/openai-dev-kit
python -m unittest discover -s plugins/openai-dev-kit/tests -v
```

Both upstream workflows retain their references, scripts, assets and licensing. Packaging code is ISC, adapted from the SpaceMolt packager. Validation proves package structure, not live MCP connectivity or account install state.
