---
name: fr-create
description: Use when a new FineReport CPT or FVS file must be created, when same-name collisions must be checked before writing, or when a template must be selected before local editing begins.
---

# FineReport 新建

## Overview

Use this skill to prepare a new target reportlet safely. It checks conflicts, chooses the right template, and creates the starting file.

## Inputs

- Target `reportlets/...` path
- Target file type: `.cpt` or `.fvs`
- Chosen template source

## Execution

- macOS / Linux: `python3 .codex/skills/fr-create/scripts/run.py reportlets/<目标文件>`
- Windows: `py .codex\\skills\\fr-create\\scripts\\run.py reportlets\\<目标文件>`

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“建空白模板 / 建完后继续改 CPT/FVS”选入口
- `references/create-flow.md`
  - 需要确认冲突检查、模板选择、创建顺序时看这个

## Expected Evidence

- Target path
- Conflict or non-conflict result
- Chosen template name
- Created local file path

## Failure Handling

- Reject non-`reportlets/` targets
- Stop on same-name conflict unless user explicitly changes target
- Do not create files from guessed extensions

## Next Skill

- `fr-cpt`
- `fr-fvs`
