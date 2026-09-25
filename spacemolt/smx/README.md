# smx

`smx` is a small human/agent-friendly companion shell for the official
[SpaceMolt v2 client](https://github.com/SpaceMolt/client-v2).

It deliberately does **not** copy the v2 OpenAPI models or session logic. The
official `spacemolt` binary remains the source of truth; `smx` only adds the
conveniences that made `vcarl/sm-cli` pleasant to drive.

## What it adds

- `smx sell-all` — sell cargo sequentially through the official client, with
  `--dry-run`, `--keep`, and aggregate `--json` output.
- `smx nearby` — compact visible-threat hints from `get_nearby` without hidden
  scans or combat actions.
- `smx missions` — active and available missions in one command.
- Friendly aliases such as `status`, `ship`, `cargo`, `map` and `skills`.
- Kebab-case compatibility: `get-map` becomes `get_map`.
- Fuzzy typo suggestions after unknown commands. Suggestions are never executed
  automatically, because auto-correcting a typo into `self_destruct` would be
  an impressively stupid feature.
- Universal passthrough to the official v2 CLI for everything else.
- Lazy tactical cards via `smx guide`: combat, boarding, trade, exploration,
  industry and operations. Nothing is loaded until explicitly requested.
- `smx mcp` prints the canonical MCP connection profiles: docs for development and the
  `full` v2 preset for gameplay agents.
- Isolated gameplay profiles let several players/agents stay logged in at once without
  racing on the official client's single `activeAccount` field.
- `smx fleet` reads every profile in parallel; `smx fleet check` is a watchdog-friendly
  dock-safety check that exits non-zero on undocked or broken profiles.
- `smx watch` safely refreshes read-only official commands; `--fields` projects only the
  JSON paths an agent actually needs.
- `smx doctor` diagnoses local backend/profile state, while `smx backend check/update`
  can verify and replace the managed official CLI from official GitHub release metadata.

## Install

### One-command local install

The installers put **`smx` itself on your user PATH through pipx** and keep the
official SpaceMolt backend inside smx's private state directory, so
`spacemolt.exe` does not need another global PATH entry.

Windows PowerShell:

```powershell
.\\install.ps1
```

Linux/macOS:

```bash
./install.sh
```

Use `-SkipBackend` on PowerShell or `--skip-backend` on POSIX if you already
manage the official client yourself.

After `pipx ensurepath`, open a new terminal once and check:

```bash
smx paths
smx --help
```

### Manual install

Install the official SpaceMolt v2 client and make sure `spacemolt` is on
`PATH`, then:

```bash
cd spacemolt/smx
python -m pip install .
```

Or use `pipx install .`.

If the official binary has a different name or location, set `SMX_BACKEND`.

## Examples

```bash
smx status
smx get-map
smx nearby
smx missions --json
smx sell-all --dry-run
smx sell-all --keep fuel_cell,mission_widget
smx guide combat
smx guide --search warp
smx guide combat --live
smx mcp
smx mcp gameplay
smx mcp docs --json
smx profiles
smx -p gremlin status
smx -p claude status
smx fleet
smx fleet check
smx --fields player.username,ship.fuel status
smx watch status --count 3 --interval 5
smx doctor
smx doctor --online
smx backend check
smx backend update

# Anything unknown to smx goes straight to the official v2 client:
smx drone/list
smx shipping/active
smx catalog type=ships
```

## Design rules

1. **Live v2 wins.** `smx` does not maintain a second endpoint catalog or game
   model. The official v2 CLI/OpenAPI remains authoritative.
2. **No credential store.** Login, auto-relogin, accounts and session files stay
   entirely inside `SpaceMolt/client-v2`.
3. **Conveniences may compose commands, not redefine mechanics.** Derived threat
   markers are explicitly heuristic.
4. **No fuzzy auto-execution.** Typos get suggestions only.
5. **Knowledge is lazy.** Local cards are packaged with `smx`, but only the requested
   card or matching search lines are read. `--live` intentionally delegates to the
   current server guide when freshness matters.
6. **MCP roles stay separate.** `mcp/docs` is for building and contract lookup;
   `mcp/v2?preset=full` is the recommended complete gameplay surface for agents.
7. **Credentials stay in private app state.** When `SPACEMOLT_SESSION` is not
   explicitly set, smx redirects the official client's plaintext session store away
   from the working directory into smx's own state directory.
8. **Parallel players do not share `activeAccount`.** Each smx gameplay profile points
   the official client at a separate session file; the backend and game API remain shared.

## Parallel gameplay profiles

The official client can store several accounts in one file, but that file still has one
shared `activeAccount`. That is fine for a human switching accounts and awkward for two
agents running at the same time.

`smx` can instead give every agent its own official-client session store:

```text
smx/
└── profiles/
    ├── gremlin/session.json
    └── claude/session.json
```

Common commands:

```bash
smx profile migrate gremlin      # move the old flat session and make it default
smx profile add claude
smx profile login claude ClaudeBot
smx profiles

smx status                       # current default profile
smx -p gremlin status
smx -p claude status
```

`smx profile login` prompts for the password without putting it in shell history.
For automation, `--password-stdin` is available. Use `smx profile use NAME` to choose
the default profile, or set `SMX_PROFILE=NAME` per agent/process.

Each profile gets a separate `SPACEMOLT_SESSION` path, so processes can run concurrently
without changing each other's active account. An explicitly supplied
`SPACEMOLT_SESSION` still wins over profile selection.

Removing a profile deletes its stored credentials and therefore requires explicit
confirmation:

```bash
smx profile remove claude --yes
```

## Fleet status

Gameplay profiles can be inspected together without switching the shared active account:

```bash
smx fleet
smx fleet --json
smx fleet --only-undocked
smx fleet check
```

`fleet` calls the official `get_status --json` independently for each stored profile
and presents a compact read-only summary. Collection is concurrent because each smx
profile has its own session file.

`fleet check` exits with status 1 if any configured profile fails to report status or is
not docked. This makes it suitable for simple watchdogs before ending an agent session.
An explicit process-wide `SPACEMOLT_SESSION` is refused for fleet mode because it would
defeat profile isolation.

## Watch and field projection

Project selected paths from any official passthrough command without teaching smx a second
response model:

```bash
smx --fields player.username,ship.fuel,ship.cargo_used status
smx -p gremlin --fields player.username,location.system_name status
```

Projection asks the official client for `--json`, unwraps `structuredContent`, and fails
explicitly when a requested path is missing. The output is a compact JSON object keyed by
the requested paths.

For live terminal monitoring:

```bash
smx watch status
smx watch status --interval 5
smx watch status --count 6 --fields player.username,ship.fuel
```

`watch` is deliberately conservative. It only accepts commands that look read-only
(`get_*`, `list_*`, `view_*`, `find_*`, `search_*`, plus a few local reference
commands). Mutating commands such as `mine`, `sell`, or `travel` are refused instead
of being repeated accidentally.

Use `--` before official command arguments if they collide with watch's own
`--interval`, `--count`, or `--fields` options.

## Doctor and managed backend updates

Local diagnostics stay offline by default:

```bash
smx doctor
smx doctor --json
smx backend status
```

Use an explicit online check when release freshness matters:

```bash
smx doctor --online
smx backend check
```

The managed backend updater only targets official `SpaceMolt/client-v2` GitHub releases:

```bash
smx backend update
```

Before replacing `<smx-state>/bin/spacemolt[.exe]`, smx:

1. selects the release asset for the current OS/architecture,
2. requires the release asset's published SHA-256 digest,
3. downloads to a temporary file,
4. verifies size and SHA-256,
5. executes the temporary client with `--version`,
6. only then atomically replaces the managed backend.

If `SMX_BACKEND` is explicitly set, updating the managed backend does not override that
selection and smx prints a warning.

## Tactical cards

```bash
smx guide                 # list tiny bundled cards
smx guide combat          # load one card
smx guide --search tackle # search matching lines only
smx guide combat --json   # agent-friendly local payload
smx guide combat --live   # ask the current SpaceMolt server guide instead
```

The cards are deliberately short reminders, not a frozen copy of the game manual.
They cover high-value habits and point back to live v2 for mechanics likely to change.
This keeps context small while still giving humans and agents a local field manual.

## MCP profiles

```bash
smx mcp            # show both roles
smx mcp gameplay   # https://game.spacemolt.com/mcp/v2?preset=full
smx mcp docs       # https://game.spacemolt.com/mcp/docs
```

The docs MCP is a **development tool**, not a normal gameplay dependency. When
changing wrappers, query its exact command contracts instead of guessing or
copying the full OpenAPI catalog into this repo. An agent actually playing over
MCP should use the v2 `full` preset when complete tool access is wanted.

See [DEVELOPMENT.md](DEVELOPMENT.md) for the contract lookup flow and setup
examples.

## Local state and credentials

The official v2 client stores account credentials in its session JSON. When it is
called through `smx`, the default is redirected to a stable smx-owned location:

| Platform | Default smx state |
| --- | --- |
| Windows | `%LOCALAPPDATA%\\smx` |
| Linux | `$XDG_STATE_HOME/smx`, or `~/.local/state/smx` |
| macOS | `~/Library/Application Support/smx` |

Before profiles are configured, the legacy/default session file is
`spacemolt-session.json` inside that directory. Gameplay profiles use
`profiles/<name>/session.json`. The optional managed backend remains shared under `bin/`.

```bash
smx paths
smx paths --json
```

Overrides remain available:

- `SMX_PROFILE` selects a gameplay profile for the current process/agent.
- `SMX_STATE_DIR` moves the whole smx state directory.
- `SPACEMOLT_SESSION` wins over smx's default and points at an exact session file.
- `SMX_BACKEND` wins over both the managed backend and PATH lookup.

The official client stores credentials in plaintext and uses mode `0600` where
the platform supports it. Do not commit or share the session JSON.

## Requirements

- Python 3.10+
- Official `SpaceMolt/client-v2` CLI available as `spacemolt`, or selected with
  `SMX_BACKEND`
- No Python runtime dependencies

## Inspiration

The UX is inspired by [`vcarl/sm-cli`](https://github.com/vcarl/sm-cli),
[`CoinAnole/spacemolt-cli`](https://github.com/CoinAnole/spacemolt-cli), and
[`rsned/spacemolt`](https://github.com/rsned/spacemolt). Ideas such as safe watch loops,
compact projections, fleet observability, and backend maintenance are adapted to smx's
thin-wrapper design. This implementation is new code and keeps the official v2 client as
the source of truth instead of duplicating its API/auth/session stack.
