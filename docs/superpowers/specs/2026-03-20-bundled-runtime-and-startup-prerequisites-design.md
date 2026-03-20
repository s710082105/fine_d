# Bundled Runtime And Startup Prerequisites Design

> 已被 [2026-03-20-system-runtime-installer-design.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-20-system-runtime-installer-design.md) 替代。当前产品不再以内置 `node/python/codex` 为正式方案。

## Goal

让软件内置 `node22 + codex + python3`，并在应用启动时统一检查运行时完整性与系统 `git`。只要存在阻断项，就不进入主界面。

## Scope

- 软件内置运行时资源解析
- 启动阻断页
- 统一预检命令与前端状态模型
- 终端启动命令切换为内置 `node + codex`
- `git` 外部依赖检查与平台安装指引
- Windows 兼容策略显式化

## Non-Goals

- 本轮不内置 `git`
- 本轮不实现 Windows 原生 `post-commit` hook
- 本轮不解决所有打包签名问题，只提供资源定位和运行时校验框架

## Architecture

### Startup Gate

应用启动后先调用 Rust 侧统一预检命令，返回结构化检查项列表。前端在检查完成前只显示 loading；若任一阻断项失败，只渲染阻断页，不渲染配置页和终端页。

### Bundled Runtime

按平台在 Tauri 资源目录提供：

- `runtime/<platform>/node/...`
- `runtime/<platform>/codex/...`
- `runtime/<platform>/python/...`

Rust 通过 `AppHandle.path().resource_dir()` 解析当前平台的资源目录，定位实际可执行入口。终端命令不再固定写死为系统 `codex`，而是改成“内置 node 执行内置 codex 入口脚本”。

### Prerequisite Model

每个检查项返回：

- `key`
- `label`
- `status`
- `blocking`
- `message`
- `fix_hint`

首批检查项：

- bundled `node`
- bundled `codex`
- bundled `python`
- system `git`
- platform sync support

### Windows Policy

Windows 侧继续支持 xterm + ConPTY、`CODEX_HOME` 路径解析和内置运行时启动。

当前仍不兼容的 Unix-only 同步链路必须显式暴露为阻断项，不能 silent fallback。

## Validation

- Rust：预检命令、运行时解析、平台策略、终端命令构造
- Frontend：启动阻断页、检查清单、主界面放行
- Build：`pnpm build`
