---
name: gemini-agents-api
description: Manages stateful custom Agent resources on Gemini Enterprise Agent Platform. Use for creating, inspecting, updating, listing, or deleting managed agents, including mounted files/skills and configured tools before conversations run.
---

# Gemini Managed Agents

This is the **control-plane** workflow for persistent Agent resources. Do not conflate it with ordinary Gemini model calls or the interaction/data plane.

1. Fetch current Agents API docs before constructing resource names, payloads, versions, or base-agent identifiers.
2. Confirm project/location and inspect the existing agent when changing one.
3. For create/update/delete, show the intended resource delta and obtain authorization when not already explicit.
4. Treat mounted storage, external MCP headers, network allowlists, and service identities as security-sensitive.
5. Track long-running operations to completion when required. After ambiguous timeout, inspect operation/resource state before retrying.

Read [control-plane.md](references/control-plane.md).
