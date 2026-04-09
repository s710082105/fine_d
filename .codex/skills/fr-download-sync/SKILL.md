---
name: fr-download-sync
description: Use when a remote reportlet must be pulled into the local project before comparison or editing. Trigger whenever the latest remote CPT or FVS content is required as the editing baseline.
---

# FineReport 下载同步

## Overview

Use this skill to pull the latest remote reportlet into the local workspace before editing. It prevents editing stale local copies.

## Inputs

- `.codex/fr-config.json`
- Target `reportlets/...` path

## Execution

- macOS / Linux: `python3 .codex/skills/fr-download-sync/scripts/run.py reportlets/<目标文件>`
- Windows: `py .codex\\skills\\fr-download-sync\\scripts\\run.py reportlets\\<目标文件>`

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“是否必须先拉远端 / 拉完后看 CPT 还是 FVS 示例”选入口
- `references/sync-rules.md`
  - 需要确认拉取前提、目标路径约束、最小证据时看这个

## Expected Evidence

- Remote target path
- Local output path
- Pull result or verify result

## Failure Handling

- Reject non-`reportlets/` targets
- Stop if remote read fails
- Stop if the pulled local file is missing after sync

## Next Skill

- `fr-cpt`
- `fr-fvs`
