#!/usr/bin/env sh
# SessionStart, cloud sessions only: install smx with the official SpaceMolt
# backend and log the agent's character in from environment variables.
# Never fails the session: without smx the game MCP server is the fallback.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

export PATH="$HOME/.local/bin:$PATH"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

if ! command -v smx >/dev/null 2>&1; then
  sh spacemolt/smx/install.sh >&2 || { echo "smx: install failed; use the game MCP server" >&2; exit 0; }
fi

if [ -n "${SPACEMOLT_USER:-}" ] && [ -n "${SPACEMOLT_PASSWORD:-}" ]; then
  if printf '%s\n' "$SPACEMOLT_PASSWORD" | smx profile login claude "$SPACEMOLT_USER" --use --password-stdin >/dev/null 2>&1; then
    echo "smx: profile claude logged in as $SPACEMOLT_USER"
  else
    echo "smx: login failed; check SPACEMOLT_USER / SPACEMOLT_PASSWORD" >&2
  fi
fi
exit 0
