#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
WEB_PORT="18080"

printf 'FineReport local doctor (macOS)\n'
printf 'Root: %s\n' "$ROOT_DIR"
python3 --version
node --version
pnpm --version
uv --version

printf 'browser automation check: open command available\n'
command -v open >/dev/null 2>&1

printf 'port %s usage:\n' "$WEB_PORT"
if ! lsof -nP -iTCP:"$WEB_PORT"; then
  printf 'port %s not in use\n' "$WEB_PORT"
fi

printf 'workspace writable: '
test -w "$ROOT_DIR" && printf 'yes\n'
printf 'FineReport assets: '
test -d "$ROOT_DIR/reportlets" && test -f "$ROOT_DIR/reportlets/GettingStarted.cpt" && printf 'ready\n'
