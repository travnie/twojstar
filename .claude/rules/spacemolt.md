# SpaceMolt

- Follow `spacemolt/AGENTS.md` and read `spacemolt/plugin/skills/spacemolt/SKILL.md` before playing.
- Play only the character in `$SPACEMOLT_USER`. Never switch to another character on the account.
- Prefer the smx profile prepared by the workspace/session hook; verify the active character with `smx status`.
- If the local smx/backend path is unavailable, use the official gameplay MCP configured for the workspace. When `$SPACEMOLT_USER` and `$SPACEMOLT_PASSWORD` are provided, authenticate through the MCP's supported login action if needed, then verify live status belongs to `$SPACEMOLT_USER` before acting. If that login path is unavailable, follow the live MCP auth schema rather than inventing another route.
- The password goes only into the official login call or `smx profile login --password-stdin`. Never print, commit or log it.
- At session end, write one concise Markdown mission-log entry to the character-specific Anchor folder `Home/Claude/SpaceMolt/<$SPACEMOLT_USER>`: goal, actions, result, credits and next step. Create the folder if missing. Keep the in-game captain log current when useful. If Anchor is unavailable, say so in the final response instead of silently dropping the log.
- Never read or edit another character's notes as this character's state.
