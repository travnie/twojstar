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

## Install

Install the official SpaceMolt v2 client first and make sure `spacemolt` is on
`PATH`. Then:

```bash
cd smx
python -m pip install .
```

Or with `pipx`:

```bash
pipx install .
```

If the official binary has a different name or location:

```bash
SMX_BACKEND=/path/to/spacemolt smx status
```

PowerShell:

```powershell
$env:SMX_BACKEND = "C:\\Tools\\spacemolt.exe"
smx status
```

## Examples

```bash
smx status
smx get-map
smx nearby
smx missions --json
smx sell-all --dry-run
smx sell-all --keep fuel_cell,mission_widget

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
