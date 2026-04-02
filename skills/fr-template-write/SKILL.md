---
name: fr-template-write
description: Use when creating or editing local CPT or FVS files after requirements and remote status are clear.
---

# FineReport 模板编写

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 编写原则

- 所有改动只落在本地 `reportlets/` 内
- 先明确是新建还是基于拉取文件修改
- 不确定字段、SQL、参数命名时，先切到 `fr-db`
- 改完后要列出具体变更点，便于后续同步和浏览器复核

## 完成前自查

- 目标文件路径正确
- 报表类型与需求一致
- 数据源、字段、参数名没有凭空猜测
- 需要同步的本地文件已经保存

## 下一步

- 本地文件写完后，切到 `fr-upload-sync`
