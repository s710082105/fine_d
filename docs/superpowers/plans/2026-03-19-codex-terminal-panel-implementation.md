# Codex Terminal Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-side chat panel with a single manually started Codex terminal panel backed by a real PTY session.

**Architecture:** Keep the left-side project configuration and sync pipeline intact. Replace the current message-oriented session flow with a terminal subsystem: `xterm.js` in React, PTY lifecycle and byte-stream transport in Rust, and explicit terminal commands over Tauri IPC. The terminal is bound to the current project directory and runs `codex` directly.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vitest, Testing Library, `cargo test`, `@xterm/xterm`, `@xterm/addon-fit`, `portable-pty`

---

## File Structure Map

- `package.json`: add frontend terminal dependencies.
- `src/lib/types/terminal.ts`: frontend terminal request/response/event types.
- `src/components/terminal/terminal-panel.tsx`: new right-side terminal container.
- `src/components/terminal/terminal-state.ts`: terminal state transitions and request builders.
- `src/components/terminal/terminal-services.ts`: Tauri IPC wrappers and event subscription.
- `src/components/terminal/xterm-adapter.ts`: `xterm.js` mount, input forwarding, and fit handling.
- `src/test/terminal-panel.test.tsx`: frontend tests for terminal panel behavior.
- `src/App.tsx`: swap `ChatPanel` for `TerminalPanel`.
- `src/test/app-shell.test.tsx`: update shell expectations.
- `src-tauri/Cargo.toml`: add `portable-pty`.
- `src-tauri/src/domain/terminal_manager.rs`: PTY session lifecycle and IO bridge.
- `src-tauri/src/domain/terminal_event_bridge.rs`: emit terminal output/status events.
- `src-tauri/src/commands/terminal.rs`: terminal Tauri commands.
- `src-tauri/src/domain/mod.rs`: register terminal domain modules.
- `src-tauri/src/commands/mod.rs`: register terminal commands module.
- `src-tauri/src/lib.rs`: expose terminal commands to Tauri.
- `src-tauri/tests/terminal_manager_lifecycle.rs`: Rust PTY lifecycle tests.
- `src-tauri/tests/terminal_commands.rs`: Rust command tests for create/write/close/resize.

### Task 1: Add Frontend Terminal Types and Static Panel Shell

**Files:**
- Modify: `package.json`
- Create: `src/lib/types/terminal.ts`
- Create: `src/components/terminal/terminal-panel.tsx`
- Create: `src/components/terminal/terminal-state.ts`
- Create: `src/test/terminal-panel.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/test/app-shell.test.tsx`

- [ ] **Step 1: Write the failing terminal panel test**
```tsx
it('renders terminal actions and idle hint', () => {
  render(<TerminalPanel projectId="default" projectName="demo" config={config} configVersion="v1" isConfigStale={false} />)
  expect(screen.getByRole('button', { name: '启动 Codex' })).toBeInTheDocument()
  expect(screen.getByText('等待手动启动 Codex')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/terminal-panel.test.tsx`

Expected: FAIL because `TerminalPanel` and terminal types do not exist yet.

- [ ] **Step 3: Add terminal type definitions**

Create `src/lib/types/terminal.ts` with:
- `TerminalStatus = 'idle' | 'starting' | 'running' | 'exited' | 'error'`
- `CreateTerminalSessionRequest`
- `CreateTerminalSessionResponse`
- `WriteTerminalInputRequest`
- `ResizeTerminalRequest`
- `CloseTerminalSessionRequest`
- `TerminalStreamEvent`

- [ ] **Step 4: Create the minimal terminal state helpers**

Create `src/components/terminal/terminal-state.ts` with:
- request builders based on the current project directory
- terminal status localization
- error-message extraction

- [ ] **Step 5: Create the static terminal panel**

Create `src/components/terminal/terminal-panel.tsx` with:
- status row
- idle placeholder
- action buttons: `启动 Codex` / `重启终端` / `关闭终端`
- no `xterm.js` yet, only a placeholder container

- [ ] **Step 6: Swap the app shell to the new panel**

Replace `ChatPanel` usage in `src/App.tsx` with `TerminalPanel`. Update `src/test/app-shell.test.tsx` to assert:
- `终端状态`
- `启动 Codex`
- no legacy composer expectation

- [ ] **Step 7: Run frontend tests**

Run: `pnpm vitest run src/test/terminal-panel.test.tsx src/test/app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add package.json src/lib/types/terminal.ts src/components/terminal/terminal-panel.tsx src/components/terminal/terminal-state.ts src/App.tsx src/test/terminal-panel.test.tsx src/test/app-shell.test.tsx
git commit -m "feat: add terminal panel shell"
```

