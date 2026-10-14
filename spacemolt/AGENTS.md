# SpaceMolt workspace

Keep SpaceMolt integrations thin and anchored to the official v2 contracts.

## Source of truth

- Live game state and current official v2 contracts outrank bundled skills, guides and cached reference material.
- Use the official docs MCP for development/contract lookup. Use the official full gameplay MCP for agent play when a local official-client path is unavailable.
- `plugins/spacemolt/skills/spacemolt/SKILL.md` is the canonical packaged gameplay skill. Bundled manuals/guides are snapshots and must say that live contracts win.
- Do not copy the official OpenAPI/manual wholesale into another maintained client model.

## Integration boundaries

- `smx`, the plugin and the gateway adapt official interfaces; they must not redefine game mechanics, authentication or session semantics.
- Keep host capabilities separate: shell-capable clients may prefer `smx`; hosted clients must still work through official MCP without assuming a local shell.
- Validate gateway chat/tool input at the boundary and fail closed on malformed or unsupported shapes.
- MCP tool annotations are behavioral contract, not decoration. Read-only, destructive, idempotent and open-world hints must match actual tool semantics.
- Derived threat/risk/convenience signals are heuristics. Never present them as authoritative game state.
- Never package, commit, log or fixture player passwords, session files or live credentials.

## Packaging and deployment

- Use the maintained packaging script for the plugin; portable metadata/assets remain canonical and generated compatibility files stay generated.
- Keep deployed gateway configuration in Wrangler/project config and secrets in Cloudflare secrets. Do not freeze model/version/budget snapshots into agent instructions.

## Changes

- Before changing wrappers, skills or gateway contracts, verify the affected official v2 surface instead of guessing from old examples.
- CI/tests must not mutate real player accounts or require live game availability when a fake/local boundary can verify the behavior.

## Playing

- Read `plugins/spacemolt/skills/spacemolt/SKILL.md` before playing.
- Play only the character in `$SPACEMOLT_USER`. Never switch to another character on the account.
- Prefer the smx profile prepared by the session hook; verify the active character with `smx status`.
- Outside cloud sessions, if the local smx/backend path is unavailable, use the official gameplay MCP configured for the workspace. When `$SPACEMOLT_USER` and `$SPACEMOLT_PASSWORD` are provided, authenticate through the MCP's supported login action if needed, then verify live status belongs to `$SPACEMOLT_USER` before acting. If that login path is unavailable, follow the live MCP auth schema rather than inventing another route.
- The password goes only into the official login call or `smx profile login --password-stdin`. Never print, commit or log it.
- At session end, write one concise Markdown mission-log entry to the character-specific Anchor folder `Home/Claude/SpaceMolt/<$SPACEMOLT_USER>`: goal, actions, result, credits and next step. Create the folder if missing. Keep the in-game captain log current when useful. If Anchor is unavailable, say so in the final response instead of silently dropping the log.
- Never read or edit another character's notes as this character's state.

### Cloud sessions (scheduled play)

- The environment's session-start hook (cloud setup script, not this repo) installs `smx`, fetches the official backend (mirror release, else source build) and logs in profile `claude` from env. Play through `smx`; check `smx backend status` and `smx status`.
- Never read, echo or pass `SPACEMOLT_PASSWORD` yourself here; only the hook uses it (auto mode blocks it anyway), so password-based MCP login is out.
- If `smx` isn't ready, report the hook output and stop. Don't install or build things yourself.
