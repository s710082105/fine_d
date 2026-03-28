import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearStoredCodexSession,
  loadStoredCodexSession,
  saveStoredCodexSession
} from '../lib/codex-session-storage'
import { createCodexTerminalStreamController } from '../components/terminal/codex-terminal-stream-controller'

type TerminalStatus = 'running' | 'closed' | 'failed'
type ReadStreamChunk = (_sessionId: string, _cursor: number) => Promise<TerminalChunk>
type TerminalEventListener = (event: Event | MessageEvent<string>) => void

interface TerminalChunk {
  readonly session_id: string
  readonly status: TerminalStatus
  readonly output: string
  readonly next_cursor: number
  readonly completed: boolean
}

class FakeEventSource {
  readonly close = vi.fn(() => { this.closed = true })
  private readonly listeners = new Map<string, TerminalEventListener[]>()
  closed = false
  constructor(readonly url: string) {}
  addEventListener(type: string, listener: TerminalEventListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  emit(type: 'terminal' | 'terminal_error', payload: unknown): void {
    const event = { data: JSON.stringify(payload) } as MessageEvent<string>
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event)
    }
  }
  emitNativeError(): void {
    for (const listener of this.listeners.get('error') ?? []) {
      listener(new Event('error'))
    }
  }
}

function createChunk(
  output: string,
  nextCursor: number,
  completed: boolean,
  options: { sessionId?: string; status?: TerminalStatus } = {}
): TerminalChunk {
  return {
    session_id: options.sessionId ?? 'terminal-session-1',
    status: options.status ?? 'running',
    output,
    next_cursor: nextCursor,
    completed
  }
}

function createTimerHarness() {
  let nextId = 1
  const scheduled: Array<{ readonly id: number; readonly callback: () => void; readonly delayMs: number }> = []
  return {
    scheduled,
    clearScheduledPoll: vi.fn(),
    schedulePoll: vi.fn((callback: () => void, delayMs: number) => {
      const id = nextId++
      scheduled.push({ id, callback, delayMs })
      return id
    })
  }
}

function createControllerHarness(options: {
  readStreamChunk?: ReturnType<typeof vi.fn<ReadStreamChunk>>
  createEventSource?: (url: string) => FakeEventSource
} = {}) {
  const sources: FakeEventSource[] = []
  const timers = createTimerHarness()
  const readStreamChunk = options.readStreamChunk ?? vi.fn<ReadStreamChunk>()
  const controller = createCodexTerminalStreamController({
    buildEventStreamUrl: (sessionId, cursor) => `/events/${sessionId}?cursor=${cursor}`,
    createEventSource: (url) => {
      const source = options.createEventSource?.(url) ?? new FakeEventSource(url)
      sources.push(source)
      return source
    },
    readStreamChunk,
    schedulePoll: timers.schedulePoll,
    clearScheduledPoll: timers.clearScheduledPoll
  })
  return { controller, readStreamChunk, sources, timers }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  sessionStorage.clear()
})

