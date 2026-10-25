## Monorepo map

- `benches/` - Codebench, Docbench and Streambench; scoped rules live in `benches/AGENTS.md`.
- `spacemolt/` - SpaceMolt integration, plugin and clients; scoped rules live in `spacemolt/AGENTS.md`, with extra smx rules in `spacemolt/smx/AGENTS.md`.
- `feedboard/`, `intent-keyboard/`, `weather-feed/`, `xiaomi-adb-tools/` and `addons/` - independent project roots with their own local manifests, docs and workflows.
- `plugins/` ai plugins.

## Code Review Rules

### 

- Avoid repeating what's already covered by CI checks, linting etc.
