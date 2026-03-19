# Codex Embedded Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working `finereport-ai` desktop shell with a left-side FineReport configuration panel, a right-side Codex chat panel, runtime context generation, and automatic `SFTP`/`FTP` sync after file create, update, or delete.

**Architecture:** Use `Tauri + React + TypeScript + Rust`. Keep Codex integration, runtime context generation, and sync execution in Rust. Keep the WebView focused on config editing, session navigation, and typed timeline rendering.

**Tech Stack:** Tauri v2, Rust, React, TypeScript, Vite, Vitest, Testing Library, `cargo test`, `notify`, `ssh2` or equivalent SFTP client, FTP client crate.

---

## File Structure Map

- `src-tauri/src/main.rs`: Tauri bootstrap.
- `src-tauri/src/lib.rs`: module wiring.
- `src-tauri/src/commands/`: Tauri commands for config, sessions, sync.
- `src-tauri/src/domain/`: config models, context builder, session store, Codex process manager, sync dispatcher.
- `src-tauri/tests/`: Rust integration tests.
- `src/`: React app shell.
- `src/components/config/`: left config panel.
- `src/components/chat/`: chat header, timeline, composer, session sidebar.
- `src/lib/types/`: shared frontend types.
- `src/test/`: frontend tests.
- `embedded/`: base `AGENTS.md`, skills, context templates.

### Task 1: Scaffold the Tauri App Baseline

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/app.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Test: `src/test/app-shell.test.tsx`

- [ ] **Step 1: Write the failing frontend smoke test**
```tsx
it('renders config and chat regions', () => {
  render(<App />)
  expect(screen.getByText('Style Config')).toBeInTheDocument()
  expect(screen.getByText('Codex Session')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/test/app-shell.test.tsx`
Expected: FAIL because `App` does not exist yet.

- [ ] **Step 3: Create the minimal Tauri + React shell**
Implement a split layout with placeholder left/right panes and shared CSS variables.

- [ ] **Step 4: Run frontend test to verify it passes**
Run: `pnpm vitest run src/test/app-shell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Verify desktop shell boots**
Run: `pnpm tauri dev`
Expected: app window opens with left config pane and right chat pane.

- [ ] **Step 6: Commit**
```bash
git add package.json vite.config.ts tsconfig.json src src-tauri
git commit -m "feat: scaffold tauri app shell"
```

### Task 2: Add Project Config Domain and Persistence

**Files:**
- Create: `src-tauri/src/domain/project_config.rs`
- Create: `src-tauri/src/commands/project_config.rs`
- Create: `src/lib/types/project-config.ts`
- Create: `src/components/config/project-config-form.tsx`
- Create: `src/test/project-config-form.test.tsx`
- Test: `src-tauri/tests/project_config_roundtrip.rs`

- [ ] **Step 1: Write the failing Rust config roundtrip test**
```rust
#[test]
fn project_config_roundtrip_preserves_sync_fields() {
    // save + load keeps protocol, local source, remote runtime dir, delete propagation
}
```

- [ ] **Step 2: Run Rust test to verify it fails**
Run: `cargo test --manifest-path src-tauri/Cargo.toml project_config_roundtrip_preserves_sync_fields`
Expected: FAIL because config model is missing.

- [ ] **Step 3: Implement `ProjectConfig` and save/load commands**
Include `StyleProfile`, `WorkspaceProfile`, `SyncProfile`, `AiProfile`, and `ProjectMapping`.

- [ ] **Step 4: Add the failing frontend form test**
Check that `SFTP`, `FTP`, `local_source_dir`, `remote_runtime_dir`, and `auto_sync_on_change` fields render.

- [ ] **Step 5: Implement the left-side config form**
Persist through Tauri commands and show validation errors without silent fallback.

- [ ] **Step 6: Run both test suites**
Run: `cargo test --manifest-path src-tauri/Cargo.toml project_config_roundtrip_preserves_sync_fields`
Run: `pnpm vitest run src/test/project-config-form.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/domain/project_config.rs src-tauri/src/commands/project_config.rs src/lib/types/project-config.ts src/components/config/project-config-form.tsx src/test/project-config-form.test.tsx src-tauri/tests/project_config_roundtrip.rs
git commit -m "feat: add project config persistence"
```

### Task 3: Implement Embedded Assets and Runtime Context Builder

**Files:**
- Create: `embedded/agents/base/AGENTS.md`
- Create: `embedded/skills/finereport-template/SKILL.md`
- Create: `embedded/skills/browser-validate/SKILL.md`
- Create: `embedded/skills/sync-publish/SKILL.md`
- Create: `embedded/templates/project-context.md.hbs`
- Create: `embedded/templates/project-rules.md.hbs`
- Create: `embedded/templates/mappings.json.hbs`
- Create: `src-tauri/src/domain/context_builder.rs`
- Test: `src-tauri/tests/context_builder_generates_sync_rules.rs`

- [ ] **Step 1: Write the failing context builder test**
Assert that generated context contains enabled skills, sync protocol, source-to-target mappings, and delete propagation rules.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path src-tauri/Cargo.toml context_builder_generates_sync_rules`
Expected: FAIL.

- [ ] **Step 3: Add embedded templates and implement `context_builder`**
Generate `AGENTS.md`, `project-context.md`, `project-rules.md`, `mappings.json`, and copied skills under the session context directory.

