# Codex Terminal Hapi-Aligned Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Codex terminal startup, restore, polling-output, xterm rendering, and input flow into separate page, connection, viewport, and composer layers while removing terminal-output SSE usage from the web client.

**Architecture:** Keep the existing Python terminal session API and Vue page entry points, but move terminal runtime behavior into a dedicated polling connection module and split the current panel into smaller terminal-specific components. The page model keeps project/session orchestration, the connection owns cursor and polling state, the viewport owns xterm mount/render/focus/resize, and the composer owns explicit command input.

**Tech Stack:** Vue 3, TypeScript, Vitest, xterm.js, FastAPI terminal session API

---

## File Structure

### Files To Create

- `apps/web/src/components/terminal/use-terminal-connection.ts`
  - Polling-only terminal connection module
- `apps/web/src/components/terminal/terminal-connection-state.ts`
  - Connection status and transition helpers
- `apps/web/src/components/terminal/TerminalViewport.vue`
  - xterm mount/render bridge
- `apps/web/src/components/terminal/TerminalComposer.vue`
  - Explicit command input and submit UI
- `apps/web/src/__tests__/use-terminal-connection.spec.ts`
  - Polling cursor / lifecycle / missing-session tests
- `apps/web/src/__tests__/terminal-viewport.spec.ts`
  - xterm mount, append, clear, focus tests
- `apps/web/src/__tests__/terminal-composer.spec.ts`
  - Enter/send/disabled-state tests

### Files To Modify

- `apps/web/src/views/use-codex-terminal-workbench.ts`
  - Shrink into page orchestration only
- `apps/web/src/components/TerminalSessionPanel.vue`
  - Convert into layout container composed from viewport/composer
- `apps/web/src/components/terminal/xterm-adapter.ts`
  - Narrow to xterm-only responsibilities and resize callback
- `apps/web/src/views/codex-terminal-workbench-helpers.ts`
  - Remove transport selection logic
- `apps/web/src/views/codex-terminal-stream-runtime.ts`
  - Delete in phase 2 after migration
- `apps/web/src/components/terminal/codex-terminal-stream-controller.ts`
  - Delete in phase 2 after migration
- `apps/web/src/components/terminal/codex-terminal-stream-controller-helpers.ts`
  - Delete in phase 2 after migration
- `apps/web/src/__tests__/codex-terminal-view.spec.ts`
  - Re-target to page orchestration, not transport details
- `apps/web/src/__tests__/terminal-session-panel.spec.ts`
  - Re-target to composed panel behavior
- `apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts`
  - Delete in phase 2 after replacement coverage exists

### Existing References

- `apps/web/src/views/use-codex-terminal-workbench.ts`
- `apps/web/src/components/TerminalSessionPanel.vue`
- `apps/web/src/components/terminal/xterm-adapter.ts`
- `docs/superpowers/specs/2026-04-01-codex-terminal-hapi-aligned-redesign-design.md`

## Task 1: Lock The New Connection Contract With Failing Tests

**Files:**
- Create: `apps/web/src/components/terminal/terminal-connection-state.ts`
- Create: `apps/web/src/components/terminal/use-terminal-connection.ts`
- Test: `apps/web/src/__tests__/use-terminal-connection.spec.ts`

- [ ] **Step 1: Write the failing connection-state test**

```ts
import { describe, expect, it } from 'vitest'
import {
  createTerminalConnectionState,
  startBooting,
  markStreaming,
  markClosed,
  markFailed
} from '../components/terminal/terminal-connection-state'

describe('terminal-connection-state', () => {
  it('allows idle -> booting -> streaming -> closed transitions', () => {
    const idle = createTerminalConnectionState()
    const booting = startBooting(idle)
    const streaming = markStreaming(booting)
    const closed = markClosed(streaming)

    expect(idle.status).toBe('idle')
    expect(booting.status).toBe('booting')
    expect(streaming.status).toBe('streaming')
    expect(closed.status).toBe('closed')
  })

  it('marks failures explicitly', () => {
    const failed = markFailed(startBooting(createTerminalConnectionState()), 'read failed')
    expect(failed.status).toBe('failed')
    expect(failed.errorMessage).toBe('read failed')
  })
})
```

- [ ] **Step 2: Write the failing polling connection test**

