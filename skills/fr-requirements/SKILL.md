---
name: fr-requirements
description: Use when clarifying FineReport report scope, output path, data needs, and acceptance rules before touching files.
---

# FineReport 需求明确

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 要确认的内容

- 报表类型：`CPT` 还是 `FVS`
- 目标路径：落到哪个 `reportlets/...` 文件
- 是新建还是改已有模板
- 数据范围：连接名、表或已有数据集、筛选参数
- 验收口径：列名、字段格式、样式要求、浏览器预期

## 输出格式

向用户输出一个精简结论块：

```markdown
## 任务摘要
- 报表类型：
- 目标文件：
- 数据来源：
- 是否需要先拉远端模板：
- 验收标准：
```

## 结束条件

- 以上五项都明确后，再切到 `fr-status-check`
- 如果字段或连接不确定，不要猜，后续转 `fr-db`
