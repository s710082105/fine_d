import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadStoredCodexSession, saveStoredCodexSession } from '../lib/codex-session-storage'
import { createCodexTerminalStreamController } from '../components/terminal/codex-terminal-stream-controller'
type TerminalStatus = 'running' | 'closed' | 'failed'
interface TerminalChunk {
  readonly session_id: string
  readonly status: TerminalStatus
  readonly output: string
  readonly next_cursor: number
  readonly completed: boolean
}

interface TerminalErrorPayload { readonly code?: string; readonly message?: string }
type TerminalEventListener = (event: MessageEvent<string>) => void
class FakeEventSource {
  readonly close = vi.fn(() => {
    this.closed = true
  })
  private readonly listeners = new Map<string, TerminalEventListener[]>()
  closed = false
  constructor(readonly url: string) {}
  addEventListener(type: string, listener: TerminalEventListener): void {
    const registered = this.listeners.get(type) ?? []
    registered.push(listener)
    this.listeners.set(type, registered)
  }
  emit(type: 'terminal' | 'terminal_error', payload: unknown): void {
    const listeners = this.listeners.get(type) ?? []
    const event = { data: JSON.stringify(payload) } as MessageEvent<string>
    for (const listener of listeners) {
      listener(event)
    }
  }
}
function createChunk(
  output: string,
  nextCursor: number,
  completed: boolean,
  options: {
    sessionId?: string
    status?: TerminalStatus
  } = {}
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
  const scheduled: Array<{
    readonly id: number
    readonly callback: () => void
    readonly delayMs: number
  }> = []
  const cleared: number[] = []
  return {
    cleared,
    scheduled,
    clearScheduledPoll: vi.fn((id: number) => {
      cleared.push(id)
    }),
    schedulePoll: vi.fn((callback: () => void, delayMs: number) => {
      const id = nextId
      nextId += 1
      scheduled.push({ id, callback, delayMs })
      return id
    })
  }
}
async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}
afterEach(() => {
  sessionStorage.clear()
})
describe('createCodexTerminalStreamController', () => {
  it('forwards each SSE chunk through onChunk without accumulating output state', async () => {
    const chunks: string[] = []
    const sources: FakeEventSource[] = []
    const timers = createTimerHarness()
    const readStreamChunk = vi.fn<(_: string, __: number) => Promise<TerminalChunk>>()
    const controller = createCodexTerminalStreamController({
      buildEventStreamUrl: (sessionId, cursor) =>
        `/events/${sessionId}?cursor=${cursor}`,
      createEventSource: (url) => {
        const source = new FakeEventSource(url)
        sources.push(source)
        return source
      },
      readStreamChunk,
      schedulePoll: timers.schedulePoll,
      clearScheduledPoll: timers.clearScheduledPoll
    })

    controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })

    sources[0].emit('terminal', createChunk('hello', 5, false))
    sources[0].emit('terminal', createChunk(' world', 11, true))
    expect(chunks).toEqual(['hello', ' world'])
    expect(controller.getCursor()).toBe(11)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 11
    })
    expect(readStreamChunk).not.toHaveBeenCalled()
    expect(timers.schedulePoll).not.toHaveBeenCalled()
  })

  it('ignores stale lifecycle chunks from an older SSE stream', () => {
    const chunks: string[] = []
    const sources: FakeEventSource[] = []
    const controller = createCodexTerminalStreamController({
      buildEventStreamUrl: (sessionId, cursor) =>
        `/events/${sessionId}?cursor=${cursor}`,
      createEventSource: (url) => {
        const source = new FakeEventSource(url)
        sources.push(source)
        return source
      },
      readStreamChunk: vi.fn(),
      schedulePoll: vi.fn(),
      clearScheduledPoll: vi.fn()
    })

    controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-stale',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })
    sources[0].emit('terminal', createChunk('old', 3, false, {
      sessionId: 'terminal-session-stale'
    }))
    controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-2',
      cursor: 0,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk)
    })

    sources[0].emit('terminal', createChunk(' ignored', 99, false, {
      sessionId: 'terminal-session-stale'
    }))
    sources[1].emit('terminal', createChunk('new', 3, true, {
      sessionId: 'terminal-session-2'
    }))
    expect(chunks).toEqual(['old', 'new'])
    expect(sources[0].close).toHaveBeenCalledTimes(1)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-2',
      next_cursor: 3
    })
  })

  it('stops the stream and clears stored session state when backend reports a missing session', () => {
    const chunks: string[] = []
    const sources: FakeEventSource[] = []
    const onMissingSession = vi.fn()
    const controller = createCodexTerminalStreamController({
      buildEventStreamUrl: (sessionId, cursor) =>
        `/events/${sessionId}?cursor=${cursor}`,
      createEventSource: (url) => {
        const source = new FakeEventSource(url)
        sources.push(source)
        return source
      },
      readStreamChunk: vi.fn(),
      schedulePoll: vi.fn(),
      clearScheduledPoll: vi.fn()
    })

    saveStoredCodexSession({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 4
    })
    controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 4,
      preferredTransport: 'sse',
      onChunk: (chunk) => chunks.push(chunk),
      onMissingSession
    })

    sources[0].emit('terminal_error', {
      code: 'codex.session_not_found',
      message: '终端会话不存在'
    } satisfies TerminalErrorPayload)
    sources[0].emit('terminal', createChunk('ignored', 9, true))
    expect(onMissingSession).toHaveBeenCalledTimes(1)
    expect(loadStoredCodexSession('/tmp/project-alpha')).toBeNull()
    expect(chunks).toEqual([])
    expect(sources[0].close).toHaveBeenCalledTimes(1)
  })
  it('advances the polling cursor and only schedules the next read while still active', async () => {
    const chunks: string[] = []
    const timers = createTimerHarness()
    const readStreamChunk = vi
      .fn<(_: string, __: number) => Promise<TerminalChunk>>()
      .mockResolvedValueOnce(createChunk('hello', 5, false))
      .mockResolvedValueOnce(createChunk(' world', 11, false))
    const controller = createCodexTerminalStreamController({
      buildEventStreamUrl: (sessionId, cursor) =>
        `/events/${sessionId}?cursor=${cursor}`,
      createEventSource: vi.fn(),
      readStreamChunk,
      schedulePoll: timers.schedulePoll,
      clearScheduledPoll: timers.clearScheduledPoll
    })

    controller.start({
      projectPath: '/tmp/project-alpha',
      sessionId: 'terminal-session-1',
      cursor: 0,
      preferredTransport: 'polling',
      onChunk: (chunk) => chunks.push(chunk)
    })
    await flushPromises()
    expect(readStreamChunk).toHaveBeenCalledWith('terminal-session-1', 0)
    expect(chunks).toEqual(['hello'])
    expect(controller.getCursor()).toBe(5)
    expect(timers.schedulePoll).toHaveBeenCalledTimes(1)
    expect(timers.scheduled[0]?.delayMs).toBe(300)
    timers.scheduled[0]?.callback()
    await flushPromises()
    expect(readStreamChunk).toHaveBeenNthCalledWith(2, 'terminal-session-1', 5)
    expect(chunks).toEqual(['hello', ' world'])
    expect(controller.getCursor()).toBe(11)
    expect(timers.schedulePoll).toHaveBeenCalledTimes(2)
    controller.stop()
    timers.scheduled[1]?.callback()
    await flushPromises()
    expect(readStreamChunk).toHaveBeenCalledTimes(2)
    expect(timers.clearScheduledPoll).toHaveBeenCalledWith(2)
  })

  it.each(['onChunk', 'onStatus'] as const)(
    'does not schedule another polling read after %s stops the controller',
    async (stopHook) => {
      const timers = createTimerHarness()
      const readStreamChunk = vi
        .fn<(_: string, __: number) => Promise<TerminalChunk>>()
        .mockResolvedValueOnce(createChunk('hello', 5, false))
      const controller = createCodexTerminalStreamController({
        buildEventStreamUrl: (sessionId, cursor) =>
          `/events/${sessionId}?cursor=${cursor}`,
        createEventSource: vi.fn(),
        readStreamChunk,
        schedulePoll: timers.schedulePoll,
        clearScheduledPoll: timers.clearScheduledPoll
      })
      controller.start({
        projectPath: '/tmp/project-alpha',
        sessionId: 'terminal-session-1',
        cursor: 0,
        preferredTransport: 'polling',
        onChunk: () => {
          if (stopHook === 'onChunk') {
            controller.stop()
          }
        },
        onStatus: () => {
          if (stopHook === 'onStatus') {
            controller.stop()
          }
        }
      })
      await flushPromises()
      expect(readStreamChunk).toHaveBeenCalledTimes(1)
      expect(timers.schedulePoll).not.toHaveBeenCalled()
    }
  )
})