```ts
it('polls output chunks sequentially and advances cursor', async () => {
  const readStreamChunk = vi
    .fn()
    .mockResolvedValueOnce(createChunk('hello', 5, false))
    .mockResolvedValueOnce(createChunk(' world', 11, true, { status: 'closed' }))

  const harness = createConnectionHarness({ readStreamChunk })

  harness.connection.start({
    sessionId: 'terminal-session-1',
    projectPath: '/tmp/project-alpha',
    cursor: 0
  })

  await flushPromises()
  expect(readStreamChunk).toHaveBeenCalledWith('terminal-session-1', 0)
  expect(harness.chunks).toEqual(['hello'])

  harness.runNextPoll()
  await flushPromises()
  expect(readStreamChunk).toHaveBeenNthCalledWith(2, 'terminal-session-1', 5)
  expect(harness.chunks).toEqual(['hello', ' world'])
  expect(harness.statuses).toContain('closed')
})
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/use-terminal-connection.spec.ts
```

Expected:

- FAIL with missing module or missing exported functions like `createTerminalConnectionState`
- FAIL because `use-terminal-connection.ts` does not exist yet

- [ ] **Step 4: Implement the minimal connection state module**

```ts
export type TerminalConnectionStatus =
  | 'idle'
  | 'booting'
  | 'streaming'
  | 'closed'
  | 'failed'

export interface TerminalConnectionState {
  readonly status: TerminalConnectionStatus
  readonly errorMessage: string
}

export function createTerminalConnectionState(): TerminalConnectionState {
  return { status: 'idle', errorMessage: '' }
}

export function startBooting(): TerminalConnectionState {
  return { status: 'booting', errorMessage: '' }
}

export function markStreaming(): TerminalConnectionState {
  return { status: 'streaming', errorMessage: '' }
}

export function markClosed(): TerminalConnectionState {
  return { status: 'closed', errorMessage: '' }
}

export function markFailed(
  _current: TerminalConnectionState,
  errorMessage: string
): TerminalConnectionState {
  return { status: 'failed', errorMessage }
}
```

- [ ] **Step 5: Implement the minimal polling connection module**

```ts
export function createTerminalConnection(deps: TerminalConnectionDeps): TerminalConnection {
  let cursor = 0
  let stopped = true
  let activeSessionId: string | null = null

  async function readNext(): Promise<void> {
    if (stopped || !activeSessionId) {
      return
    }
    const chunk = await deps.readStreamChunk(activeSessionId, cursor)
    cursor = chunk.next_cursor
    if (chunk.output) {
      deps.onChunk(chunk.output)
    }
    deps.onStatus(chunk.status === 'running' ? 'streaming' : chunk.status)
    if (chunk.completed) {
      return
    }
    deps.schedulePoll(() => {
      void readNext()
    }, 300)
  }

  return {
    start(options) {
      activeSessionId = options.sessionId
      cursor = options.cursor
      stopped = false
      deps.onStatus('booting')
      void readNext()
    },
    stop() {
      stopped = true
      activeSessionId = null
      deps.onStatus('idle')
    },
    write: deps.writeInput
  }
}
```

- [ ] **Step 6: Run the tests again**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/use-terminal-connection.spec.ts
```

Expected:

- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/terminal/terminal-connection-state.ts
git add apps/web/src/components/terminal/use-terminal-connection.ts
git add apps/web/src/__tests__/use-terminal-connection.spec.ts
git commit -m "feat: 新增终端 polling 连接状态机"
```

## Task 2: Split Terminal Rendering Into Viewport And Composer

**Files:**
- Create: `apps/web/src/components/terminal/TerminalViewport.vue`
- Create: `apps/web/src/components/terminal/TerminalComposer.vue`
- Modify: `apps/web/src/components/terminal/xterm-adapter.ts`
- Test: `apps/web/src/__tests__/terminal-viewport.spec.ts`
- Test: `apps/web/src/__tests__/terminal-composer.spec.ts`

- [ ] **Step 1: Write the failing viewport test**

```ts
it('mounts xterm and forwards keyboard input', async () => {
  const onInput = vi.fn()
  const panel = render(TerminalViewport, {
    props: { onInput }
  })

  expect(adapterHarness.factory).toHaveBeenCalledTimes(1)
  adapterHarness.bindings().onInput('pwd\\r')
  expect(onInput).toHaveBeenCalledWith('pwd\\r')
})
```

