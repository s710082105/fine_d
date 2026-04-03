# Browser Review Playbook

## Chosen Browser Skill

- Skill: `chrome-devtools`
- Path: `.codex/skills/chrome-devtools/`
- Official MCP server: `ChromeDevTools/chrome-devtools-mcp`
- Setup: `.codex/skills/chrome-devtools/references/setup-and-tools.md`

## FineReport Fixed Review Flow

1. Read `.codex/fr-config.json`
2. Confirm the `chrome-devtools` MCP server is available
3. Take these values as fixed inputs:
- `decision_url`
- `username`
- `password`
- `report_path` when available
4. Resolve the preview URL with fixed rules:
- `.cpt` -> `/webroot/decision/view/report?viewlet=<reportlets/之后的路径>`
- `.fvs` -> `/webroot/decision/view/duchamp?page_number=1&viewlet=<reportlets/之后的路径>`
- if a preview URL was provided explicitly, use it directly
- if only `report_path` is available, derive the preview URL from the rules above
5. Open `decision_url`
6. If a login form is visible:
- fill username
- fill password
- click login
- wait until the page is no longer the login page
7. Open the resolved preview URL directly
8. Take a fresh snapshot
9. Verify only the task-specific targets:
- query executed or not
- table head
- row count or sample row
- layout or style expectation
10. Output evidence with `review-template.md`

## Do Not Do

- Do not rediscover navigation menus when the preview URL is already known
- Do not open `.fvs` with `view/report`; use `view/duchamp?page_number=1&viewlet=...`
- Do not continue if the `chrome-devtools` MCP server is unavailable
- Do not inspect unrelated homepage cards, menus, or directory trees
- Do not claim success from page open alone
- Do not hide login failure, redirect loops, or empty-query pages
