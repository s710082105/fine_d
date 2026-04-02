---
name: fr-init
description: Use when starting a FineReport project from natural language or when the current FineReport config is missing, incomplete, or stale. Trigger whenever designer path, Decision URL, credentials, workspace root, remote root, or task type must be collected and validated interactively.
---

# FineReport 初始化

## Overview

Use this skill to turn natural-language project setup into a validated `.codex` config set. It is the only standard entrypoint for missing or stale FineReport project configuration.

## Inputs

- User-provided natural-language project details
- Current repository path
- Existing `.codex/` files, if any

## Execution

- macOS / Linux: `python3 skills/fr-init/scripts/run.py --config-path .codex/fr-config.json`
- Windows: `py skills\\fr-init\\scripts\\run.py --config-path .codex\\fr-config.json`

## Expected Evidence

- Structured field confirmation
- Per-field validation result
- Retry list for invalid fields
- Generated `.codex/` file list

## Failure Handling

- Do not invent missing designer paths, remote roots, or credentials
- Re-ask only the invalid fields
- Stop if the user refuses to provide required project config

## Next Skill

- `fr-status-check`
