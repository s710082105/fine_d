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

- macOS / Linux: `python3 skills/fr-download-sync/scripts/run.py reportlets/<目标文件>`
- Windows: `py skills\\fr-download-sync\\scripts\\run.py reportlets\\<目标文件>`

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
