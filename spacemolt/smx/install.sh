#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

python3 -m pip install --user --upgrade pipx
python3 -m pipx ensurepath
python3 -m pipx install --force "$SCRIPT_DIR"

if [ "${1:-}" != "--skip-backend" ]; then
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS:$ARCH" in
    Linux:x86_64|Linux:amd64)
      ASSET="spacemolt-client-v2-linux-x64"
      ;;
    Linux:aarch64|Linux:arm64)
      ASSET="spacemolt-client-v2-linux-arm64"
      ;;
    Darwin:x86_64)
      ASSET="spacemolt-client-v2-macos-x64"
      ;;
    Darwin:arm64)
      ASSET="spacemolt-client-v2-macos-arm64"
      ;;
    *)
      echo "Unsupported platform for the official prebuilt backend: $OS $ARCH" >&2
      exit 1
      ;;
  esac

  if [ -n "${SMX_STATE_DIR:-}" ]; then
    STATE_DIR=$SMX_STATE_DIR
  elif [ "$OS" = "Darwin" ]; then
    STATE_DIR="$HOME/Library/Application Support/smx"
  else
    STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/smx"
  fi

  BIN_DIR="$STATE_DIR/bin"
  BACKEND="$BIN_DIR/spacemolt"
  mkdir -p "$BIN_DIR"
  chmod 700 "$STATE_DIR" "$BIN_DIR" 2>/dev/null || true

  URL="https://github.com/SpaceMolt/client-v2/releases/latest/download/$ASSET"
  echo "Installing official SpaceMolt v2 backend..."
  if command -v curl >/dev/null 2>&1; then
    curl -fL "$URL" -o "$BACKEND"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$BACKEND" "$URL"
  else
    echo "curl or wget is required to download the backend." >&2
    exit 1
  fi
  chmod 700 "$BACKEND"
  echo "Backend: $BACKEND"
fi

echo
echo "Done. Open a new shell, then run:"
echo "  smx paths"
echo "  smx --help"
