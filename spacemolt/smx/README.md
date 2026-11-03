# smx

`smx` is a small human/agent-friendly companion for the official [SpaceMolt v2 client](https://github.com/SpaceMolt/client-v2).

The official `spacemolt` binary remains authoritative for API models, auth and sessions. `smx` adds safer ergonomics without maintaining a second client stack.

## What it adds

- friendly aliases and kebab-case compatibility,
- `sell-all`, `nearby` and combined mission views,
- read-only `route` preflight with live jump/fuel/fleet data, reserve checks and wormhole markers,
- `survive` combat/ship triage and opt-in guarded same-system `autodock`,
- typo and cached-ID suggestions without automatic execution,
- per-profile `ids` cache, local `where-can-i` market lookup and a collapsed `inbox`,
- `--dry-run` previews with risk notes,
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
smx route tau_ceti --reserve 20 --check
smx route station_poi_id --json
smx survive --json --check
smx autodock --json
smx autodock --target station_poi_id --execute
smx sell-all --dry-run
smx sell-all --keep fuel_cell,mission_widget

smx ids --refresh
smx ids poi --search belt
smx where-can-i iron
smx inbox
smx inbox --peek --all
smx --dry-run buy ore_iron 50

smx guide combat            # current in-game guide, local fallback
smx guide combat --live     # current server only; fail if unavailable
smx guide combat --offline  # bundled field card only
smx guide --live            # list current in-game guides
smx guide taxes             # forward upstream topics without local copies

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
smx backend update --version 1.5.93
smx backend rollback

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
4. **Live knowledge first.** `smx guide TOPIC` queries the official server before using a bundled card. `--live` requires the server; `--offline` forces a local snapshot. The upstream guide index remains dynamic.
5. **MCP roles stay separate.** Docs MCP is for development; the full v2 preset is for gameplay.
6. **Credentials stay outside worktrees.** Default sessions live in private smx state.
7. **Parallel players use separate session files.** They never race on the official client's shared `activeAccount`.

## Route preflight

`smx route DESTINATION` queries the official read-only `find_route id=DESTINATION`.
DESTINATION is a system, POI, or base **ID**, not a display name. The game's
live shortest path, fuel estimates, wormhole entrance markers, final POI and
optional fleet-member fuel figures are shown without moving the ship.

```bash
smx route tau_ceti
smx route tau_ceti --reserve 20 --check
smx route station_poi_id --json
```

`--reserve N` requires at least N fuel remaining on arrival for the pilot and
every returned fleet member. When the API omits `fleet_fuel`, the assessment
explicitly marks its scope as pilot-only instead of implying a fleet check.
`--check` exits 1 for insufficient fuel, no
known route or incomplete data, making it safe as an agent preflight gate.
Without `--check`, a low-fuel route is still displayed with a warning.
Machine-readable JSON includes the untouched official `find_route` data and
a separate conservative `assessment`; no cached routes or custom pathfinding.
A route may change as game state changes. Rerun before executing official
`jump` or `travel` commands.

## Pilot survival and autodock

`smx survive` is a **read-only** survival report from official `get_status`,
`get_system`, and (when your pilot participates in a visible battle)
`spacemolt_battle/status`. Reports current hull/shield/fuel, incapacitation,
pending actions, nearby pirates/leviathans and combat escape blockers.
It suggests existing official `smx spacemolt_battle/stance id=flee` or
`smx spacemolt_battle/stance id=brace` calls; **never
executes stances, attacks, repairs or distress broadcasts**. Low-condition
thresholds are labeled as heuristics, not game rules.

```bash
smx survive
smx survive --check --json
```

`smx autodock` previews a plan by default. It uses the current game state and
charted stations from `get_system`: at a station it plans `dock`; elsewhere
it plans `travel` **within the current system** and then `dock`. If multiple
stations are charted away from the current POI, specify `--target` POI/base ID.
No cross-system
jumps and no hidden POI guesses.

```bash
smx autodock                         # preview only; zero mutations
smx autodock --target station_id     # explicit destination preview
smx autodock --execute              # opt into bounded travel/dock actions
smx autodock --target station_id --execute --max-wait 120
smx autodock --json                  # structured plan/result
```

Before movement it refuses unknown/pending queues, transit, incapacitated
crew and verified player participation in a battle. Before docking it verifies
the actual station, public access and absence of an active local battle, then
rechecks position and queue. It does not retry ambiguous action outcomes.
Accepted travel is polled for up to `--max-wait` seconds; if transit or an
existing action queue remains pending, the command exits nonzero and the user
can rerun it after the action settles. Final
docking is verified via fresh state. SpaceMolt may still reject actions due to
fuel, reputation, station attacks or a concurrent state change.

**These commands do not run in the background**. Automated survival decisions
beyond read-only triage are left to the pilot/agent and official API.

## IDs, inbox and dry runs

`smx ids --refresh` queries the official system, cargo, nearby and market commands and stores what they returned per profile. Failed passthrough commands may print close cached IDs as hints, which are never executed.

`smx where-can-i ITEM` searches only markets recorded by a refresh while docked. It is a local memory, not a galaxy search, and shows the age of every row.

`smx inbox` counts routine crafting, market and observation events by type unless they mention completion or failure. Everything else is shown, with terminal control characters removed. Like the official command it clears the queue; add `--peek` to keep it, `--all` for every event.

`smx --dry-run <command>` prints the official command and risk notes without sending it, wherever the flag appears before `--`. `buy` with an item and quantity also asks the read-only `estimate_purchase`.

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
smx backend update --version 1.5.93
smx backend rollback
```

Managed updates only use official `SpaceMolt/client-v2` releases. Before replacing the backend, smx selects the matching asset, requires its published SHA-256 digest, verifies the download, executes `--version`, then replaces the binary atomically. An explicit `SMX_BACKEND` override is never silently replaced.

Each update keeps the replaced binary next to the managed one. `rollback` swaps the two, so running it twice undoes it. `update --version X` installs that exact official release, including downgrades; plain `update` only moves forward.

`status` and `check` show the newest backend this smx release was tested with; `doctor` warns when the active one is newer. A newer backend still runs.

In a terminal, a command that needs the missing backend offers to install it. Non-interactive callers get an error instead and never trigger a download.

If smx itself breaks, the official client still works with the same session. Take both paths from `smx paths`:

```bash
SPACEMOLT_SESSION=<session> <backend> get_status
```

## Tactical cards and MCP

```bash
smx guide
smx guide combat
smx guide --search tackle
smx guide combat --json
smx guide combat --live
smx guide combat --offline
smx guide --live

smx mcp gameplay   # https://game.spacemolt.com/mcp/v2?preset=full
smx mcp docs       # https://game.spacemolt.com/mcp/docs
```

Cards are short offline tactical reminders, not a frozen game manual. Normal topic lookups prefer the game's current `get_guide` content and warn before an offline fallback. The live guide index and newly introduced topics do not require a new `smx` release. The documentation MCP has a separate, broader guide catalog; consult it for development and exact contracts, not as a substitute for game command schemas. See [DEVELOPMENT.md](DEVELOPMENT.md).

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

- Python 3.14+
- official `SpaceMolt/client-v2` CLI, managed by smx or supplied through `SMX_BACKEND`
- no Python runtime dependencies

## Inspiration

The UX borrows ideas from [`vcarl/sm-cli`](https://github.com/vcarl/sm-cli), [`CoinAnole/spacemolt-cli`](https://github.com/CoinAnole/spacemolt-cli) and [`rsned/spacemolt`](https://github.com/rsned/spacemolt), while keeping the official v2 client as the source of truth.

## Published package

`uv tool install spacemolt-smx` installs the `smx` command; `smx backend update` then adds the official client. See [PUBLISHING.md](PUBLISHING.md). The plain name `smx` belongs to an unrelated PyPI project.
