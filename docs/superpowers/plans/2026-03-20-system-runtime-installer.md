# System Runtime Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将系统从 bundled runtime 启动切换为“检测系统环境 + 展示手动安装脚本”，并提供 `macOS/Windows` 的一键安装脚本与国内源选择。

**Architecture:** Rust 侧启动预检改为检查系统 `git/node/python/codex` 与同步 shell 能力，并返回脚本路径与版本信息。前端阻断页展示缺失项和手动安装说明；终端启动改回系统 `codex`。仓库新增 `macOS/Windows` 安装脚本，废弃 bundled runtime 准备脚本与相关文档表述。

**Tech Stack:** Tauri 2, Rust, React 18, TypeScript, Vitest, Cargo tests, shell script, PowerShell

---

### Task 1: 重写启动预检的数据模型与 Rust 检查逻辑

**Files:**
- Modify: `src-tauri/src/commands/environment.rs`
- Modify: `src-tauri/tests/runtime_prerequisites.rs`
- Modify: `src/lib/types/environment.ts`

- [ ] Step 1: 写失败测试，断言缺少系统 `node/python/codex` 时返回阻断，并包含脚本路径与版本字段。
- [ ] Step 2: 运行 `cargo test --manifest-path src-tauri/Cargo.toml runtime_prerequisites -- --nocapture` 确认失败。
- [ ] Step 3: 实现系统命令检查，移除 bundled runtime 目录依赖，补 `detectedVersion` 与 `scriptPath` 字段。
- [ ] Step 4: 重新运行 `cargo test --manifest-path src-tauri/Cargo.toml runtime_prerequisites -- --nocapture` 确认通过。

### Task 2: 切换终端启动为系统 codex

**Files:**
- Modify: `src-tauri/src/commands/terminal.rs`
- Modify: `src-tauri/src/commands/terminal/tests.rs`

- [ ] Step 1: 写失败测试，断言终端默认命令改为系统 `codex`，不再拼 bundled `node + cli.js`。
- [ ] Step 2: 运行 `cargo test --manifest-path src-tauri/Cargo.toml terminal_commands -- --nocapture` 确认失败。
- [ ] Step 3: 删除 bundled runtime 启动路径，改为系统 `codex` + 固定运行时参数注入。
- [ ] Step 4: 重新运行 `cargo test --manifest-path src-tauri/Cargo.toml terminal_commands -- --nocapture` 确认通过。

### Task 3: 更新前端阻断页与环境类型

**Files:**
- Modify: `src/components/startup/startup-gate.tsx`
- Modify: `src/test/app-shell.test.tsx`

- [ ] Step 1: 写失败测试，断言阻断页显示“基础环境未安装完成”、安装脚本路径和手动执行说明。
- [ ] Step 2: 运行 `pnpm test src/test/app-shell.test.tsx --reporter verbose` 确认失败。
- [ ] Step 3: 实现新的阻断页文案与字段展示，保留“重新检查”入口。
- [ ] Step 4: 重新运行 `pnpm test src/test/app-shell.test.tsx --reporter verbose` 确认通过。

### Task 4: 新增 macOS 和 Windows 安装脚本

**Files:**
- Create: `scripts/install-runtime-macos.sh`
- Create: `scripts/install-runtime-windows.ps1`
- Create: `scripts/install-runtime-windows.cmd`
- Modify: `package.json`

- [ ] Step 1: 创建 `macOS` 安装脚本，支持选择官方源 / 国内源，并安装 `git/node/python/codex`。
- [ ] Step 2: 创建 `Windows` 安装脚本，支持选择官方源 / 国内源，并通过 `winget` 安装 `git/node/python/codex`。
- [ ] Step 3: 在 `package.json` 中删除 bundled runtime 脚本入口，保留或新增脚本说明相关命令。
- [ ] Step 4: 手动执行脚本语法检查：
  - `bash -n scripts/install-runtime-macos.sh`
  - `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/install-runtime-windows.ps1 -WhatIf` 或最小语法验证
  - Windows 用户默认执行 `scripts/install-runtime-windows.cmd`

### Task 5: 清理 bundled runtime 残留并更新文档

**Files:**
- Delete: `scripts/prepare-bundled-runtime.mjs`
- Modify: `README.md`
- Modify: `src-tauri/resources/runtime/README.md`
- Modify: `docs/superpowers/specs/2026-03-20-bundled-runtime-and-startup-prerequisites-design.md`

- [ ] Step 1: 删除 bundled runtime 准备脚本，并移除 README 中“软件内置 runtime”的主流程表述。
- [ ] Step 2: 将 `src-tauri/resources/runtime/README.md` 改成历史说明或废弃说明，避免继续误导。
- [ ] Step 3: 在旧 bundled runtime spec 中标记已被 system installer 方案替代。
- [ ] Step 4: 运行 `rg -n "runtime:prepare|bundled runtime|软件内置 Node 22|software bundled" README.md docs src-tauri/resources scripts package.json` 检查残留表述。

### Task 6: 全量验证

**Files:**
- Verify only

- [ ] Step 1: 运行 `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`。
- [ ] Step 2: 运行 `pnpm test`。
- [ ] Step 3: 运行 `pnpm build`。
- [ ] Step 4: 记录无法在当前机器上完成的验证项，例如 Windows 脚本实际执行。
