# Chrome DevTools MCP Setup

## Official Source

- Repository: `https://github.com/ChromeDevTools/chrome-devtools-mcp`
- MCP package: `chrome-devtools-mcp@latest`

## Requirements

- Node.js `20.19+`
- `npm`
- Google Chrome current stable, or Chrome for Testing

## Codex MCP Config

Use this standard server name and command:

```toml
[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest"]
```

## Windows 11 Codex Config

When running on Windows 11, use the official `cmd /c npx` form and include Chrome-related environment variables:

```toml
[mcp_servers.chrome-devtools]
command = "cmd"
args = ["/c", "npx", "-y", "chrome-devtools-mcp@latest"]
env = { SystemRoot="C:\\Windows", PROGRAMFILES="C:\\Program Files" }
startup_timeout_ms = 20_000
```

## High-signal Tools

- Navigation: `new_page`, `navigate_page`, `select_page`, `list_pages`, `wait_for`
- Input: `fill`, `fill_form`, `click`, `press_key`, `type_text`
- Evidence: `take_snapshot`, `take_screenshot`
- Debugging: `list_console_messages`, `get_console_message`
- Network: `list_network_requests`, `get_network_request`

## FineReport Usage Notes

- If the preview URL is already known, open it directly.
- Login entry should be the configured `decision_url`.
- For FineReport-specific review focus, switch to `.codex/skills/fr-browser-review` after the browser server is confirmed available.

## Failure Rules

- If `chrome-devtools` MCP server is missing, stop and surface the error.
- Do not fake screenshots, query results, or page-open status.
- Do not replace browser evidence with static assumptions.
