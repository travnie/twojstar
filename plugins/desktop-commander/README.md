# Desktop Commander plugin

Portable Agent Plugins 1.0 package combining the supplied `desktop-commander` skill with Desktop Commander Remote MCP.

- MCP: `https://mcp.desktopcommander.app/mcp`
- Auth: provider-managed browser sign-in plus a local Remote Device (`Node.js 18+`, `npx @wonderwhy-er/desktop-commander@latest remote`) kept running on the target computer; see `AUTHENTICATION.md`.
- Skill: files, terminal/process sessions, system health, local AI tooling and Markdown/Obsidian workflows.
- Credentials and account-specific ChatGPT App IDs are intentionally not bundled.

Package with the shared repository packager:

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/desktop-commander /tmp/desktop-commander.zip
```

## Install

- **Claude Code:** `/plugin install desktop-commander --marketplace travnie/twojstar`
- **claude.ai, ChatGPT, Codex:** upload the `desktop-commander` package built from this folder (see *Package*), or install it from the directory listing once published.
