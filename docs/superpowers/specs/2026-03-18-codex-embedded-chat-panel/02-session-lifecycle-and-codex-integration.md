# 会话生命周期与 Codex 集成

## 目标

右侧聊天面板不直接连接 `Codex`，而是统一走一条可复现的会话启动链路。

## 会话启动链路

1. 左侧配置保存到 `projects/<project-id>/config.json`。
2. 用户发送首条消息或点击新建会话。
3. Rust 创建 `session-id`、会话目录和日志目录。
4. `context_builder` 读取软件内置 agent、启用的 skills、项目配置和映射信息。
5. 生成运行时上下文文件：
   - `AGENTS.md`
   - `project-context.md`
   - `project-rules.md`
   - `mappings.json`
   - `skills/`
6. `codex_process_manager` 启动或恢复本机 `Codex CLI`。
7. `event_bridge` 将 CLI 输出转换为前端时间线事件。
8. `session_store` 持续保存 transcript、状态和日志。

## 注入原则

- 不把所有信息粗暴塞成一段超长 system prompt。
- 运行时上下文至少拆成：`AGENTS.md`、`project-context.md`、`project-rules.md`、`mappings.json`、`skills/`。
- `project-context.md` 面向 Codex 阅读，`mappings.json` 面向程序和校验器消费。

## 会话模式

- `draft session`：基于当前配置创建，用于正常开发与交互。
- `fresh session`：用户修改配置后显式创建，绑定新的 `config_version`。

旧会话默认只读，不静默替换上下文。

## 关键服务

- `project_config_service`：项目配置读写和校验。
- `context_builder`：基于 embedded 资源和当前项目配置生成会话上下文。
- `codex_process_manager`：启动、停止、监控 `Codex CLI`。
- `session_store`：保存 transcript、日志、状态和元数据。
- `event_bridge`：把 CLI 输出转换为前端可消费事件。

## 失败暴露

- 左侧配置变化后，前端必须显式提示“当前会话配置已过期”。
- 不允许旧会话静默吃到新配置。
- `Codex CLI` 错误、上下文生成错误、进程启动失败都要原样回流到 UI。
