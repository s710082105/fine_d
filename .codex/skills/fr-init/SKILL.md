---
name: fr-init
description: Use when starting or reinitializing a FineReport project and `.codex/fr-config.json` is missing, incomplete, stale, or the user explicitly asks to regenerate the project config.
---

# FineReport 初始化

## Overview

Use this skill to collect explicit user input for FineReport project setup and turn it into a validated `.codex` config set. It is the only standard entrypoint for missing or stale FineReport project configuration.

## Conversation Mode

- Use natural-language dialogue to collect init information gradually.
- Do not dump a JSON template, code block, or field list and ask the user to fill it manually.
- Ask only one small group of related fields at a time.
- Do not ask the user to confirm after every answer or every round.
- Collect the needed inputs first, then present one final summary for confirmation.
- After all fields are confirmed, run `fr-init` to validate the supplied values.
- If validation fails, explain the failed fields and reasons in natural language, then re-ask only those fields.

## Precheck

- Check whether `.codex/fr-config.json` already exists.
- If it exists, ask the user: `发现已有 .codex/fr-config.json，是否重新生成？`
- If the user answers `否`, stop immediately and keep the existing config.
- If the user answers `是`, continue initialization and overwrite the init outputs.
- If `.codex/fr-config.json` does not exist, continue initialization directly.

## Required Fields

Collect these fields from the user explicitly. Do not infer them through local probing or remote investigation.

- `designer_root`
- `decision_url`
- `username`
- `password`
- `workspace_root`

See `references/init-fields.md` for field meaning, validation, and output rules.

## Derived Fields

These fields are not user-required during init:

- `project_name`
  - Derive from `workspace_root` directory name unless the user explicitly provides one.
- `remote_root`
  - Default to `reportlets` unless the user explicitly overrides it.
- `task_type`
  - Default to `未指定` unless the user explicitly provides one.

## Recommended Dialogue Order

- Round 1: `designer_root` and `workspace_root`
- Round 2: `decision_url`
- Round 3: `username` and `password`

Once all inputs are collected, present one final summary, including derived defaults, and ask for the last confirmation before running the validator.

## Execution

- macOS / Linux: `python3 .codex/skills/fr-init/scripts/run.py --config-path .codex/fr-config.json`
- Windows: `py .codex\\skills\\fr-init\\scripts\\run.py --config-path .codex\\fr-config.json`

## Init Rules

- `fr-init` only collects, echoes, validates, and writes initialization fields.
- Do not inspect local FineReport installation details beyond checking whether the user-provided path exists.
- Do not infer values from logs, local files, database metadata, remote directories, or existing reportlets.
- Do not log into Decision during init.
- Do not probe remote directories, connections, datasets, SQL, logs, or reportlets during init.
- Do not replace missing user input with guesses.
- If a field is invalid, explain why and ask only for the invalid field again.

## Expected Evidence

- Existing config check result
- User confirmation on whether regeneration is needed
- Final summary confirmation
- Structured field confirmation
- Per-field validation result
- Per-field validation reason
- Retry list for invalid fields
- Generated or updated init output list

## Follow-up

After all fields pass validation, continue with these outputs and next actions:

- Write or update `.codex/fr-config.json`
- Prepare or refresh the project init artifacts under `.codex/`
- Hand off environment probing to `fr-status-check`

Environment checks, Decision login, datasource probing, and remote `reportlets` checks belong to `fr-status-check`, not `fr-init`.

## Failure Handling

- Stop if the user declines regeneration of an existing config
- Stop if the user refuses to provide required fields
- Stop if required fields remain invalid after retry

## Next Skill

- `fr-status-check`
