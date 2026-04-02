---
name: fr-status-check
description: Use when checking the current remote directory sample, connection summary, and reusable report assets before editing.
---

# FineReport 状态检查

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 执行命令

按当前系统执行项目 helper：

```bash
# macOS / Linux
./.codex/fr-status.sh

# Windows
.\.codex\fr-status.cmd
```

## 检查重点

- 当前项目路径和远端地址是否与任务一致
- 远端目录样本里是否已有同名或可复用模板
- 数据连接摘要里是否已有目标连接
- 当前上下文是否已经生成过 `.codex` 文件

## 输出要求

- 列出可复用模板或明确说明未发现
- 给出下一步判断：
  - 需要对照远端模板：切到 `fr-download-sync`
  - 已可直接本地编写：切到 `fr-template-write`
  - 需要先查字段或 SQL：切到 `fr-db`
