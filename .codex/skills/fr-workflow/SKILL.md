---
name: fr-workflow
description: Use when starting or resuming a FineReport task in this repository and deciding which FineReport workflow skill should run next. Trigger whenever the request involves reportlets, CPT or FVS editing, FineReport sync, datasource scans, browser preview review, or project initialization.
---

# FineReport Workflow Router

## Overview

Use this skill to choose the next FineReport skill and keep the task on the standard path. Treat it as the entrypoint for initialized and non-initialized FineReport work.

The process skills referenced by this workflow are expected to come from the repo-local bundle under `.codex/skills/superpowers/`, not from a system-level superpowers install.

## Inputs

- Current user request
- Existing `.codex/fr-config.json` state, if any
- Whether the task is new creation, local edit, sync, data scan, or preview review

## Execution

- If `.codex/fr-config.json` is missing or stale, route to `fr-init`
- If environment or remote state is unknown, route to `fr-status-check`
- If datasource, SQL, fields, or dataset XML are unknown, route to `fr-db`
- If a new reportlet must be created, route to `fr-create`
- If a `.cpt` file must be edited, route to `fr-cpt`
- If a `.fvs` file must be edited, route to `fr-fvs`
- If a remote file must be pulled first, route to `fr-download-sync`
- If local changes must be published, route to `fr-upload-sync`
- If synced output must be reviewed in browser, route to `fr-browser-review`

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“缺配置 / 探环境 / 改 CPT / 改 FVS / 预览复核”选入口
- `references/routing.md`
  - 只需要快速路由矩阵时直接看这个

## Expected Evidence

- State the chosen next skill
- State the reason in one sentence
- State which prerequisite is already satisfied and which is still missing

## Failure Handling

- Do not route to `fr-cpt` or `fr-fvs` when datasource or target path is still unknown
- Do not route directly to `fr-browser-review` before upload verification
- Do not route to deprecated `fr-requirements` or `fr-template-write`

## Next Skill

- `fr-init`
- `fr-status-check`
- `fr-db`
- `fr-create`
- `fr-cpt`
- `fr-fvs`
- `fr-download-sync`
- `fr-upload-sync`
- `fr-browser-review`
