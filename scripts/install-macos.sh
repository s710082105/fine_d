#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

ensure_brew_package() {
  package_name="$1"
  if brew list "$package_name" >/dev/null 2>&1; then
    printf '[skip] %s already installed\n' "$package_name"
    return
  fi
  brew install "$package_name"
}

printf 'FineReport local install (macOS)\n'
printf 'Repository root: %s\n' "$ROOT_DIR"

command -v brew >/dev/null 2>&1 || {
  printf '[fail] Homebrew is required before running this skeleton installer.\n' >&2
  exit 1
}

ensure_brew_package python
ensure_brew_package node
ensure_brew_package uv
ensure_brew_package pnpm

cd "$ROOT_DIR"
python3 -m venv .venv
uv sync --extra dev
pnpm install
pnpm --dir apps/web install
mkdir -p workspace generated .local/state logs

printf '[ok] python/node installed and repository dependencies prepared.\n'
