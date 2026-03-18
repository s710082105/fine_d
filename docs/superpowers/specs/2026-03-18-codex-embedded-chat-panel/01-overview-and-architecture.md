# 总览与架构

## 目标

`finereport-ai` 不是“把 Codex 临时接入某个项目”，而是把 FineReport 开发所需的样式、目录、同步和 AI 上下文统一收敛到桌面软件内管理。

## 方案对比

### 方案 A：Rust 直接拉起 `Codex CLI` + 运行时工作区注入

软件内置 `AGENTS.md` 和 `skills`，用户选择项目后，Rust 在应用数据目录中按项目和会话生成运行时上下文，再启动或复用本机 `Codex CLI`。右侧聊天面板只与 Rust 通信。

### 方案 B：Rust 直接拉起 `Codex CLI` + 纯 Prompt 注入

不生成运行时上下文目录，每次启动会话时把目录映射、样式配置和规则直接拼入启动参数或首条上下文。

### 方案 C：本地常驻代理服务 + `Codex CLI` 适配层

软件启动本地 daemon，由 daemon 负责会话池、上下文生成和 CLI 调度，前端与 Rust 通过该服务访问 Codex。

## 推荐方案

采用方案 A，原因如下：

- 最符合当前约束：聊天面板、本机 `Codex CLI`、软件内置规则资产。
- 运行时上下文可审计、可复现，便于调试和回放。
- 不依赖额外常驻服务，首版落地成本最低。
- 不把规则资产散落到每个项目目录中。

## 模块边界

### UI 层

- 左侧配置面板负责录入样式、目录、同步和 AI 配置。
- 右侧聊天面板负责展示消息、状态、工具事件和错误。
- 不直接调用 `Codex CLI` 或操作本地文件。
- 所有动作通过 Tauri command 发给 Rust。

建议前端核心组件：

- `ConfigPanel`
- `ChatPanel`
- `SessionSidebar`

### App/Core 层

Rust 业务层负责：

- 项目配置读写和校验。
- 会话创建、恢复、终止。
- 运行时上下文生成。
- 启动和监控 `Codex CLI` 子进程。
- 转换 stdout/stderr 为前端事件流。
- 归档 transcript、日志和元数据。

建议拆分服务：

- `project_config_service`
- `context_builder`
- `codex_process_manager`
- `session_store`
- `event_bridge`

### Embedded Assets 层

软件内置资源，不归属于业务项目：

```text
embedded/
├── agents/
│   └── base/AGENTS.md
├── skills/
│   ├── finereport-template/
│   ├── browser-validate/
│   └── sync-publish/
└── templates/
    ├── project-context.md.hbs
    ├── project-rules.md.hbs
    └── mappings.json.hbs
```

### Runtime Workspace 层

运行时工作区位于软件数据目录，不写入真实项目根目录：

```text
~/.finereport-ai/
├── projects/
│   └── <project-id>/
│       ├── config.json
│       ├── sessions/
│       │   └── <session-id>/
│       │       ├── transcript.jsonl
│       │       ├── context/
│       │       │   ├── AGENTS.md
│       │       │   ├── project-context.md
│       │       │   ├── project-rules.md
│       │       │   ├── mappings.json
│       │       │   └── skills/
│       │       └── logs/
│       └── cache/
└── global/
    ├── app-settings.json
    └── embedded-version.json
```

## 边界原则

- 真实项目目录只保存业务文件。
- 软件内置目录只保存规则模板。
- 会话目录保存实例化后的上下文和审计数据。
