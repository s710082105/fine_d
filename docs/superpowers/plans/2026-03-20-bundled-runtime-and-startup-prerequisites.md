# Bundled Runtime And Startup Prerequisites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 内置 `node22 + codex + python3`，并在应用启动时统一执行阻断式预检；`git` 缺失时直接拦截并展示安装指引。

**Architecture:** Rust 新增统一运行时解析与预检命令，前端在 `App` 入口增加启动阻断状态机。终端命令改为调用内置 `node + codex`，不再依赖系统全局 `codex`。Windows 不兼容链路通过显式预检项暴露，而不是隐式失败。

**Tech Stack:** Tauri 2, React 18, TypeScript, Rust, Vitest

---

### Task 1: 启动预检前端状态机

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/startup/startup-gate.tsx`
- Create: `src/lib/types/environment.ts`
- Test: `src/test/app-shell.test.tsx`

- [ ] Step 1: 写失败测试，覆盖检查中、阻断页、放行主界面三种状态
- [ ] Step 2: 运行 `pnpm test src/test/app-shell.test.tsx` 确认失败
- [ ] Step 3: 实现 `StartupGate` 组件和入口状态机
- [ ] Step 4: 重新运行 `pnpm test src/test/app-shell.test.tsx` 确认通过

### Task 2: Rust 统一预检命令

**Files:**
- Modify: `src-tauri/src/commands/environment.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/runtime_prerequisites.rs`

- [ ] Step 1: 写失败测试，覆盖 bundled runtime 缺失、git 缺失、Windows 同步阻断
- [ ] Step 2: 运行 `cargo test --manifest-path src-tauri/Cargo.toml --test runtime_prerequisites -- --nocapture` 确认失败
- [ ] Step 3: 实现统一预检命令与结果模型
- [ ] Step 4: 重新运行该测试确认通过

### Task 3: 内置运行时解析与终端启动

**Files:**
- Create: `src-tauri/src/domain/runtime_bundle.rs`
- Modify: `src-tauri/src/commands/terminal.rs`
- Modify: `src/components/terminal/terminal-services.ts`
- Test: `src-tauri/src/commands/terminal/tests.rs`
- Test: `src/test/terminal-panel.test.tsx`

- [ ] Step 1: 写失败测试，覆盖终端启动改用 bundled runtime
- [ ] Step 2: 运行对应前后端测试并确认失败
- [ ] Step 3: 实现 runtime resolver，并切换终端启动命令
- [ ] Step 4: 重新运行测试确认通过

### Task 4: 资源打包与构建验证

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`

- [ ] Step 1: 配置 Tauri 资源目录与平台约定
- [ ] Step 2: 补 README 中的打包说明与 git 安装指引
- [ ] Step 3: 运行 `pnpm build`
- [ ] Step 4: 运行 `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture`
- [ ] Step 5: 运行 `pnpm test`
