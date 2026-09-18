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
- `smx mcp` prints the canonical MCP profiles: docs for development and the
  `full` v2 preset for gameplay agents.

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
cd smx
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

The default session file is `spacemolt-session.json` inside that directory.
The optional managed backend lives under `bin/` there as well.

```bash
smx paths
smx paths --json
```

Overrides remain available:

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
particularly its `sell-all`, tactical nearby view, forgiving command names and
agent-friendly JSON workflow. This implementation is new code and targets the
official v2 client instead of duplicating the v1 API layer.
