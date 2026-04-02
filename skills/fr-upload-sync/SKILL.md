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

- macOS / Linux: `python3 skills/fr-upload-sync/scripts/run.py reportlets/<目标文件>`
- Windows: `py skills\\fr-upload-sync\\scripts\\run.py reportlets\\<目标文件>`

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
