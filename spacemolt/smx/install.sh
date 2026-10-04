#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

if command -v uv >/dev/null 2>&1; then
  uv tool install --force "$SCRIPT_DIR"
else
  python3 -m pip install --user --upgrade pipx
  python3 -m pipx ensurepath
  python3 -m pipx install --force "$SCRIPT_DIR"
fi

if [ "${1:-}" != "--skip-backend" ]; then
  if command -v uv >/dev/null 2>&1; then
    SMX_BIN_DIR=$(uv tool dir --bin)
  else
    SMX_BIN_DIR=$(python3 -m pipx environment --value PIPX_BIN_DIR)
  fi
  "$SMX_BIN_DIR/smx" backend update
fi

echo
echo "Done. Open a new shell, then run:"
echo "  smx paths"
echo "  smx --help"
