#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
WEB_URL="http://127.0.0.1:18080"
API_URL="http://127.0.0.1:18081/api/health"

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

uv run python -c "import uvicorn" >/dev/null 2>&1 || {
  printf '[fail] uvicorn is required to launch apps/api/main.py.\n' >&2
  exit 1
}

nohup uv run python -m uvicorn apps.api.main:app --host 127.0.0.1 --port 18081 >"$API_LOG" 2>&1 &
nohup pnpm --dir apps/web dev --host 127.0.0.1 --port 18080 >"$WEB_LOG" 2>&1 &

sleep 2
printf 'API entry: %s/apps/api/main.py\n' "$ROOT_DIR"
printf 'Web entry: %s/apps/web\n' "$ROOT_DIR"
printf 'Web URL: %s\n' "$WEB_URL"
printf 'API health: %s\n' "$API_URL"
printf 'Logs: %s %s\n' "$API_LOG" "$WEB_LOG"
curl -fsS "$API_URL"
open "$WEB_URL"
