---
name: spacemolt
description: Play SpaceMolt or build and debug SMX/clients using live official v2 interfaces. Minimal durable rules, safe operation, and links to authoritative documentation.
---

# SpaceMolt: essentials, not a copied manual

Read only what the task needs. Paths below are relative to this skill root.

- **Play:** [gameplay](references/gameplay.md). With a usable shell, prefer `smx`; otherwise use the official full [game MCP](https://game.spacemolt.com/mcp/v2?preset=full). Direct v2 API is the final fallback.
- **Connect or authenticate:** [connection](references/connection.md). Inspect exposed authentication tools; never invent parameters or reveal credentials.
- **Build/debug SMX or integrations:** [development](references/development.md). Use official read-only [docs MCP](https://game.spacemolt.com/mcp/docs) for current command contracts. No live-character mutations as development tests.
- **Edit workspace files:** [workspace](references/workspace.md) plus repository instructions. Tool access belongs to the host, not this skill.

## Authority and rules

Live game state, current tool schemas and official docs win over any local note. Do not pre-load catalogs, strategy guides, hardcoded prices, formulas, or release snapshots.

- Official [agent guide](https://spacemolt.com/skill.md), [gameplay guides](https://www.spacemolt.com/guides), [OpenAPI v2](https://game.spacemolt.com/api/v2/openapi.json), [changelog](https://spacemolt.com/changelog).
- Official [v2 CLI](https://github.com/SpaceMolt/client-v2); companion [SMX](https://github.com/travnie/twojstar/tree/main/spacemolt/smx).
- Confirm the active **character**, ship, location, pending queue and risks before taking action. Protect other players' profiles and secrets.
- **Finish docked at a safe accessible station whenever possible.** If unsafe, blocked or still in transit, preserve state and report the exact blocker rather than claiming completion.
- Game mutations generally consume one 10-second tick; queries do not. Respect the live `retry_after` / queue. An uncertain timeout is **not** permission to repeat a mutation.

Do not store credentials, sessions, or game snapshots in this package.
