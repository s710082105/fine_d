---
name: fr-upload-sync
description: Use when local reportlet changes must be pushed back to the remote FineReport runtime and verified.
---

# FineReport 上传同步

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 执行命令

单文件同步：

```bash
# macOS / Linux
./.codex/fr-sync.sh sync_file reportlets/<目标文件>

# Windows
.\.codex\fr-sync.cmd sync_file reportlets\<目标文件>
```

整项目同步：

```bash
# macOS / Linux
./.codex/fr-sync.sh publish_project

# Windows
.\.codex\fr-sync.cmd publish_project
```

## 要求

- 同步后必须看命令结果，不要把命令执行当作成功证据
- 如果远端状态校验失败，先停下，不要直接进入浏览器复核

## 下一步

- 同步成功后，切到 `fr-browser-review`
