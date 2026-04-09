---
name: fr-upload-sync
description: Use when local FineReport reportlet changes must be pushed back to the remote runtime and verified before browser review. Trigger after CPT or FVS edits are complete and saved.
---

# FineReport 上传同步

## Overview

Use this skill to publish local reportlet changes and verify the remote state before preview review.

## Inputs

- `.codex/fr-config.json`
- Saved local CPT/FVS file under `reportlets/`
- Publish target path

## Execution

- macOS / Linux: `python3 .codex/skills/fr-upload-sync/scripts/run.py reportlets/<目标文件>`
- Windows: `py .codex\\skills\\fr-upload-sync\\scripts\\run.py reportlets\\<目标文件>`

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“上传验证 / 上传后浏览器复核”选入口
- `references/publish-rules.md`
  - 需要确认上传边界、远端校验和交接条件时看这个

## Expected Evidence

- Pushed path
- Remote verify result
- Any lock or conflict evidence if upload fails

## Failure Handling

- Reject non-`reportlets/` targets
- Stop on remote lock or verify mismatch
- Do not claim completion before verify evidence exists

## Next Skill

- `fr-browser-review`
