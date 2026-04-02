---
name: fr-workflow
description: Use when starting a FineReport task inside an initialized project and deciding which workflow skill to invoke next.
---

# FineReport Workflow Router

## 先读这些文件

- `../../project-context.md`
- `../../project-rules.md`
- `../../workflow-overview.md`

## 路由规则

- 需求还不清楚：使用 `fr-requirements`
- 需要确认远端状态、目录样本、连接摘要：使用 `fr-status-check`
- 需要把远端文件拉到本地：使用 `fr-download-sync`
- 需要本地编写或修改 CPT/FVS：使用 `fr-template-write`
- 需要字段扫描、SQL 试跑或数据集 XML：使用 `fr-db`
- 需要把本地改动推回远端：使用 `fr-upload-sync`
- 需要在浏览器里复核查询结果、数据和样式：使用 `fr-browser-review`

## 硬约束

- 主流程默认顺序：`fr-requirements` -> `fr-status-check` -> `fr-download-sync` -> `fr-template-write` -> `fr-upload-sync` -> `fr-browser-review`
- 如果当前任务只涉及其中一段，只跳过已完成且有证据的步骤
- 没有上传同步和浏览器复核证据前，不要宣称交付完成
