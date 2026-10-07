# Claude Dev Kit

Portable Agent Plugins 1.0 package combining Anthropic's upstream `claude-api` and `mcp-builder` skills with the public Claude Code Docs MCP.

## Components

- `skills/claude-api/` — upstream Claude API / Anthropic SDK reference skill.
- `skills/mcp-builder/` — upstream MCP server design and evaluation skill.
- `mcp.json` — `https://code.claude.com/docs/mcp`, a public Claude Code documentation MCP.
- `agents/openai.yaml` files are thin host adapters added by this repository. The upstream snapshot is otherwise preserved except for the documented MCP evaluation-harness compatibility fixes below.

The Anthropic skill snapshot is pinned to `anthropics/skills@683bc88e56f3e09ba94f7055977f3d3aa499f202`. Update that pin deliberately when refreshing the vendored skills.\n\n## Local compatibility fixes\n\n`skills/mcp-builder/scripts/evaluation.py` carries small local fixes for MCP SDK content serialization, multiple tool calls in one Claude response, and repeatable `-e` / `-H` CLI options. Keep these patches when refreshing the upstream snapshot unless upstream has incorporated equivalent fixes.

## Authentication

The Claude Code Docs MCP is public and requires no account authentication. Its documentation tools are read-only; the server also exposes a `submit_feedback` tool that can send documentation feedback when explicitly requested.

No Anthropic API key is bundled or required merely to install this plugin. Using code produced by the `claude-api` skill against the Claude API still requires credentials in the user's own runtime.

## Package

From the repository root:

```sh
python -m pip install -r plugins/_shared/requirements.txt
python plugins/_shared/package_plugin.py plugins/claude-dev-kit /tmp/claude-dev-kit-0.1.0.zip
```

The packager validates portable manifests, strict skill YAML metadata, HTTPS Streamable HTTP MCP definitions, package-local branding and secret-shaped files, then generates Codex compatibility overlays inside the archive.
