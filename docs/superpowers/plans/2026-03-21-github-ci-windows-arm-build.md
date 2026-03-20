# GitHub CI Windows ARM Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `finereport` 新增 GitHub 远程与 Windows ARM64 GitHub Actions 打包流水线。

**Architecture:** 保留现有 `origin` 不动，新增 `github` 远程承接 GitHub Actions。CI 只做单平台 `windows-11-arm` 构建并上传 artifact，不在首版中引入 release 与签名。

**Tech Stack:** Git, GitHub Actions, Node 22, pnpm, Rust stable, Tauri 2

---

### Task 1: 补充设计与执行文档

**Files:**
- Create: `docs/superpowers/specs/2026-03-21-github-ci-windows-arm-build-design.md`
- Create: `docs/superpowers/plans/2026-03-21-github-ci-windows-arm-build.md`

- [ ] **Step 1: 写入 GitHub CI 设计说明**

记录远程策略、runner 选择、artifact 策略与验证边界。

- [ ] **Step 2: 写入实现计划**

记录精确文件路径、workflow 步骤与校验方式。

### Task 2: 新增 GitHub 远程

**Files:**
- Modify: `.git/config`

- [ ] **Step 1: 检查当前远程**

Run: `git remote -v`
Expected: 仅存在 `origin`

- [ ] **Step 2: 增加 github 远程**

Run: `git remote add github git@github.com:s710082105/fine_d.git`
Expected: 命令成功退出

- [ ] **Step 3: 再次验证远程**

Run: `git remote -v`
Expected: 同时存在 `origin` 与 `github`

### Task 3: 新增 GitHub Actions workflow

**Files:**
- Create: `.github/workflows/windows-arm-build.yml`

- [ ] **Step 1: 写入 workflow_dispatch + main push 触发器**

确保可以手动触发，也可以通过推送 `main` 触发。

- [ ] **Step 2: 写入 Node、pnpm、Rust、缓存和测试步骤**

使用 `windows-11-arm` runner，执行 `pnpm install`、`pnpm test`、`cargo test`。

- [ ] **Step 3: 写入 Tauri ARM64 构建与 artifact 上传步骤**

上传 `src-tauri/target/aarch64-pc-windows-msvc/release/bundle/**`。

### Task 4: 本地静态校验

**Files:**
- Verify: `.github/workflows/windows-arm-build.yml`

- [ ] **Step 1: 读取 workflow 文件确认路径和命令**

Run: `sed -n '1,220p' .github/workflows/windows-arm-build.yml`
Expected: runner、target、artifact path 全部正确

- [ ] **Step 2: 检查 git 状态与远程**

Run: `git status --short && git remote -v`
Expected: 新文件存在且 `github` 远程已配置

- [ ] **Step 3: 记录实际构建验证边界**

说明 GitHub Actions 首次运行才是最终构建验证。
