---
name: fr-browser-review
description: Use when a synced FineReport change must be opened in browser and checked against the expected data and layout. Trigger after upload verification succeeds and user-facing evidence is required.
---

# FineReport 浏览器复核

## Overview

Use this skill to open the synced report and capture the final user-facing evidence. It is the last step of the standard reportlet workflow.

## Inputs

- Upload verify evidence
- Preview URL or report path
- Query or parameter expectations

## Execution

- macOS / Linux: `python3 skills/fr-browser-review/scripts/run.py --url <预览地址>`
- Windows: `py skills\\fr-browser-review\\scripts\\run.py --url <预览地址>`

## Expected Evidence

- Preview URL
- Whether the page opened
- Whether the query was executed
- Whether data and style match expectations

## Failure Handling

- Stop if upload verification is missing
- Stop if preview cannot be opened
- Do not report success without actual query evidence

## Next Skill

- Workflow complete
