#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

if command -v uv >/dev/null 2>&1; then
  uv tool install --force "$SCRIPT_DIR"
else
  # pipx must create the smx environment with Python 3.14+, not the system default.
  SMX_PYTHON=""
  for candidate in python3.15 python3.14 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 &&
       "$candidate" -c 'import sys; sys.exit(sys.version_info < (3, 14))' >/dev/null 2>&1; then
      SMX_PYTHON=$(command -v "$candidate")
      break
    fi
  done
  if [ -z "$SMX_PYTHON" ]; then
    echo "smx requires Python 3.14 or newer (or uv)." >&2
    exit 1
  fi
  "$SMX_PYTHON" -m pip install --user --upgrade pipx
  "$SMX_PYTHON" -m pipx ensurepath
  "$SMX_PYTHON" -m pipx install --python "$SMX_PYTHON" --force "$SCRIPT_DIR"
fi

if [ "${1:-}" != "--skip-backend" ]; then
  if command -v uv >/dev/null 2>&1; then
    SMX_BIN_DIR=$(uv tool dir --bin)
  else
    SMX_BIN_DIR=$("$SMX_PYTHON" -m pipx environment --value PIPX_BIN_DIR)
  fi
  "$SMX_BIN_DIR/smx" backend update
fi

echo
echo "Done. Open a new shell, then run:"
echo "  smx paths"
echo "  smx --help"
