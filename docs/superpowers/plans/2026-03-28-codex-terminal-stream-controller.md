# Codex Terminal Stream Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current `apps/web` Codex terminal page so terminal output is consumed incrementally through a dedicated stream controller instead of accumulating a full output string in Vue state.

**Architecture:** Keep the existing backend `cursor + chunk` contract unchanged. Add a frontend stream controller that owns `SSE` / polling transport, cursor advancement, lifecycle invalidation, and storage updates. Convert `TerminalSessionPanel.vue` into a command-style terminal surface that exposes `appendOutput()` and `reset()` so `CodexTerminalView.vue` no longer stores `terminalOutput`.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library, `@xterm/xterm`, existing `apps/web/src/lib/api.ts`, sessionStorage-based restore state

---

## File Structure Map

- `apps/web/src/views/CodexTerminalView.vue`: page-level orchestration only; remove full-output state and delegate stream lifecycle to the controller.
- `apps/web/src/views/use-codex-terminal-workbench.ts`: page-scoped workbench orchestration; owns the terminal controller instance for one mounted page.
- `apps/web/src/views/codex-terminal-workbench-helpers.ts`: pure helpers for error formatting, restore-state persistence, and context mapping.
- `apps/web/src/views/codex-terminal-stream-runtime.ts`: controller factory wiring for the page workbench.
- `apps/web/src/components/TerminalSessionPanel.vue`: own xterm mount and expose imperative methods for incremental output writes and reset.
- `apps/web/src/components/terminal/codex-terminal-stream-controller.ts`: new stream controller that unifies `SSE` / polling, cursor management, lifecycle invalidation, and storage updates.
- `apps/web/src/lib/codex-session-storage.ts`: keep persisted `project_path + session_id + next_cursor`; no schema change expected, but this file remains part of the restore flow touched by tests.
- `apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts`: controller-focused unit tests for chunk delivery, stale lifecycle dropping, and missing-session cleanup.
- `apps/web/src/__tests__/terminal-session-panel.spec.ts`: panel-focused tests for imperative append/reset behavior.
- `apps/web/src/__tests__/codex-terminal-view.spec.ts`: integration tests for page boot, restore, restart, and error handling after removing `terminalOutput`.

### Task 1: Lock the New Stream Semantics With Controller Tests

**Files:**
- Create: `apps/web/src/components/terminal/codex-terminal-stream-controller.ts`
- Create: `apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts`
- Modify: `apps/web/src/lib/codex-session-storage.ts`

- [ ] **Step 1: Write the failing controller test for incremental SSE delivery**

```ts
it('forwards each SSE chunk through onChunk without accumulating output state', async () => {
  const chunks: string[] = []
  const controller = createCodexTerminalStreamController(deps)

  controller.start({
    projectPath: '/tmp/project-alpha',
    sessionId: 'terminal-session-1',
    cursor: 0,
    preferredTransport: 'sse',
    onChunk: (chunk) => chunks.push(chunk)
  })

  emitSseChunk({ output: 'hello', next_cursor: 5, completed: false })
  emitSseChunk({ output: ' world', next_cursor: 11, completed: true })

  expect(chunks).toEqual(['hello', ' world'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-stream-controller.spec.ts`

Expected: FAIL because the controller module does not exist yet.

- [ ] **Step 3: Add failing tests for lifecycle invalidation and missing-session cleanup**

Add tests that verify:
- stale `lifecycleId` chunks are ignored
- `codex.session_not_found` stops the stream and clears stored session state
- polling advances `cursor` and schedules the next read only when still active

- [ ] **Step 4: Implement the minimal controller module**

Create `apps/web/src/components/terminal/codex-terminal-stream-controller.ts` with:
- a factory that receives transport dependencies instead of hard-importing browser globals
- internal state: `sessionId`, `cursor`, `transport`, `lifecycleId`, `stopped`
- methods:
  - `start(...)`
  - `stop()`
  - `bumpLifecycle()`
  - `getCursor()`
- callbacks:
  - `onChunk(output)`
  - `onStatus(status)`
  - `onError(message)`
  - `onMissingSession()`

- [ ] **Step 5: Keep storage updates inside the controller**

Implement controller writes to `saveStoredCodexSession(...)` after each accepted chunk and clears storage through `clearStoredCodexSession(...)` when the backend reports `codex.session_not_found`.

