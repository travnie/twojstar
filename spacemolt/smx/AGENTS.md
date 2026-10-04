# smx agent notes

Inherit `../AGENTS.md`. Keep this project thin.

- Runtime wraps the official SpaceMolt v2 client. Do not reimplement auth, sessions, retries, rate limits, command catalogs or response models.
- Preserve universal passthrough to the official CLI; conveniences may compose commands but must not block unknown official commands.
- Use the official docs MCP before adding/changing a command wrapper. Never guess a live parameter or response schema.
- Bundled tactical cards stay short and lazy; they are reminders, not a second game manual.
- Session credentials stay outside repositories and working directories. Respect explicit `SPACEMOLT_SESSION`; otherwise use smx private state.
- Concurrent players/agents use separate smx gameplay profiles/session files. Do not coordinate them by mutating the official store's shared `activeAccount`.
- Managed backend install/update accepts only official client releases with a published SHA-256 digest, verifies the artifact, smoke-tests `--version`, then replaces atomically. Never install from a moving branch or unverified binary.
- CI must not log in, mutate a real account or require live SpaceMolt availability. Use unit/fake-backend tests.
