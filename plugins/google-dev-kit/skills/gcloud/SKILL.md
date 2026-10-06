---
name: gcloud
description: Safely plans and executes gcloud CLI work with exact leaf-command help validation, explicit project and location scope, reduced output, and approval gates. Use whenever a response proposes, explains, or runs gcloud commands.
---

# gcloud Guardrails

Treat remembered CLI syntax as stale.

1. Validate the exact leaf command before proposing or executing it. With Cloud CLI MCP, use command help; otherwise run `gcloud help <leaf command>` locally.
2. Preserve user-specified project and flags. Resource commands should be explicit about project and required region/zone/location.
3. Keep discovery output bounded with `--limit`, `--filter`, or `--format`.
4. Execute one command at a time. Prefer non-interactive commands and preview/validation modes when verified leaf help supports them.
5. Do not autonomously enable APIs, change IAM, billing, organization policy, KMS, or delete resources. Present the exact change and obtain authorization.

Read [safety.md](references/safety.md) before mutation and [mcp.md](references/mcp.md) for Cloud CLI MCP specifics.
