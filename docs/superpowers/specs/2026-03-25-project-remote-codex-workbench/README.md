# 项目目录、远程概览与 Codex 终端工作台设计

## 文档索引

1. [01-overview-and-phasing.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/01-overview-and-phasing.md)
2. [02-project-and-remote-overview.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/02-project-and-remote-overview.md)
3. [03-codex-terminal-page.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/03-codex-terminal-page.md)
4. [04-api-and-state-model.md](/Users/wj/data/mcp/finereport/docs/superpowers/specs/2026-03-25-project-remote-codex-workbench/04-api-and-state-model.md)

## 目标

在当前 `Python + Vue` 本地主链路上，补齐一条真正可操作的工作台路径：

- 选择本机项目目录
- 维护该项目绑定的远程 FineReport 参数
- 在同一页面查看远程目录和远程数据连接
- 在独立页面直接嵌入 Codex 终端，而不是自研聊天 UI

## 范围边界

本轮只覆盖三块：

- 项目目录选择与远程参数配置
- 远程概览页
- Codex 终端页首版

本轮不覆盖：

- 多项目列表管理
- 多远程 profile 切换
- Codex 自定义消息协议
- 页面内模拟终端或聊天气泡
