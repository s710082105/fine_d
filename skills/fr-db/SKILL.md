---
name: fr-db
description: Use when FineReport datasets, SQL, field scans, or connection verification are needed for template work.
---

# FineReport 数据探测

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 宿主工具协议

- 涉及连接列表、字段扫描、SQL 试跑时，不要自行臆造连接名或结果
- 必须输出单独一行宿主工具请求，等待结果后再继续

```text
@@FR_TOOL {"id":"req_list_connections","name":"fr.list_connections","args":{}}
@@FR_TOOL {"id":"req_preview_sql","name":"fr.preview_sql","args":{"connection_name":"FRDemo","sql":"select 1 as ok"}}
```

## 输出要求

- 连接名摘要
- 字段扫描或 SQL 试跑结果
- 可直接写入模板的数据集 XML 片段
- 对模板编写的影响说明

## 下一步

- SQL、字段和参数明确后，回到 `fr-template-write`
