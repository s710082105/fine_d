# Designer Remote Data And Cross Platform Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 废弃本地 `data_connections`，切到设计器远程数据为唯一数据源，并让同步/数据 helper 在 macOS 与 Windows 上都可直接执行。

**Architecture:** Rust 新增 Decision HTTP 客户端与 CLI 入口，项目初始化生成平台感知 helper。前端配置页改成只读远端连接展示，context/skill/AGENTS 改成基于设计器远程数据工作流。

**Tech Stack:** Rust + Tauri commands, React + Ant Design, FineReport Decision HTTP API, platform-specific shell helpers

---

### Task 1: 配置模型去除 data_connections

**Files:**
- Modify: `src-tauri/src/domain/project_config.rs`
- Modify: `src-tauri/src/commands/project_config.rs`
- Modify: `src-tauri/src/domain/context_builder.rs`
- Modify: `src-tauri/src/domain/context_builder_data.rs`
- Modify: `src/lib/types/project-config.ts`
- Modify: `src/components/config/project-config-state-helpers.ts`
- Test: `src-tauri/tests/project_config_roundtrip.rs`
- Test: `src-tauri/tests/context_builder_generates_sync_rules.rs`

- [ ] Step 1: 写 Rust/TS 测试，断言配置 roundtrip 与 context 不再包含 `data_connections`
- [ ] Step 2: 运行相关测试，确认按旧实现失败
- [ ] Step 3: 删除模型字段和 legacy 迁移逻辑，更新模板数据注入
- [ ] Step 4: 重跑相关测试直到通过

### Task 2: 设计器远程数据客户端与 CLI

**Files:**
- Create: `src-tauri/src/domain/fine_decision_client.rs`
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/commands/project_config.rs`
- Create: `src-tauri/tests/fine_decision_client.rs`

- [ ] Step 1: 写客户端测试，覆盖登录、连接列表、数据集列表、现有数据集预览与 SQL 预览
- [ ] Step 2: 运行测试，确认缺少客户端实现而失败
- [ ] Step 3: 实现 HTTP 客户端、Tauri commands 和 CLI flag
- [ ] Step 4: 重新运行对应 Rust 测试

### Task 3: 前端数据连接页改成只读远端连接

**Files:**
- Modify: `src/components/config/project-config-services.ts`
- Modify: `src/components/config/project-config-state.ts`
- Modify: `src/components/config/project-config-form.tsx`
- Modify: `src/components/config/project-config-extra-fields.tsx`
- Test: `src/test/project-config-form.test.tsx`
- Test: `src/test/project-config-services.test.ts`

- [ ] Step 1: 写前端测试，断言页签只读展示远端连接并可刷新
- [ ] Step 2: 运行 Vitest，确认旧 CRUD 流程断言失败
- [ ] Step 3: 删除本地连接 CRUD/test service，接入远端连接读取
- [ ] Step 4: 重跑前端测试直到通过

### Task 4: 平台感知同步与数据 helper

**Files:**
- Modify: `src-tauri/src/domain/project_initializer.rs`
- Modify: `src-tauri/src/domain/project_git.rs`
- Modify: `embedded/templates/post-commit-sync.sh.hbs`
- Modify: `src-tauri/tests/project_initializer_local.rs`
- Modify: `src-tauri/tests/project_git_sync.rs`

- [ ] Step 1: 写测试，断言生成 `.sh`/`.cmd` helper，且 hook 只在支持环境启用
- [ ] Step 2: 运行测试，确认旧实现失败
- [ ] Step 3: 实现 helper 生成与 hook 安装策略调整
- [ ] Step 4: 重跑 Rust 测试直到通过

### Task 5: Skill、AGENTS 与模板更新

**Files:**
- Modify: `embedded/skills/fr-db/SKILL.md`
- Modify: `embedded/skills/fr-create/SKILL.md`
- Modify: `embedded/skills/fr-cpt/SKILL.md`
- Modify: `embedded/skills/fr-fvs/SKILL.md`
- Modify: `embedded/agents/base/AGENTS.md`
- Modify: `embedded/templates/project-context.md.hbs`
- Modify: `embedded/templates/project-rules.md.hbs`
- Modify: `embedded/templates/mappings.json.hbs`
- Modify: `AGENTS.md`

- [ ] Step 1: 更新文档与模板，明确先扫字段、再设计，命令按系统类型选择
- [ ] Step 2: 校对 helper 名称、CLI 命令和运行结果描述
- [ ] Step 3: 运行最小构建/测试，确认文档中引用路径与行为一致

### Task 6: 最终验证

**Files:**
- Verify only

- [ ] Step 1: 运行 Rust 目标测试集
- [ ] Step 2: 运行 Vitest 目标测试集
- [ ] Step 3: 运行前端 build 与必要的格式检查
- [ ] Step 4: 如环境允许，使用 `http://192.168.0.99:8075/` 做一次真实连接/数据集读取验证
