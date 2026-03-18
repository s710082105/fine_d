# Codex 内嵌聊天面板设计索引

## 背景

本设计面向 `finereport-ai` 的桌面化平台目标：左侧统一管理 FineReport 样式、目录、同步和 AI 配置，右侧以内嵌聊天面板方式承载 `Codex` 交互。已确认约束如下：

- 右侧使用聊天面板，不做纯终端面板。
- 底层优先接入本机 `Codex CLI`。
- 会话全局管理，但底层按项目隔离存储。
- `AGENTS.md` 与 `skills` 由软件统一内置，不要求每个项目自带一套。

## 设计拆分

1. [01-overview-and-architecture.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-18-codex-embedded-chat-panel/01-overview-and-architecture.md)
说明：总体方案选择、模块边界和目录结构。

2. [02-session-lifecycle-and-codex-integration.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-18-codex-embedded-chat-panel/02-session-lifecycle-and-codex-integration.md)
说明：会话创建链路、运行时上下文生成、`Codex CLI` 注入方式。

3. [03-configuration-model.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-18-codex-embedded-chat-panel/03-configuration-model.md)
说明：左侧配置模型、字段分层和版本规则。

4. [04-chat-panel-ui.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-18-codex-embedded-chat-panel/04-chat-panel-ui.md)
说明：右侧聊天面板布局、事件类型和前端状态模型。

5. [05-agent-skill-loading.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-18-codex-embedded-chat-panel/05-agent-skill-loading.md)
说明：软件内置 `AGENTS.md` 与 `skills` 的装载、版本和运行时实例化机制。

## 结论

推荐方案保持不变：采用 `Rust/Tauri + 本机 Codex CLI + 运行时工作区注入`。软件集中管理规则模板，会话创建时按项目配置生成运行时上下文，真实项目目录保持干净。