- [ ] **Step 6: Run controller tests**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-stream-controller.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/terminal/codex-terminal-stream-controller.ts apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts apps/web/src/lib/codex-session-storage.ts
git commit -m "test: 锁定 Codex 终端流控制器语义"
```

### Task 2: Refactor TerminalSessionPanel to Imperative Incremental Writes

**Files:**
- Modify: `apps/web/src/components/TerminalSessionPanel.vue`
- Create: `apps/web/src/__tests__/terminal-session-panel.spec.ts`
- Modify: `apps/web/src/components/terminal/xterm-adapter.ts`

- [ ] **Step 1: Write the failing panel test for append/reset**

```ts
it('appends output chunks in order and resets on session switch', async () => {
  const view = render(TerminalSessionPanel, { props: { session, errorMessage: '' } })

  view.vm.appendOutput('hello')
  view.vm.appendOutput(' world')
  expect(adapterWrites()).toEqual(['hello', ' world'])

  await view.rerender({ session: otherSession, errorMessage: '' })
  expect(adapterClear).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/terminal-session-panel.spec.ts`

Expected: FAIL because `TerminalSessionPanel.vue` still depends on the `output` prop and does not expose `appendOutput`.

- [ ] **Step 3: Remove the `output` prop from the panel**

Refactor `TerminalSessionPanel.vue` so props are only:
- `session`
- `errorMessage`

Delete:
- `renderedLength`
- `syncOutput(output)`
- the watch on `props.output`

- [ ] **Step 4: Expose imperative panel methods**

Expose these methods through `defineExpose(...)`:
- `appendOutput(chunk: string)`
- `reset()`
- `focusTerminal()`

Implementation rules:
- `appendOutput` must call `adapter.write(chunk)` directly
- `reset` must call `adapter.clear()`
- session id changes must clear the terminal once and then focus it

- [ ] **Step 5: Keep the adapter boundary minimal**

If needed, extend `apps/web/src/components/terminal/xterm-adapter.ts` only to preserve:
- `write(content)`
- `clear()`
- `focus()`

Do not add controller logic into the adapter.

- [ ] **Step 6: Run panel tests**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/terminal-session-panel.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/TerminalSessionPanel.vue apps/web/src/components/terminal/xterm-adapter.ts apps/web/src/__tests__/terminal-session-panel.spec.ts
git commit -m "refactor: 改为终端面板增量写入接口"
```

### Task 3: Integrate the Controller Into CodexTerminalView

**Files:**
- Modify: `apps/web/src/views/CodexTerminalView.vue`
- Create: `apps/web/src/views/use-codex-terminal-workbench.ts`
- Create: `apps/web/src/views/codex-terminal-workbench-helpers.ts`
- Create: `apps/web/src/views/codex-terminal-stream-runtime.ts`
- Modify: `apps/web/src/__tests__/codex-terminal-view.spec.ts`
- Modify: `apps/web/src/__tests__/codex-terminal-view.helpers.ts`

- [ ] **Step 1: Extend the failing view tests before changing the page**

Add or update integration tests to assert:
- terminal chunks are written through the adapter without any `terminalOutput` prop
- restore resumes from stored `next_cursor`
- restart invalidates stale create-session / stream callbacks
- `codex.session_not_found` clears the stored session and resets the page

- [ ] **Step 2: Run view tests to verify they fail**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-view.spec.ts`

Expected: FAIL because the current page still accumulates `terminalOutput`.

- [ ] **Step 3: Remove `terminalOutput` state from the page**

In `apps/web/src/views/CodexTerminalView.vue`:
- delete `const terminalOutput = ref('')`
- delete all `terminalOutput.value += chunk.output` branches
- stop passing `:output="terminalOutput"` to the panel

- [ ] **Step 4: Mount the controller once and delegate transport work**

Create a single controller instance for each mounted page and wire it with:
- `onChunk`: `terminalPanelRef.value?.appendOutput(chunk)`
- `onError`: update `errorMessage.value`
- `onStatus`: patch `session.value.status`
- `onMissingSession`: clear current session state and storage

Page responsibilities after the refactor:
- boot project state
- create / restore / close session
- pass the active session to the controller
- send input to `writeCodexTerminalInput`

- [ ] **Step 5: Make lifecycle invalidation explicit**

Replace ad-hoc stale guards with controller-driven invalidation:
- when restart / close / force-new boot begins, bump lifecycle and stop the old controller transport first
- when a stale create-session resolves late, close that orphan session and discard its stream

- [ ] **Step 6: Preserve restore semantics**

When `tryRestoreSession(...)` succeeds:
- keep using the stored `next_cursor`
- start the controller from that cursor
- do not regenerate project context or create a new session

- [ ] **Step 7: Run the view tests**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-view.spec.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/views/CodexTerminalView.vue apps/web/src/__tests__/codex-terminal-view.spec.ts apps/web/src/__tests__/codex-terminal-view.helpers.ts
git commit -m "refactor: 接入 Codex 终端流控制器"
```

### Task 4: Full Verification and Cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-03-28-codex-terminal-stream-controller-design.md` (only if implementation reality diverges)
- Modify: any touched frontend file from Tasks 1-3 only if cleanup is required after verification

- [ ] **Step 1: Run the focused frontend terminal test suite**

Run: `pnpm --dir apps/web exec vitest run src/__tests__/codex-terminal-stream-controller.spec.ts src/__tests__/terminal-session-panel.spec.ts src/__tests__/codex-terminal-view.spec.ts src/__tests__/api-client.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run the web build**

Run: `pnpm --dir apps/web build`

Expected: build succeeds without TypeScript errors.

- [ ] **Step 3: Manually inspect for removed full-output state**

Run: `rg -n "terminalOutput|renderedLength|syncOutput\\(" apps/web/src`

Expected: no hits in the refactored Codex terminal page and panel implementation.

- [ ] **Step 4: Update the spec only if implementation changed the design**

If file boundaries, lifecycle rules, or explicit no-fallback behavior changed during implementation, patch the design doc so it matches reality. Otherwise leave the spec untouched.

- [ ] **Step 5: Commit the verification cleanup**

```bash
git add apps/web/src docs/superpowers/specs/2026-03-28-codex-terminal-stream-controller-design.md
git commit -m "test: 完成 Codex 终端流控制器验证"
```
