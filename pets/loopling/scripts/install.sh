#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
CODEX_ROOT=${CODEX_HOME:-"$HOME/.codex"}
TARGET="$CODEX_ROOT/pets/loopling"

mkdir -p "$TARGET"
STAGING=$(mktemp -d "$TARGET/.loopling-install.XXXXXX")
trap 'rm -rf "$STAGING"' EXIT HUP INT TERM

cp "$ROOT/pet/spritesheet.webp" "$STAGING/spritesheet.webp"
cp "$ROOT/pet/pet.json" "$STAGING/pet.json"
mv -f "$STAGING/spritesheet.webp" "$TARGET/spritesheet.webp"
mv -f "$STAGING/pet.json" "$TARGET/pet.json"

echo "Loopling installed to $TARGET"
echo "Restart ChatGPT, then open Settings -> Pets and select Loopling."
