# Managed Agents control plane

The upstream `gemini-agents-api` skill covers persistent Agent resources: create, get, list, update, delete, and long-running-operation inspection.

Agents can include system instructions, workspace inputs, mounted Cloud Storage or skill-registry sources, network configuration, and tools such as code execution or remote MCP servers. Treat authentication material as sensitive.

Conversation execution belongs to the interaction/data plane. Fetch current Interactions API docs or a matching Google skill rather than improvising those payloads.

API versions and base-agent identifiers are preview-sensitive. Always fetch current docs before emitting exact endpoints or identifiers.
