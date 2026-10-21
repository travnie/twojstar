#!/usr/bin/env bash
# Cloud session bootstrap: smx + official backend, profile `claude` logged in from env.
# Called by the cloud SessionStart hook (environment setup script) from the repo root. Never fails.
# Backend: cloud GitHub proxy refuses SpaceMolt/client-v2 releases unless attached, so
# 1. linux-x64 mirror from .github/workflows/smx.yml; 2. else bun source build.
cd "$(dirname "$0")/../.." || exit 0
export PATH="$HOME/.local/bin:$PATH"
# shellcheck disable=SC2016 # expands in the session shell
[ -n "${CLAUDE_ENV_FILE:-}" ] && echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"

if ! command -v smx >/dev/null 2>&1; then
  # --skip-backend: managed update needs api.github.com.
  sh spacemolt/smx/install.sh --skip-backend >&2 || echo "smx: install failed; use the game MCP server" >&2
fi

BIN="$HOME/.local/bin/spacemolt"; mkdir -p "${BIN%/*}"
MIRROR=https://github.com/travnie/twojstar/releases/download/spacemolt-backend
ver() { "$1" --version 2>/dev/null | grep -oE 'v[0-9][0-9.]*' | head -1; }
have=$(ver "$BIN")
want=$(curl -fsSL --max-time 20 "$MIRROR/VERSION" 2>/dev/null | tr -d '[:space:]')
if [ -n "$want" ] && [ "$want" != "$have" ] \
  && curl -fsSL --max-time 120 "$MIRROR/spacemolt.gz" | gunzip > "$BIN.tmp" \
  && chmod +x "$BIN.tmp" && "$BIN.tmp" --version >/dev/null 2>&1; then
  mv "$BIN.tmp" "$BIN"; echo "spacemolt backend: $want from mirror"
else
  rm -f "$BIN.tmp"
fi

BUN=$(command -v bun || echo "$HOME/.bun/bin/bun")
if [ -z "$(ver "$BIN")" ] && [ -x "$BUN" ]; then
  tag=$(git ls-remote --tags --refs https://github.com/SpaceMolt/client-v2 'v*' 2>/dev/null \
    | sed 's#.*refs/tags/##' | sort -V | tail -1)
  src="$HOME/.cache/spacemolt-client-v2"; rm -rf "$src"
  if [ -n "$tag" ] \
    && git -c advice.detachedHead=false clone -q --depth 1 --branch "$tag" https://github.com/SpaceMolt/client-v2 "$src" \
    && (cd "$src" && "$BUN" build src/main.ts --compile --outfile "$BIN" >/dev/null); then
    echo "spacemolt backend: built $tag from source"
  fi
fi
"$BIN" --version >/dev/null 2>&1 || echo "spacemolt backend: unavailable (mirror and source build failed)" >&2

if command -v smx >/dev/null 2>&1 && [ -n "${SPACEMOLT_USER:-}" ] && [ -n "${SPACEMOLT_PASSWORD:-}" ]; then
  if printf '%s\n' "$SPACEMOLT_PASSWORD" | smx profile login claude "$SPACEMOLT_USER" --use --password-stdin >/dev/null 2>&1; then
    echo "smx: profile claude logged in as $SPACEMOLT_USER"
  else
    echo "smx: login failed; check SPACEMOLT_USER / SPACEMOLT_PASSWORD" >&2
  fi
fi
exit 0
