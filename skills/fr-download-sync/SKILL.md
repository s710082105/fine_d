---
name: fr-download-sync
description: Use when a remote reportlet must be pulled into the local reportlets directory before comparison or editing.
---

# FineReport 下载同步

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 执行命令

```bash
# macOS / Linux
./.codex/fr-sync.sh pull_remote_file reportlets/<目标文件>

# Windows
.\.codex\fr-sync.cmd pull_remote_file reportlets\<目标文件>
```

## 要求

- 目标路径必须位于 `reportlets/` 内
- 拉取后先确认本地文件已经出现，再开始改动
- 如果需要多个参考文件，逐个拉取，不要跳过结果确认

## 下一步

- 拉取成功后，切到 `fr-template-write`
- 如果需要先查字段或 SQL，再切到 `fr-db`
