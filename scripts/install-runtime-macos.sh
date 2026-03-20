#!/bin/sh
set -eu

BREW_INSTALL_URL="https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh"
NPM_MIRROR_REGISTRY="https://registry.npmmirror.com"
BREW_GIT_REMOTE_MIRROR="https://mirrors.ustc.edu.cn/brew.git"
BREW_CORE_REMOTE_MIRROR="https://mirrors.ustc.edu.cn/homebrew-core.git"
BREW_BOTTLE_MIRROR="https://mirrors.ustc.edu.cn/homebrew-bottles"
BREW_API_MIRROR="https://mirrors.ustc.edu.cn/homebrew-bottles/api"

SOURCE_MODE="official"
NPM_REGISTRY=""

print_header() {
  cat <<'EOF'
FineReport Runtime Installer (macOS)

将安装以下组件：
- git
- node
- python3
- codex
EOF
}

select_source() {
  printf '\n请选择下载源：\n'
  printf '1. 官方源\n'
  printf '2. 国内源\n'
  printf '输入选项 [1/2]: '
  read -r choice
  case "$choice" in
    2)
      SOURCE_MODE="domestic"
      NPM_REGISTRY="$NPM_MIRROR_REGISTRY"
      ;;
    ""|1)
      SOURCE_MODE="official"
      ;;
    *)
      printf '无效选项：%s\n' "$choice" >&2
      exit 1
      ;;
  esac
}

run_homebrew_install() {
  if [ "$SOURCE_MODE" = "domestic" ]; then
    NONINTERACTIVE=1 \
    HOMEBREW_BREW_GIT_REMOTE="$BREW_GIT_REMOTE_MIRROR" \
    HOMEBREW_CORE_GIT_REMOTE="$BREW_CORE_REMOTE_MIRROR" \
    HOMEBREW_BOTTLE_DOMAIN="$BREW_BOTTLE_MIRROR" \
    HOMEBREW_API_DOMAIN="$BREW_API_MIRROR" \
      /bin/sh -c "$(curl -fsSL "$BREW_INSTALL_URL")"
    return
  fi
  NONINTERACTIVE=1 /bin/sh -c "$(curl -fsSL "$BREW_INSTALL_URL")"
}

ensure_brew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi
  printf '\n未检测到 Homebrew，开始安装。\n'
  run_homebrew_install
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    return
  fi
  if [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
    return
  fi
  printf 'Homebrew 安装后未能定位 brew 命令，请手动检查。\n' >&2
  exit 1
}

brew_install() {
  if [ "$SOURCE_MODE" = "domestic" ]; then
    HOMEBREW_BREW_GIT_REMOTE="$BREW_GIT_REMOTE_MIRROR" \
    HOMEBREW_CORE_GIT_REMOTE="$BREW_CORE_REMOTE_MIRROR" \
    HOMEBREW_BOTTLE_DOMAIN="$BREW_BOTTLE_MIRROR" \
    HOMEBREW_API_DOMAIN="$BREW_API_MIRROR" \
      brew install "$@"
    return
  fi
  brew install "$@"
}

install_core_packages() {
  printf '\n开始安装 git / node / python。\n'
  brew_install git node python
}

install_codex() {
  printf '\n开始安装 Codex。\n'
  if [ -n "$NPM_REGISTRY" ]; then
    NPM_CONFIG_REGISTRY="$NPM_REGISTRY" npm install -g @openai/codex
    return
  fi
  npm install -g @openai/codex
}

verify_command() {
  command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '[FAIL] %s 未安装成功\n' "$command_name"
    return 1
  fi
  version="$("$command_name" --version 2>&1 | head -n 1)"
  printf '[ OK ] %s -> %s\n' "$command_name" "$version"
}

verify_runtime() {
  printf '\n安装结果校验：\n'
  verify_command git
  verify_command node
  verify_command python3
  verify_command codex
}

print_source_summary() {
  printf '\n当前源配置：\n'
  if [ "$SOURCE_MODE" = "domestic" ]; then
    printf '- Homebrew: 国内镜像\n'
    printf '- npm registry: %s\n' "$NPM_REGISTRY"
    return
  fi
  printf '- Homebrew: 官方源\n'
  printf '- npm registry: 官方源\n'
}

main() {
  print_header
  select_source
  print_source_summary
  ensure_brew
  install_core_packages
  install_codex
  verify_runtime
}

main "$@"
