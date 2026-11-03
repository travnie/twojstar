# Workspace operations

Use host-provided file/search/shell tools, not a fictional SpaceMolt filesystem API. Load this only when editing code or files.

- Inspect local repository instructions, target branch, recent work and existing tests before changes.
- Read/search first. Before writing, patching, deleting or running mutating commands, confirm the user's authorization and the host's permissions. Preserve unrelated files, secrets, profile sessions and generated artifacts.
- Use supported native file operations when possible; shell/test tools only if available.
- Follow project PR and authoring rules. Run focused offline tests or state precisely which checks were unavailable.
- Never use a real player's login or mutating gameplay calls as a development fixture.
