# Project-local Skills

当前仓库把 FineReport skill 依赖直接 vendoring 到项目内，避免运行时依赖系统级 `~/.codex/skills` 或 `~/.agents/skills`。

## Bundled Sources

- `chrome-devtools/`
  - Source: `https://github.com/ChromeDevTools/chrome-devtools-mcp`
  - Role: repo-local browser-operation skill wrapper for the official MCP server
- `superpowers/`
  - Source: `https://github.com/obra/superpowers/tree/main/skills`
  - Synced from local clone: `eafe962b18f6c5dc70fb7c8cc7e83e61f4cdde06`
- `skill-creator/`
  - Source: `https://github.com/anthropics/skills/tree/main/skills/skill-creator`
  - Synced from local installed copy under `~/.codex/skills/.system/skill-creator`

## Usage

- FineReport 过程 skill 约束从 `.codex/skills/superpowers/` 读取。
- Skill 骨架创建和校验从 `.codex/skills/skill-creator/scripts/` 读取。
- FineReport 业务 skill 直接安装在 `.codex/skills/fr-*/` 下，clone 后即可被 Codex 发现。
- 仓库只保留 `.codex/skills/` 作为实际 skill 根目录。
- 浏览器复核默认使用本地 `chrome-devtools/` skill；真正的浏览器能力仍来自官方 `chrome-devtools-mcp` MCP server。
