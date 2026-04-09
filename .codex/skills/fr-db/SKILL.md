---
name: fr-db
description: Use when FineReport datasource connections, SQL previews, field scans, or dataset XML snippets are needed before editing CPT or FVS files. Trigger whenever the request involves connection names, columns, parameters, or data validation.
---

# FineReport 数据探测

## Overview

Use this skill to turn remote datasource metadata into evidence for CPT or FVS editing. It is the only standard path for connection lookup and SQL preview.

## Inputs

- `.codex/fr-config.json`
- Confirmed target datasource or SQL question
- Remote Decision endpoint from current project config

## Execution

- macOS / Linux: `python3 .codex/skills/fr-db/scripts/run.py list-connections`
- Windows: `py .codex\\skills\\fr-db\\scripts\\run.py list-connections`

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“接口范围 / CPT 数据集 / FVS 数据集”选入口
- `references/decision-http.md`
  - 需要确认 Decision HTTP 接口边界或登录载荷时看这个

## Expected Evidence

- Connection list summary
- SQL preview or dataset preview result
- Field list or dataset XML snippet
- Impact statement for the next CPT/FVS edit

## Failure Handling

- Do not invent connection names
- Do not continue with guessed columns
- Surface HTTP errors directly instead of masking them

## Next Skill

- `fr-cpt`
- `fr-fvs`