- [ ] **Step 4: Re-run Rust test**
Run: `cargo test --manifest-path src-tauri/Cargo.toml context_builder_generates_sync_rules`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add embedded src-tauri/src/domain/context_builder.rs src-tauri/tests/context_builder_generates_sync_rules.rs
git commit -m "feat: add runtime context builder"
```

### Task 4: Build Session Store, Codex Process Manager, and Event Bridge

**Files:**
- Create: `src-tauri/src/domain/session_store.rs`
- Create: `src-tauri/src/domain/codex_process_manager.rs`
- Create: `src-tauri/src/domain/event_bridge.rs`
- Create: `src-tauri/src/commands/session.rs`
- Create: `src/lib/types/session.ts`
- Test: `src-tauri/tests/session_start_persists_manifest.rs`

- [ ] **Step 1: Write the failing session bootstrap test**
Assert that `start_session` creates `transcript.jsonl`, `session-manifest.json`, and context directory entries.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path src-tauri/Cargo.toml session_start_persists_manifest`
Expected: FAIL.

- [ ] **Step 3: Implement session persistence and Codex process startup**
Stream stdout/stderr into typed events; keep process metadata in Rust.

- [ ] **Step 4: Re-run Rust test**
Run: `cargo test --manifest-path src-tauri/Cargo.toml session_start_persists_manifest`
Expected: PASS.

- [ ] **Step 5: Smoke-check manual session start**
Run: `pnpm tauri dev`
Expected: sending a first message creates a session directory and visible status events.

- [ ] **Step 6: Commit**
```bash
git add src-tauri/src/domain/session_store.rs src-tauri/src/domain/codex_process_manager.rs src-tauri/src/domain/event_bridge.rs src-tauri/src/commands/session.rs src/lib/types/session.ts src-tauri/tests/session_start_persists_manifest.rs
git commit -m "feat: add codex session orchestration"
```

### Task 5: Implement the Chat Panel and Session Sidebar

**Files:**
- Create: `src/components/chat/chat-header.tsx`
- Create: `src/components/chat/message-timeline.tsx`
- Create: `src/components/chat/composer.tsx`
- Create: `src/components/chat/session-sidebar.tsx`
- Create: `src/components/chat/activity-rail.tsx`
- Create: `src/test/chat-panel.test.tsx`

- [ ] **Step 1: Write the failing chat panel test**
Assert rendering of `user`, `assistant`, `tool`, `sync`, `status`, and `error` timeline items.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm vitest run src/test/chat-panel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the chat UI with typed timeline rendering**
Show config version, session status, sync events, and explicit “refresh context” action.

- [ ] **Step 4: Re-run frontend test**
Run: `pnpm vitest run src/test/chat-panel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add src/components/chat src/test/chat-panel.test.tsx
git commit -m "feat: add codex chat panel ui"
```

### Task 6: Add Automatic `SFTP`/`FTP` Sync After File Changes

**Files:**
- Create: `src-tauri/src/domain/sync_dispatcher.rs`
- Create: `src-tauri/src/domain/sftp_client.rs`
- Create: `src-tauri/src/domain/ftp_client.rs`
- Create: `src-tauri/src/commands/sync.rs`
- Test: `src-tauri/tests/sync_dispatcher_emits_create_update_delete.rs`

- [ ] **Step 1: Write the failing sync dispatcher test**
Assert that create, update, and delete events map local files to remote runtime targets and preserve protocol choice.

- [ ] **Step 2: Run test to verify it fails**
Run: `cargo test --manifest-path src-tauri/Cargo.toml sync_dispatcher_emits_create_update_delete`
Expected: FAIL.

- [ ] **Step 3: Implement file watching and dispatch**
Use `notify` or equivalent watcher; enqueue sync tasks only after file writes complete.

- [ ] **Step 4: Implement `SFTP` and `FTP` adapters**
Fail loudly on auth errors, remote path errors, and delete mismatches.

- [ ] **Step 5: Re-run Rust test**
Run: `cargo test --manifest-path src-tauri/Cargo.toml sync_dispatcher_emits_create_update_delete`
Expected: PASS.

- [ ] **Step 6: Manual verification**
Run: `pnpm tauri dev`
Expected: changing a generated file produces a visible `sync` timeline event and writes sync logs under `~/.finereport-ai/projects/<project-id>/sync/`.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/domain/sync_dispatcher.rs src-tauri/src/domain/sftp_client.rs src-tauri/src/domain/ftp_client.rs src-tauri/src/commands/sync.rs src-tauri/tests/sync_dispatcher_emits_create_update_delete.rs
git commit -m "feat: add automatic runtime sync"
```

### Task 7: Wire End-to-End Flow and Document Verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Create: `src/test/app-flow.test.tsx`
- Test: `src-tauri/tests/end_to_end_session_flow.rs`

- [ ] **Step 1: Write the failing end-to-end tests**
Cover config save -> session start -> context generation -> timeline updates -> sync event emission.

- [ ] **Step 2: Run tests to verify they fail**
Run: `cargo test --manifest-path src-tauri/Cargo.toml end_to_end_session_flow`
Run: `pnpm vitest run src/test/app-flow.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Fill integration gaps**
Wire commands, frontend stores, and sync status surfaces until the full path passes.

- [ ] **Step 4: Run final verification**
Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Run: `pnpm vitest run`
Run: `pnpm tauri dev`
Expected: all tests PASS; desktop flow works manually.

- [ ] **Step 5: Update docs**
Document local setup, required Codex CLI availability, and `SFTP`/`FTP` configuration expectations.

- [ ] **Step 6: Commit**
```bash
git add README.md AGENTS.md src/test/app-flow.test.tsx src-tauri/tests/end_to_end_session_flow.rs
git commit -m "feat: finish codex embedded chat workflow"
```
