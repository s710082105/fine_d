---
name: fr-fvs
description: Use when editing FineReport `.fvs` files after datasource, target path, and creation or pull prerequisites are clear. Trigger for FVS tree structure, view definitions, and grouping or aggregation changes.
---

# FineReport FVS 编辑

## Overview

Use this skill for local `.fvs` editing after the project config and datasource evidence are already confirmed.

## Inputs

- Confirmed local `.fvs` path
- Datasource or field evidence from `fr-db`
- Remote freshness evidence from `fr-download-sync` or `fr-create`

## Execution

- macOS / Linux: `python3 .codex/skills/fr-fvs/scripts/run.py reportlets/<目标文件>.fvs`
- Windows: `py .codex\\skills\\fr-fvs\\scripts\\run.py reportlets\\<目标文件>.fvs`

## Expected Evidence

- Edited FVS path
- Changed view or grouping sections
- Datasource linkage summary

## Failure Handling

- Do not guess datasource names or field names
- Stop if the target is not a `.fvs`
- Stop if remote freshness was not established

## Next Skill

- `fr-upload-sync`
