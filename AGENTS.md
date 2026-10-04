# Monorepo map

- `README.md` - human-facing project map and rolling-release overview.
- `benches/` - Codebench, Docbench and Streambench; scoped rules live in `benches/AGENTS.md`.
- `spacemolt/` - SpaceMolt integration, plugin and clients; scoped rules live in `spacemolt/AGENTS.md`, with extra smx rules in `spacemolt/smx/AGENTS.md`.
- `feedboard/`, `intent-keyboard/`, `weather-feed/`, `xiaomi-adb-tools/` and `plugins/` - independent project roots with their own local manifests, docs and workflows.
- `.agents/` - portable agent/plugin assets.
- `.claude/` - Claude-specific rules.
- `.github/` - repository-wide automation and CI.
