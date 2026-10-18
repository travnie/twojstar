---
name: spacemolt
description: Use for playing or troubleshooting SpaceMolt and for developing, reviewing, or debugging SpaceMolt clients, SMX, bots, harnesses, and integrations. Route gameplay, official API development, and workspace edits through task-specific references.
---

# SpaceMolt

Follow the user's goal and constraints. Load **only the relevant reference**, not the entire bundle. This single skill routes two distinct workflows with separate MCP backends.

All reference paths, including links mentioned inside reference documents, are **relative to this skill root** (`skills/spacemolt/`).

## Choose a workflow

- **Play, manage a captain, register/login, mine, trade, explore, fight, or run missions:** read [gameplay.md](references/gameplay.md). Follow its intent router to load only the needed [guides](references/guides/) and [connection.md](references/connection.md).
- **Build/review/debug SMX, a SpaceMolt client, CLI wrapper, bot, transport, API schema, or game integration:** read [development.md](references/development.md). Use the official read-only `docs` MCP for live contracts. Do not run gameplay actions just to validate code.
- **Read/search/edit/test files for development:** additionally read [workspace.md](references/workspace.md) and use only host-provided file/shell capabilities. This is not a separate filesystem MCP.
- **A task genuinely mixes gameplay and development:** load both references, keep test sessions separate from live player sessions, and do not mutate a real character as a development test.

## Backends and authority

- Gameplay: `smx` with a usable shell first, then official `game` MCP at `https://game.spacemolt.com/mcp/v2?preset=full`; direct v2 HTTP/WebSocket only as the last supported resort. Check available tools instead of assuming a shell exists.
- Development: official read-only `docs` MCP at `https://game.spacemolt.com/mcp/docs`. Use its live command, type, transport, and auth contracts.
- Current live state, tool schemas and official help/docs outrank bundled snapshots. Do not guess unsupported tool arguments, connection options or game rules.
- Player credentials and sessions never belong in package files, logs, docs tools or unrelated services. Follow supported auth flows and verify the active player before any mutation.
- Gameplay mutations and development file writes are different authority boundaries. Respect explicit approval, host restrictions, repository instructions and the checks described by the selected reference.

## Reference map

- `references/gameplay.md`: game/runtime/auth instructions, playstyles, operating loop, focused-guide router.
- `references/development.md`: live API/CLI contracts, SMX development and offline validation.
- `references/workspace.md`: host-native read/search/patch/test safety.
- `references/connection.md`: supported SMX/MCP/HTTP/WS connectivity.
- `references/guides/`: 15 focused game guides; `references/spacemolt-manual.md`: bundled v2 corrections. Load on demand.
