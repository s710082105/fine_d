---
name: fr-browser-review
description: Use when a synced FineReport change must be opened in browser and checked against the expected data and layout, especially when preview URLs, login flow, and browser evidence should follow a fixed FineReport review routine instead of rediscovering the page each time.
---

# FineReport 浏览器复核

## Overview

Use this skill to run the last browser-review step with a fixed FineReport routine. It assumes the page will be driven by the repo-local `.codex/skills/chrome-devtools/` skill, which wraps the official `ChromeDevTools/chrome-devtools-mcp` server, and that login, page open, and review targets come from project config plus the current task context.

## Browser Skill

Preferred browser skill:

- `chrome-devtools`
- Path: `.codex/skills/chrome-devtools/`
- Official MCP server: `ChromeDevTools/chrome-devtools-mcp`
- Canonical setup: `.codex/skills/chrome-devtools/references/setup-and-tools.md`

Do not switch to another browser skill unless the user explicitly asks.

## Inputs

- Upload verify evidence
- `.codex/fr-config.json`
- Preview URL, or a `reportlets/...` path that can derive one
- Optional report path such as `reportlets/demo/report.cpt`
- Query, parameter, data, or layout expectations

## Execution

1. Generate fixed review context first:

- macOS / Linux: `python3 .codex/skills/fr-browser-review/scripts/run.py --config-path .codex/fr-config.json --url <预览地址> --report-path reportlets/<目标文件> --expectation "<复核重点>" --queried`
- Windows: `py .codex\\skills\\fr-browser-review\\scripts\\run.py --config-path .codex\\fr-config.json --url <预览地址> --report-path reportlets\\<目标文件> --expectation "<复核重点>" --queried`

Preview URL rules:

- `.cpt`: `/webroot/decision/view/report?viewlet=<reportlets/之后的路径>`
- `.fvs`: `/webroot/decision/view/duchamp?page_number=1&viewlet=<reportlets/之后的路径>`
- If `--url` is omitted but `--config-path` and `--report-path` are present, the wrapper derives the canonical preview URL from these rules

2. Use `chrome-devtools` with this exact order:

- Open `decision_url` from `.codex/fr-config.json`
- If login form is visible, fill `username` and `password` from `.codex/fr-config.json`
- Submit login and wait until the login page disappears or the target preview page is reachable
- Open the provided preview URL directly
- Take a fresh snapshot after navigation
- Check the specific query result, table head, row data, and layout expectations from the task
- Capture final evidence

## Fixed Rules

- Login entry is always `decision_url` from `.codex/fr-config.json`
- Login credentials are always `username` and `password` from `.codex/fr-config.json`
- If the preview URL is already known, open it directly; do not re-analyze FineReport menus, trees, or homepage navigation
- If the target is a `.fvs`, always use the `view/duchamp?page_number=1&viewlet=...` route instead of `view/report`
- If the browser is already logged in, skip the login form and go straight to the preview URL
- If preview URL is missing but report path is known, derive it from the fixed route rules instead of reverse-engineering the page path from UI menus
- If the page redirects back to login, re-run the fixed login flow once, then retry the preview URL

See `references/browser-review-playbook.md` for the exact review routine.

## Example Index

- `EXAMPLES.md`
  - 先看这里，按“固定复核流程 / 最终证据模板”选入口
- `references/browser-review-playbook.md`
  - 需要确认登录顺序、预览 URL 推导、查询与截图顺序时看这个
- `references/review-template.md`
  - 需要整理最终浏览器证据时看这个

## Expected Evidence

- Preview URL
- Login entry and login account
- Target report path
- Review focus
- Whether the page opened
- Whether the query was executed
- Whether data and style match expectations
- Final screenshot or explicit browser observation when needed

## Failure Handling

- Stop if upload verification is missing
- Stop if `.codex/fr-config.json` is missing
- Stop if the `chrome-devtools` MCP server is unavailable
- Stop if preview cannot be opened
- Stop if login fails
- Do not report success without actual query evidence
- Do not spend time rediscovering FineReport navigation when a preview URL is already available

## Next Skill

- Workflow complete
