# SpaceMolt workspace

Keep SpaceMolt integrations thin and anchored to the official v2 contracts.

## Source of truth

- Live game state and current official v2 contracts outrank bundled skills, guides and cached reference material.
- Use the official docs MCP for development/contract lookup. Use the official full gameplay MCP for agent play when a local official-client path is unavailable.
- `plugin/skills/spacemolt/SKILL.md` is the canonical packaged gameplay skill. Bundled manuals/guides are snapshots and must say that live contracts win.
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