describe('createCodexTerminalStreamController', () => {
  it('forwards each SSE chunk through onChunk without accumulating output state', () => {
    const chunks: string[] = []
    const harness = createControllerHarness()
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })
    harness.sources[0].emit('terminal', createChunk('hello', 5, false))
    harness.sources[0].emit('terminal', createChunk(' world', 11, true))
    expect(chunks).toEqual(['hello', ' world'])
    expect(harness.controller.getCursor()).toBe(11)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 11
    })
    expect(harness.readStreamChunk).not.toHaveBeenCalled()
    expect(harness.timers.schedulePoll).not.toHaveBeenCalled()
  })

  it('ignores stale lifecycle chunks from an older SSE stream', () => {
    const chunks: string[] = []
    const harness = createControllerHarness()
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-stale',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })
    harness.sources[0].emit('terminal', createChunk('old', 3, false, { sessionId: 'terminal-session-stale' }))
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-2',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })
    harness.sources[0].emit('terminal', createChunk(' ignored', 99, false, { sessionId: 'terminal-session-stale' }))
    harness.sources[1].emit('terminal', createChunk('new', 3, true, { sessionId: 'terminal-session-2' }))
    expect(chunks).toEqual(['old', 'new'])
    expect(harness.sources[0].close).toHaveBeenCalledTimes(1)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-2',
      next_cursor: 3
    })
  })

  it('stops the stream and clears stored session state when backend reports a missing session', () => {
    const chunks: string[] = []
    const onMissingSession = vi.fn()
    const harness = createControllerHarness()
    saveStoredCodexSession({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 4
    })
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 4,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk),
      onMissingSession
    })
    harness.sources[0].emit('terminal_error', {
      code: 'codex.session_not_found',
      message: '终端会话不存在'
    })
    harness.sources[0].emit('terminal', createChunk('ignored', 9, true))
    expect(onMissingSession).toHaveBeenCalledTimes(1)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toBeNull()
    expect(chunks).toEqual([])
    expect(harness.sources[0].close).toHaveBeenCalledTimes(1)
  })

  it('reports native SSE transport errors and stops the active stream', () => {
    const onError = vi.fn()
    const harness = createControllerHarness()
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: vi.fn(),
      onError
    })
    harness.sources[0].emitNativeError()
    harness.sources[0].emit('terminal', createChunk('ignored', 3, false))
    expect(onError).toHaveBeenCalledWith('终端输出读取失败')
    expect(harness.sources[0].close).toHaveBeenCalledTimes(1)
    expect(harness.controller.getCursor()).toBe(0)
  })

  it('advances the polling cursor and only schedules the next read while still active', async () => {
    const harness = createControllerHarness({
      readStreamChunk: vi
        .fn<ReadStreamChunk>()
        .mockResolvedValueOnce(createChunk('hello', 5, false))
        .mockResolvedValueOnce(createChunk(' world', 11, false))
    })
    const chunks: string[] = []
    harness.controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 0,
      preferredTransport: 'polling',
      onChunk: (chunk) => chunks.push(chunk)
    })
    await flushPromises()
    expect(harness.readStreamChunk).toHaveBeenCalledWith('terminal-session-1', 0)
    expect(chunks).toEqual(['hello'])
    expect(harness.controller.getCursor()).toBe(5)
    expect(harness.timers.schedulePoll).toHaveBeenCalledTimes(1)
    expect(harness.timers.scheduled[0]?.delayMs).toBe(300)
    harness.timers.scheduled[0]?.callback()
    await flushPromises()
    expect(harness.readStreamChunk).toHaveBeenNthCalledWith(2, 'terminal-session-1', 5)
    expect(chunks).toEqual(['hello', ' world'])
    expect(harness.controller.getCursor()).toBe(11)
    expect(harness.timers.schedulePoll).toHaveBeenCalledTimes(2)
    harness.controller.stop()
    harness.timers.scheduled[1]?.callback()
    await flushPromises()
    expect(harness.readStreamChunk).toHaveBeenCalledTimes(2)
    expect(harness.timers.clearScheduledPoll).toHaveBeenCalledWith(2)
  })

  it.each(['onChunk', 'onStatus'] as const)(
    'does not schedule another polling read after %s stops the controller',
    async (stopHook) => {
      const harness = createControllerHarness({
        readStreamChunk: vi.fn<ReadStreamChunk>().mockResolvedValueOnce(createChunk('hello', 5, false))
      })
      harness.controller.start({
        projectPath: '/tmp/project-alpha',
        sessionId: 'terminal-session-1',
        cursor: 0,
        preferredTransport: 'polling',
        onChunk: () => stopHook === 'onChunk' && harness.controller.stop(),
        onStatus: () => stopHook === 'onStatus' && harness.controller.stop()
      })
      await flushPromises()
      expect(harness.readStreamChunk).toHaveBeenCalledTimes(1)
      expect(harness.timers.schedulePoll).not.toHaveBeenCalled()
    }
  )
})

describe('clearStoredCodexSession', () => {
  it('keeps the stored session when projectPath or sessionId does not match', () => {
    saveStoredCodexSession({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 7
    })
    clearStoredCodexSession('/tmp/other-project', 'terminal-session-1')
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 7
    })
    clearStoredCodexSession('/tmp/project-alpha', 'terminal-session-2')
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 7
    })
  })
})
