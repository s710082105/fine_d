---
name: fr-cpt
description: Use when editing FineReport `.cpt` files after the datasource, target path, and creation or pull prerequisites are clear. Trigger for CPT layout, dataset XML, parameters, table headers, and cell-level report edits.
---

# FineReport CPT 编辑

## Overview

Use this skill for local `.cpt` editing only after datasource evidence is ready. It covers dataset XML, parameters, table layout, and report cell changes.

## Inputs

- Confirmed local `.cpt` path
- Datasource or field evidence from `fr-db`
- Remote freshness evidence from `fr-download-sync` or `fr-create`

## Execution

- macOS / Linux: `python3 .codex/skills/fr-cpt/scripts/run.py reportlets/<目标文件>.cpt`
- Windows: `py .codex\\skills\\fr-cpt\\scripts\\run.py reportlets\\<目标文件>.cpt`

## Expected Evidence

- Edited CPT path
- Changed sections or XML blocks
- Datasource linkage summary

## Failure Handling

- Do not guess datasource names or field names
- Stop if the target is not a `.cpt`
- Stop if remote freshness was not established

## Next Skill

- `fr-upload-sync`
