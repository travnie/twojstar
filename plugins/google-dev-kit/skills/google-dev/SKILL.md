---
name: google-dev
description: Finds current official Google developer documentation and routes Google platform tasks to the right workflow or MCP. Use for Google Cloud, Gemini, Android, Firebase, Chrome, Flutter, Go, or other Google developer questions when live docs, product choice, API details, IAM permissions, or a Google skill are relevant.
---

# Google Developer Router

Use official, current Google material before recalled syntax.

1. For conceptual guidance or comparisons, query Developer Knowledge. Prefer conceptual QA; on quota errors, fall back to focused document search.
2. For exact syntax, permissions, fields, or flags, search and fetch the relevant document instead of guessing.
3. If the request maps to one of this plugin's focused skills, use it. Otherwise route to the narrowest MCP from [the endpoint catalog](references/mcp-catalog.md).
4. Treat authentication, permission, quota, empty-result, or transport errors as failed lookups. Never present memory as successful retrieval.
5. For broader Google skill discovery, consult the live `google/skills` catalog only for the current request. Do not persist a catalog snapshot.

Read [documentation-routing.md](references/documentation-routing.md) for retrieval and catalog rules.
