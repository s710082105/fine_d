---
name: fr-status-check
description: Use when the current FineReport project configuration, Designer runtime, bridge package, Decision login, remote directory sample, or datasource availability must be checked before editing or syncing reportlets.
---

# FineReport 状态检查

## Overview

Use this skill to prove that the current project is runnable before touching reportlets. It checks local prerequisites and the minimal remote probe chain.

## Inputs

- `.codex/fr-config.json`
- Local FineReport Designer installation
- Current project workspace and remote root

## Execution

- macOS / Linux: `python3 .codex/skills/fr-status-check/scripts/run.py --config-path .codex/fr-config.json`
- Windows: `py .codex\\skills\\fr-status-check\\scripts\\run.py --config-path .codex\\fr-config.json`

## Expected Evidence

- OS and Python version
- Designer bundled Java path
- Bridge manifest or jar status
- Decision login result
- Connection list reachability
- Remote `reportlets` sample result

## Failure Handling

- Stop immediately if config is missing
- Stop immediately if Designer bundled Java is missing
- Stop immediately if Decision login fails
- Do not continue to template editing when remote probe fails

## Next Skill

- `fr-db`
- `fr-download-sync`
- `fr-create`
