# Docbench plugin foundation

Portable Agent Plugins 1.0 package for Docbench.

This first stage is intentionally **skills-only**. It packages the local-first
file workflow and listing metadata without pretending that a ChatGPT file
entrypoint or MCP server already exists.

The future MCP App/file-entrypoint work remains tracked in
[`../CHATGPT_PLUGIN.md`](../CHATGPT_PLUGIN.md). When a real host-integrated
runtime exists, add `mcp.json` here and keep this package as the single plugin
surface rather than creating a parallel wrapper.

The repository marketplace at `.agents/plugins/marketplace.json` exposes this
folder for local authoring and testing.