### Task 2: Add Rust PTY Session Manager

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/domain/terminal_manager.rs`
- Create: `src-tauri/src/domain/terminal_event_bridge.rs`
- Modify: `src-tauri/src/domain/mod.rs`
- Create: `src-tauri/tests/terminal_manager_lifecycle.rs`

- [ ] **Step 1: Write the failing Rust lifecycle test**
```rust
#[test]
fn terminal_manager_starts_process_and_streams_output() {
    // create PTY session, run `sh -lc "printf started"`, assert running metadata and output event
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml terminal_manager_starts_process_and_streams_output`

Expected: FAIL because terminal manager and PTY dependencies are missing.

- [ ] **Step 3: Add PTY dependency**

Modify `src-tauri/Cargo.toml` to add `portable-pty = "0.8"` and only the minimal supporting std usage already present in the repo.

- [ ] **Step 4: Implement terminal event bridge**

Create `src-tauri/src/domain/terminal_event_bridge.rs` to emit:
- `started`
- `output`
- `exited`
- `error`

Keep the event payload focused on session id, message bytes converted to UTF-8 lossily, timestamp, and optional exit code.

- [ ] **Step 5: Implement terminal manager**

Create `src-tauri/src/domain/terminal_manager.rs` with:
- single-session metadata storage keyed by app terminal session id
- PTY spawn in project directory
- writer handle for future input
- background threads for output stream and exit watch
- explicit `close_session`
- explicit `resize_session`

- [ ] **Step 6: Run Rust lifecycle test**

Run: `cargo test --manifest-path src-tauri/Cargo.toml terminal_manager_starts_process_and_streams_output`

Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/Cargo.toml src-tauri/src/domain/terminal_manager.rs src-tauri/src/domain/terminal_event_bridge.rs src-tauri/src/domain/mod.rs src-tauri/tests/terminal_manager_lifecycle.rs
git commit -m "feat: add PTY terminal manager"
```

### Task 3: Expose Terminal Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/terminal.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/tests/terminal_commands.rs`

- [ ] **Step 1: Write the failing terminal command test**
```rust
#[test]
fn create_terminal_session_rejects_missing_project_dir() {
    // call command helper with empty dir and assert explicit error
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --manifest-path src-tauri/Cargo.toml create_terminal_session_rejects_missing_project_dir`

Expected: FAIL because command helpers do not exist yet.

- [ ] **Step 3: Implement terminal commands**

Create `src-tauri/src/commands/terminal.rs` with:
- `create_terminal_session`
- `write_terminal_input`
- `resize_terminal`
- `close_terminal_session`

Rules:
- validate project directory before spawn
- validate `codex` installation before spawn
- launch command is fixed to `codex`
- no shell fallback

- [ ] **Step 4: Wire commands into Tauri**

Register the module in:
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

- [ ] **Step 5: Add command-level tests**

Create `src-tauri/tests/terminal_commands.rs` for:
- missing directory rejection
- successful session creation with a test command helper
- close on unknown session rejection

- [ ] **Step 6: Run Rust command tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml terminal_commands`

Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/commands/terminal.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs src-tauri/tests/terminal_commands.rs
git commit -m "feat: add terminal tauri commands"
```

### Task 4: Connect `xterm.js` to the Rust PTY Stream

**Files:**
- Modify: `package.json`
- Create: `src/components/terminal/xterm-adapter.ts`
- Create: `src/components/terminal/terminal-services.ts`
- Modify: `src/components/terminal/terminal-panel.tsx`
- Modify: `src/test/terminal-panel.test.tsx`

- [ ] **Step 1: Write the failing frontend interaction test**
```tsx
it('starts a terminal session and renders streamed output', async () => {
  // click start, receive output event, assert rendered terminal content and running state
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/terminal-panel.test.tsx`

Expected: FAIL because terminal services and xterm adapter are not wired.

- [ ] **Step 3: Add frontend terminal dependencies**

Modify `package.json` to add:
- `@xterm/xterm`
- `@xterm/addon-fit`

- [ ] **Step 4: Implement terminal services**

Create `src/components/terminal/terminal-services.ts` to wrap:
- `create_terminal_session`
- `write_terminal_input`
- `resize_terminal`
- `close_terminal_session`
- terminal event subscription

- [ ] **Step 5: Implement xterm adapter**

Create `src/components/terminal/xterm-adapter.ts` to:
- mount/unmount `xterm.js`
- write streamed output into the terminal
- forward user keystrokes to `write_terminal_input`
- call `fit` and report rows/cols on mount and resize

- [ ] **Step 6: Upgrade terminal panel from placeholder to real terminal**

Modify `src/components/terminal/terminal-panel.tsx` to:
- create a session on `启动 Codex`
- show `starting/running/exited/error`
- mount `xterm.js` only when terminal DOM is ready
- preserve output after exit

- [ ] **Step 7: Run frontend tests**

Run: `pnpm vitest run src/test/terminal-panel.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add package.json src/components/terminal/xterm-adapter.ts src/components/terminal/terminal-services.ts src/components/terminal/terminal-panel.tsx src/test/terminal-panel.test.tsx
git commit -m "feat: connect xterm terminal panel"
```

### Task 5: Remove Legacy Chat Session Wiring

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/test/app-shell.test.tsx`
- Modify: `src/components/session/chat-panel.tsx`
- Modify: `src/components/session/session-services.ts`
- Modify: `src/components/session/chat-panel-state.ts`
- Modify: `src/lib/types/session.ts`
- Modify: `src-tauri/src/commands/session.rs`
- Modify: `src-tauri/src/commands/session_control.rs`

- [ ] **Step 1: Write the failing shell regression test**
```tsx
it('does not render legacy chat controls in the right panel', () => {
  render(<AppShell ... />)
  expect(screen.queryByText('输入区')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '启动 Codex' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/app-shell.test.tsx`

Expected: FAIL while legacy chat controls are still mounted.

- [ ] **Step 3: Remove right-side dependency on the chat panel**

Change the app shell so the right side only consumes terminal services and no longer depends on chat-specific service props.

- [ ] **Step 4: Decommission unused chat-only frontend pieces**

Remove or shrink dead code in:
- `src/components/session/chat-panel.tsx`
- `src/components/session/session-services.ts`
- `src/components/session/chat-panel-state.ts`
- `src/lib/types/session.ts`

Only keep pieces still needed elsewhere. Delete obsolete chat-only code paths rather than leaving compatibility shims.

- [ ] **Step 5: Decommission unused chat-only Rust commands**

Remove app-facing dependence on:
- `start_session`
- `send_session_message_command`

Keep backend helpers only if still required by tests or non-UI flows. If they are no longer used, delete them.

- [ ] **Step 6: Run frontend and Rust tests**

Run: `pnpm test`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src src-tauri/src
git commit -m "refactor: replace chat panel with terminal session flow"
```

### Task 6: Add Project Switch and Config-Stale Handling

**Files:**
- Modify: `src/components/terminal/terminal-panel.tsx`
- Modify: `src/components/terminal/terminal-state.ts`
- Modify: `src/App.tsx`
- Modify: `src/test/app-shell.test.tsx`
- Modify: `src/test/terminal-panel.test.tsx`

- [ ] **Step 1: Write the failing project-switch test**
```tsx
it('resets the terminal panel when the project changes', async () => {
  // run terminal, change project config, assert stale hint and idle reset
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/test/app-shell.test.tsx src/test/terminal-panel.test.tsx`

Expected: FAIL because terminal state is not yet reset on project change.

- [ ] **Step 3: Implement project-bound reset logic**

When `projectId` or project root changes:
- close the current terminal if it exists
- clear terminal session metadata
- return to `idle`

- [ ] **Step 4: Implement config-stale hint**

When left-side config saves a new version while terminal is running:
- set `isConfigStale = true`
- show `配置已更新，请重启 Codex 终端`
- do not auto-restart

- [ ] **Step 5: Re-run frontend tests**

Run: `pnpm vitest run src/test/app-shell.test.tsx src/test/terminal-panel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add src/App.tsx src/components/terminal/terminal-panel.tsx src/components/terminal/terminal-state.ts src/test/app-shell.test.tsx src/test/terminal-panel.test.tsx
git commit -m "feat: bind terminal lifecycle to project changes"
```

### Task 7: Full Verification

**Files:**
- Test only

- [ ] **Step 1: Run full frontend suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `pnpm build`

Expected: PASS.

- [ ] **Step 3: Run full Rust suite**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 4: Manual desktop verification**

Run: `pnpm tauri dev`

Verify:
- select and save a project directory
- click `启动 Codex`
- terminal renders Codex prompt
- input reaches Codex
- resize window and terminal refits
- save config and see stale hint
- close terminal
- switch project and confirm right side resets
- edit `reportlets` content and confirm sync still triggers

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat: embed codex terminal panel"
```
