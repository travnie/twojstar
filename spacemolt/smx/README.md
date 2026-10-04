# smx

`smx` is a small human/agent-friendly companion for the official [SpaceMolt v2 client](https://github.com/SpaceMolt/client-v2).

The official `spacemolt` binary remains authoritative for API models, auth and sessions. `smx` adds safer ergonomics without maintaining a second client stack.

## What it adds

- friendly aliases and kebab-case compatibility,
- `sell-all`, `nearby` and combined mission views,
- typo suggestions without automatic execution,
- passthrough to every official v2 command,
- lazy tactical cards through `smx guide`,
- canonical docs/gameplay MCP profiles through `smx mcp`,
- isolated gameplay profiles for concurrent players/agents,
- parallel `fleet` status and dock-safety checks,
- conservative read-only `watch` plus JSON field projection,
- local diagnostics and verified managed-backend updates.

## Install

The installers put `smx` on the user PATH through uv (when available) or pipx and keep the managed official backend in smx private state. Both installers use `smx backend update`, which verifies the official release digest and version before atomic replacement.

Windows PowerShell:

```powershell
.\install.ps1
```

Linux/macOS:

```bash
./install.sh
```

Use `-SkipBackend` / `--skip-backend` if the official client is managed separately. After the tool installer updates PATH, open a new terminal and verify:

```bash
smx paths
smx --help
```

Manual install:

```bash
cd spacemolt/smx
python -m pip install .
# or: pipx install .
```

Set `SMX_BACKEND` when the official binary is not discoverable as `spacemolt`.

## Common commands

```bash
smx status
smx nearby
smx missions --json
smx sell-all --dry-run
smx sell-all --keep fuel_cell,mission_widget

smx guide combat
smx guide combat --live

smx profiles
smx -p gremlin status
smx fleet
smx fleet check

smx --fields player.username,ship.fuel status
smx watch status --count 3 --interval 5

smx doctor
smx doctor --online
smx backend check
smx backend update

smx mcp
smx mcp gameplay
smx mcp docs --json

# Unknown smx commands pass through to official v2:
smx drone/list
smx shipping/active
```

## Invariants

1. **Live v2 wins.** Official v2 CLI/OpenAPI and live game state outrank local cards.
2. **No second auth/API stack.** `smx` composes official commands instead of reimplementing mechanics, retries or response models.
3. **No fuzzy auto-execution.** Unknown commands may get suggestions, never automatic correction.
4. **Knowledge stays lazy.** Bundled cards load only when requested; `--live` asks the current server guide.
5. **MCP roles stay separate.** Docs MCP is for development; the full v2 preset is for gameplay.
6. **Credentials stay outside worktrees.** Default sessions live in private smx state.
7. **Parallel players use separate session files.** They never race on the official client's shared `activeAccount`.

## Gameplay profiles and fleet

```bash
smx profile migrate gremlin
smx profile add claude
smx profile login claude ClaudeBot
smx profile use gremlin
smx profiles

smx -p gremlin status
smx -p claude status

smx fleet
smx fleet --json
smx fleet --only-undocked
smx fleet check
```

`profile login` prompts for the password; automation can use `--password-stdin`. Each profile receives a separate `SPACEMOLT_SESSION` path, so concurrent processes do not change each other's active account.

`fleet check` exits non-zero when a configured profile fails status or is undocked. A process-wide explicit `SPACEMOLT_SESSION` is rejected in fleet mode because it would defeat isolation.

Removing a profile deletes stored credentials and requires explicit confirmation:

```bash
smx profile remove claude --yes
```

## Watch and projection

`--fields` requests official JSON and returns only selected paths:

```bash
smx --fields player.username,ship.fuel,ship.cargo_used status
```

`watch` repeats only commands classified as read-only:

```bash
smx watch status
smx watch status --interval 5 --count 6 --fields player.username,ship.fuel
```

Mutating commands are refused rather than repeated accidentally. `get_notifications` is watchable only with `clear=false`.

## Backend maintenance

```bash
smx doctor
smx backend status
smx doctor --online
smx backend check
smx backend update
```

Managed updates only use official `SpaceMolt/client-v2` releases. Before replacing the backend, smx selects the matching asset, requires its published SHA-256 digest, verifies the download, executes `--version`, then replaces the binary atomically. An explicit `SMX_BACKEND` override is never silently replaced.

## Tactical cards and MCP

```bash
smx guide
smx guide combat
smx guide --search tackle
smx guide combat --json
smx guide combat --live

smx mcp gameplay   # https://game.spacemolt.com/mcp/v2?preset=full
smx mcp docs       # https://game.spacemolt.com/mcp/docs
```

Cards are short tactical reminders, not a frozen game manual. When building/changing wrappers, query the docs MCP for exact contracts. See [DEVELOPMENT.md](DEVELOPMENT.md).

## Local state and credentials

| Platform | Default smx state |
| --- | --- |
| Windows | `%LOCALAPPDATA%\smx` |
| Linux | `$XDG_STATE_HOME/smx`, or `~/.local/state/smx` |
| macOS | `~/Library/Application Support/smx` |

Default session state lives under that directory; profiles use `profiles/<name>/session.json`, and the managed backend is shared under `bin/`.

Overrides:

- `SMX_PROFILE`: profile for this process,
- `SMX_STATE_DIR`: whole smx state directory,
- `SPACEMOLT_SESSION`: exact session file, highest session-path priority,
- `SMX_BACKEND`: backend executable, higher priority than managed/PATH lookup.

The official client stores credentials in session JSON and uses mode `0600` where supported. Never commit or share session files.

## Requirements

- Python 3.10+
- official `SpaceMolt/client-v2` CLI, managed by smx or supplied through `SMX_BACKEND`
- no Python runtime dependencies

## Inspiration

The UX borrows ideas from [`vcarl/sm-cli`](https://github.com/vcarl/sm-cli), [`CoinAnole/spacemolt-cli`](https://github.com/CoinAnole/spacemolt-cli) and [`rsned/spacemolt`](https://github.com/rsned/spacemolt), while keeping the official v2 client as the source of truth.
