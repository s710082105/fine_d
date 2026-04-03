---
name: chrome-devtools
description: Use when browser automation, page snapshots, screenshots, form input, console or network inspection, or FineReport preview review in this repository should run through Chrome DevTools MCP instead of ad-hoc browser exploration.
---

# Chrome DevTools

## Overview

This repo-local skill is the canonical browser-operation wrapper for this repository. It exists to prevent missing-skill failures and to keep browser work pinned to the official `ChromeDevTools/chrome-devtools-mcp` server with one consistent setup and usage pattern.

## When to Use

Use this skill when the task needs any of these:

- Open a known page URL and capture a fresh page snapshot
- Fill login forms or query forms in the browser
- Take screenshots as evidence
- Inspect console messages or network requests
- Debug page rendering or frontend request failures
- Drive FineReport preview review before or during `fr-browser-review`

Do not use this skill for FineReport-specific review routing or report assertions. That belongs to `.codex/skills/fr-browser-review`.

## Requirements

- MCP server name must be `chrome-devtools`
- Official backend is `chrome-devtools-mcp@latest`
- Node.js `20.19+`
- `npm`
- Google Chrome or Chrome for Testing

See `references/setup-and-tools.md` for the canonical Codex configuration and the Windows-specific config block.

## Execution

1. Confirm the `chrome-devtools` MCP server is actually available.
2. If the MCP server is missing, stop with an explicit error and report that browser review cannot continue.
3. If the target URL is already known, open it directly instead of rediscovering site navigation.
4. After every navigation or major interaction, take a fresh snapshot before deciding the next action.
5. Use explicit waits and observable page state, not guessed sleeps.
6. Capture screenshots, console output, or network evidence when the task requires proof.

## Preferred Tool Pattern

- Open page: `new_page` or `navigate_page`
- Read current state: `take_snapshot`
- Fill or click: `fill`, `fill_form`, `click`, `press_key`
- Wait for result: `wait_for`
- Collect evidence: `take_screenshot`, `list_console_messages`, `list_network_requests`, `get_network_request`

## Fixed Rules

- Do not switch to another browser stack unless the user explicitly asks.
- Do not claim the page was reviewed if the MCP server is unavailable.
- Do not hide login failure, redirect loops, blocked startup, or empty page states.
- Do not re-analyze menus or dashboards when the destination URL is already known.
- Prefer `fill_form` when multiple login fields are available in the same snapshot.

## FineReport Boundary

- General browser control belongs here.
- FineReport login entry, preview URL rules, and report-specific checks belong to `.codex/skills/fr-browser-review`.

## Resources

- `references/setup-and-tools.md`

## Next

- `.codex/skills/fr-browser-review`
