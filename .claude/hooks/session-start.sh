#!/usr/bin/env bash
# SessionStart, cloud sessions only. Never fails the session.
#  - npm ci for every committed package-lock.json (skipped when node_modules
#    is already newer than the lockfile, e.g. on resume)
#  - ANDROID_HOME fallback to the SDK from the environment setup script
#  - smx + official SpaceMolt backend, character logged in from env
#    (without smx the game MCP server is the fallback)
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

persist() { [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "$1" >> "$CLAUDE_ENV_FILE"; }

# npm installs run in the background while smx installs.
git ls-files '*package-lock.json' | while read -r lock; do
  dir=$(dirname "$lock")
  [ "$dir/node_modules/.package-lock.json" -nt "$lock" ] && continue
  if (cd "$dir" && npm ci --no-audit --no-fund --no-update-notifier --loglevel=error >/dev/null); then
    echo "npm ci: $dir"
  else
    echo "npm ci failed: $dir" >&2
  fi
done &
NPM=$!

if [ -z "${ANDROID_HOME:-}" ] && [ -d /opt/android-sdk ]; then
  persist 'export ANDROID_HOME=/opt/android-sdk'
fi

export PATH="$HOME/.local/bin:$PATH"
# shellcheck disable=SC2016 # expands in the session shell, not here
persist 'export PATH="$HOME/.local/bin:$PATH"'

if ! command -v smx >/dev/null 2>&1; then
  sh spacemolt/smx/install.sh >&2 || echo "smx: install failed; use the game MCP server" >&2
fi

if command -v smx >/dev/null 2>&1 && [ -n "${SPACEMOLT_USER:-}" ] && [ -n "${SPACEMOLT_PASSWORD:-}" ]; then
  if printf '%s\n' "$SPACEMOLT_PASSWORD" | smx profile login claude "$SPACEMOLT_USER" --use --password-stdin >/dev/null 2>&1; then
    echo "smx: profile claude logged in as $SPACEMOLT_USER"
  else
    echo "smx: login failed; check SPACEMOLT_USER / SPACEMOLT_PASSWORD" >&2
  fi
fi

wait "$NPM"
exit 0
