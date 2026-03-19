# Codex 单终端面板设计索引

## 背景

本设计替换现有右侧聊天面板，实现一个手动启动的单终端 Codex 面板。

已确认约束如下：

- 右侧整体替换为终端面板，不再保留消息输入框和流式聊天区。
- 终端形态为单终端，不做标签页，不做分屏。
- 用户点击“启动 Codex”后，终端直接在当前项目目录执行 `codex`。
- 终端会话按项目目录强绑定；切项目后旧终端失效，不做静默复用。
- 文件同步仍由系统侧完成，不依赖 skill，也不依赖终端内命令解析。

## 设计拆分

1. [01-overview-and-architecture.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-19-codex-terminal-panel/01-overview-and-architecture.md)
说明：总体方案、替换边界和技术选型。

2. [02-terminal-session-lifecycle.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-19-codex-terminal-panel/02-terminal-session-lifecycle.md)
说明：终端创建、输入、输出、关闭、项目切换和失败暴露。

3. [03-ui-and-state-model.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-19-codex-terminal-panel/03-ui-and-state-model.md)
说明：右侧 UI 结构、前端状态模型和操作规则。

4. [04-backend-modules-and-migration.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-19-codex-terminal-panel/04-backend-modules-and-migration.md)
说明：Rust 侧模块拆分、迁移步骤和验证范围。

## 结论

推荐方案为“左侧配置保持不变，右侧重构为 `xterm.js + PTY` 的单终端面板”。现有 `codex exec/start_session/send_session_message` 聊天链路不再作为右侧主交互模型，而是由新的终端子系统接管。