- [ ] **Step 2: Write the failing composer test**

```ts
it('submits the input value on enter and clears the field', async () => {
  const view = render(TerminalComposer, {
    props: {
      disabled: false
    }
  })

  const input = screen.getByPlaceholderText('输入命令后按 Enter 发送到 Codex')
  await fireEvent.update(input, 'help')
  await fireEvent.keyDown(input, { key: 'Enter' })

  expect(view.emitted('submit')).toEqual([['help\\r']])
  expect((input as HTMLInputElement).value).toBe('')
})
```

- [ ] **Step 3: Run the failing tests**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/terminal-viewport.spec.ts \
  src/__tests__/terminal-composer.spec.ts
```

Expected:

- FAIL because both Vue components are missing

- [ ] **Step 4: Implement the viewport and xterm adapter boundary**

```ts
export interface TerminalAdapterBindings {
  onInput: (payload: string) => void
  onResize?: () => void
}
```

```vue
<script setup lang="ts">
const props = defineProps<{ onInput: (payload: string) => void }>()
const hostRef = ref<HTMLElement | null>(null)
const adapter = ref<TerminalAdapter | null>(null)

onMounted(() => {
  if (!hostRef.value) return
  adapter.value = createTerminalAdapter(hostRef.value, {
    onInput: props.onInput
  })
  adapter.value.fit()
})

defineExpose({
  appendOutput: (chunk: string) => adapter.value?.write(chunk),
  clear: () => adapter.value?.clear(),
  focus: () => adapter.value?.focus()
})
</script>
```

- [ ] **Step 5: Implement the composer**

```vue
<script setup lang="ts">
const props = defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ submit: [payload: string] }>()
const value = ref('')

function submit(): void {
  if (props.disabled || !value.value.trim()) return
  emit('submit', `${value.value}\\r`)
  value.value = ''
}
</script>
```

- [ ] **Step 6: Run the tests again**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/terminal-viewport.spec.ts \
  src/__tests__/terminal-composer.spec.ts
```

Expected:

- PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/terminal/TerminalViewport.vue
git add apps/web/src/components/terminal/TerminalComposer.vue
git add apps/web/src/components/terminal/xterm-adapter.ts
git add apps/web/src/__tests__/terminal-viewport.spec.ts
git add apps/web/src/__tests__/terminal-composer.spec.ts
git commit -m "feat: 拆分终端视图与输入组件"
```

## Task 3: Refactor The Panel Into A Pure Layout Container

**Files:**
- Modify: `apps/web/src/components/TerminalSessionPanel.vue`
- Modify: `apps/web/src/__tests__/terminal-session-panel.spec.ts`

- [ ] **Step 1: Rewrite the panel test to expect composition instead of inline terminal logic**

```ts
it('wires viewport append/reset/focus through the exposed panel handle', async () => {
  const panelRef = ref<TerminalSessionPanelExposed | null>(null)
  render(Harness, { props: { session: createSession('terminal-session-1'), errorMessage: '' } })

  await waitFor(() => expect(panelRef.value).not.toBeNull())
  panelRef.value?.appendOutput('hello')
  panelRef.value?.reset()
  panelRef.value?.focusTerminal()

  expect(viewportHarness.appendOutput).toHaveBeenCalledWith('hello')
  expect(viewportHarness.clear).toHaveBeenCalledTimes(1)
  expect(viewportHarness.focus).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the failing panel test**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/terminal-session-panel.spec.ts
```

Expected:

- FAIL because the panel still owns xterm directly

- [ ] **Step 3: Replace inline xterm and input markup with composed children**

```vue
<TerminalViewport
  ref="viewportRef"
  :on-input="(payload) => $emit('submitInput', payload)"
/>
<TerminalComposer
  :disabled="!session || session.status !== 'running'"
  @submit="(payload) => $emit('submitInput', payload)"
/>
```

- [ ] **Step 4: Re-expose the panel imperative API through the viewport ref**

```ts
const viewportRef = ref<TerminalViewportHandle | null>(null)

defineExpose({
  appendOutput: (chunk: string) => viewportRef.value?.appendOutput(chunk),
  reset: () => viewportRef.value?.clear(),
  focusTerminal: () => viewportRef.value?.focus()
})
```

- [ ] **Step 5: Run the panel test again**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/terminal-session-panel.spec.ts
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/TerminalSessionPanel.vue
git add apps/web/src/__tests__/terminal-session-panel.spec.ts
git commit -m "refactor: 收缩终端面板为纯布局容器"
```

## Task 4: Shrink The Workbench Into A Page Model And Wire The New Connection

**Files:**
- Modify: `apps/web/src/views/use-codex-terminal-workbench.ts`
- Modify: `apps/web/src/views/CodexTerminalView.vue`
- Modify: `apps/web/src/__tests__/codex-terminal-view.spec.ts`
- Modify: `apps/web/src/views/codex-terminal-workbench-helpers.ts`

- [ ] **Step 1: Rewrite the view test to assert polling-only terminal orchestration**

```ts
it('starts the terminal connection with the restored cursor and never asks for SSE transport', async () => {
  sessionStorage.setItem(
    'finereport.codex.active-session',
    JSON.stringify({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-restored',
      next_cursor: 42
    })
  )

  render(CodexTerminalView)

  await waitFor(() => {
    expect(startConnection).toHaveBeenCalledWith({
      sessionId: 'terminal-session-restored',
      projectPath: '/tmp/project-alpha',
      cursor: 42
    })
  })
  expect(resolvePreferredTransport).toBeUndefined()
})
```

- [ ] **Step 2: Run the failing workbench test**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/codex-terminal-view.spec.ts
```

Expected:

- FAIL because `use-codex-terminal-workbench.ts` still uses the old stream controller

- [ ] **Step 3: Replace stream-controller usage with the new connection module**

```ts
const connection = createTerminalConnection({
  readStreamChunk: streamCodexTerminalSession,
  writeInput: async (sessionId, data) => {
    await writeCodexTerminalInput(sessionId, data)
  },
  schedulePoll: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearScheduledPoll: (timerId) => window.clearTimeout(timerId),
  onChunk: (chunk) => terminalPanelRef.value?.appendOutput(chunk),
  onStatus: (status) => patchConnectionStatus(status),
  onMissingSession: () => handleMissingSession(),
  onError: (message) => {
    errorMessage.value = message
  }
})
```

- [ ] **Step 4: Remove transport selection and keep only page orchestration helpers**

```ts
export function saveSessionState(projectPath: string, sessionId: string, cursor: number): void {
  if (!projectPath) return
  saveStoredCodexSession({
    project_path: projectPath,
    session_id: sessionId,
    next_cursor: cursor
  })
}
```

- [ ] **Step 5: Run the workbench test again**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/codex-terminal-view.spec.ts
```

Expected:

- PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/views/use-codex-terminal-workbench.ts
git add apps/web/src/views/CodexTerminalView.vue
git add apps/web/src/views/codex-terminal-workbench-helpers.ts
git add apps/web/src/__tests__/codex-terminal-view.spec.ts
git commit -m "refactor: 重写终端页面编排与 polling 连接接线"
```

## Task 5: Delete Old SSE Terminal Client Paths And Re-verify The Whole Feature

**Files:**
- Delete: `apps/web/src/views/codex-terminal-stream-runtime.ts`
- Delete: `apps/web/src/components/terminal/codex-terminal-stream-controller.ts`
- Delete: `apps/web/src/components/terminal/codex-terminal-stream-controller-helpers.ts`
- Delete: `apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts`
- Modify: `apps/web/src/__tests__/api-client.spec.ts`
- Test: `apps/web/src/__tests__/codex-terminal-workbench-helpers.spec.ts`

- [ ] **Step 1: Write or adjust the failing API/helper tests to reflect polling-only output**

```ts
it('streams terminal output through the polling endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
    JSON.stringify({
      session_id: 'terminal-session-1',
      status: 'running',
      output: 'hello',
      next_cursor: 5,
      completed: false
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )))

  await expect(streamCodexTerminalSession('terminal-session-1', 0)).resolves.toMatchObject({
    output: 'hello',
    next_cursor: 5
  })
})
```

```ts
it('always uses polling to fetch terminal output in separate requests', () => {
  expect(resolvePreferredTransport()).toBe('polling')
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/api-client.spec.ts \
  src/__tests__/codex-terminal-workbench-helpers.spec.ts
```

Expected:

- FAIL if the old SSE-only assumptions remain

- [ ] **Step 3: Delete the old SSE controller files**

```text
apps/web/src/views/codex-terminal-stream-runtime.ts
apps/web/src/components/terminal/codex-terminal-stream-controller.ts
apps/web/src/components/terminal/codex-terminal-stream-controller-helpers.ts
apps/web/src/__tests__/codex-terminal-stream-controller.spec.ts
```

- [ ] **Step 4: Run the full terminal-facing test suite**

Run:

```bash
pnpm --dir apps/web exec vitest run \
  src/__tests__/use-terminal-connection.spec.ts \
  src/__tests__/terminal-viewport.spec.ts \
  src/__tests__/terminal-composer.spec.ts \
  src/__tests__/terminal-session-panel.spec.ts \
  src/__tests__/codex-terminal-view.spec.ts \
  src/__tests__/api-client.spec.ts \
  src/__tests__/codex-terminal-workbench-helpers.spec.ts
```

Expected:

- PASS

- [ ] **Step 5: Run the production build**

Run:

```bash
pnpm --dir apps/web build
```

Expected:

- `✓ built in ...`

- [ ] **Step 6: Run backend terminal regression verification**

Run:

```bash
pytest tests/test_terminal_gateway.py tests/test_codex_terminal_use_cases.py tests/test_codex_terminal_api.py -q
```

Expected:

- `... passed`

- [ ] **Step 7: Smoke test against the local API**

Run:

```bash
curl -fsS http://127.0.0.1:18081/api/health
curl -fsS -X POST http://127.0.0.1:18081/api/codex/terminal/sessions \
  -H 'Content-Type: application/json' \
  -d '{"working_directory":"/Users/wj/data/mcp/finereport"}'
```

Expected:

- `{"status":"ok"}`
- a JSON session payload with `status:"running"`

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/__tests__/api-client.spec.ts
git add apps/web/src/__tests__/codex-terminal-workbench-helpers.spec.ts
git add apps/web/src/components/terminal/use-terminal-connection.ts
git add apps/web/src/components/terminal/terminal-connection-state.ts
git add apps/web/src/components/terminal/TerminalViewport.vue
git add apps/web/src/components/terminal/TerminalComposer.vue
git add apps/web/src/components/terminal/xterm-adapter.ts
git add apps/web/src/components/TerminalSessionPanel.vue
git add apps/web/src/views/use-codex-terminal-workbench.ts
git add apps/web/src/views/CodexTerminalView.vue
git add apps/web/src/views/codex-terminal-workbench-helpers.ts
git add apps/web/src/__tests__/use-terminal-connection.spec.ts
git add apps/web/src/__tests__/terminal-viewport.spec.ts
git add apps/web/src/__tests__/terminal-composer.spec.ts
git add apps/web/src/__tests__/terminal-session-panel.spec.ts
git add apps/web/src/__tests__/codex-terminal-view.spec.ts
git add docs/superpowers/specs/2026-04-01-codex-terminal-hapi-aligned-redesign-design.md
git add docs/superpowers/plans/2026-04-01-codex-terminal-hapi-aligned-redesign.md
git commit -m "refactor: 按 hapi 思路重构 codex 终端链路"
```

## Self-Review

- Spec coverage:
  - Polling-only output: covered in Tasks 1, 4, 5
  - Four-layer split: covered in Tasks 2, 3, 4
  - Session startup / restore / restart unification: covered in Task 4
  - Removal of SSE terminal usage: covered in Task 5
  - Preserve backend API shape: covered in Task 5 backend regression verification

- Placeholder scan:
  - No `TBD`, `TODO`, or “implement later” placeholders remain
  - Each task includes exact file paths, code snippets, commands, and expected results

- Type consistency:
  - Connection statuses remain `idle | booting | streaming | closed | failed`
  - `TerminalConnection.start({ sessionId, projectPath, cursor })` is used consistently
  - Composer emits `submit`, panel emits `submitInput`, viewport exposes `appendOutput / clear / focus`
