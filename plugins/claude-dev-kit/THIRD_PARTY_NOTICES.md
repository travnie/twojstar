# Third-party notices

## Anthropic skills

The `claude-api` and `mcp-builder` skill trees are redistributed from `anthropics/skills` at commit `683bc88e56f3e09ba94f7055977f3d3aa499f202`.

Their original `LICENSE.txt` files are retained inside each skill directory. The upstream material is licensed under Apache-2.0.\n\n### Local patches\n\nThe repository applies narrowly scoped compatibility fixes to `skills/mcp-builder/scripts/evaluation.py`: serialize MCP SDK content blocks before JSON reporting, return results for every tool call emitted in one response, and preserve repeated environment/header CLI options. These changes are maintained on top of the pinned upstream commit.

## Claude Code Docs MCP

The plugin references Anthropic's hosted Claude Code Docs MCP at `https://code.claude.com/docs/mcp`. The remote service itself is not redistributed by this repository.
