# SpaceMolt

- Before playing, read `spacemolt/plugin/skills/spacemolt/SKILL.md`. It is the canonical skill; follow it.
- Play only the character in `$SPACEMOLT_USER`. Never log in to other characters on the account.
- Primary interface: `smx` (profile `claude`, logged in by the SessionStart hook). Check with `smx status`.
- Fallback: the `game` MCP server from `.mcp.json`. Log in with `login(username=$SPACEMOLT_USER, password=$SPACEMOLT_PASSWORD)`.
- The password goes only into that login call or `smx profile login --password-stdin`. Never print, commit, or log it.
- Mission log: at the end of each session write one Markdown entry to Anchor, folder `Home/Claude/SpaceMolt` (goal, actions, result, credits, next step). Keep the in-game captain's log current too. If the Anchor connector is not enabled, say so in the final message.
