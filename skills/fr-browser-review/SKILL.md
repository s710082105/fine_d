---
name: fr-browser-review
description: Use when a synced FineReport change must be opened in the browser and checked against the requirement summary.
---

# FineReport 浏览器复核

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 执行命令

```bash
# macOS / Linux
./.codex/fr-preview.sh

# Windows
.\.codex\fr-preview.cmd
```

## 复核要求

- 页面打开后，如有参数面板或查询按钮，先执行查询
- 必须确认页面出现实际数据结果，再检查列名、字段值、样式
- 对照需求摘要核对：文件是否对、数据是否对、样式是否对

## 汇报格式

```markdown
## 浏览器复核
- 预览地址：
- 是否成功打开：
- 是否执行查询：
- 数据是否符合预期：
- 样式是否符合预期：
```
