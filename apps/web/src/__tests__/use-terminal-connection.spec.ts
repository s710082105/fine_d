import { describe, expect, it, vi } from 'vitest'

import {
  createTerminalConnectionState,
  markClosed,
  markFailed,
  markStreaming,
  startBooting
} from '../components/terminal/terminal-connection-state'
import { createTerminalConnection } from '../components/terminal/use-terminal-connection'
import { createApiError } from './codex-terminal-view.helpers'

function createChunk(
  output: string,
  nextCursor: number,
  completed: boolean,
  options: {
    readonly hasBacklog?: boolean
    readonly status?: 'running' | 'closed' | 'failed'
  } = {}
) {
  return {
    session_id: 'terminal-session-1',
    status: options.status ?? 'running',
    output,
    next_cursor: nextCursor,
    has_backlog: options.hasBacklog ?? false,
    completed
  }
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(() => resolve())
  })
}

function createConnectionHarness(
  overrides: {
    onChunk?: (chunk: string) => void | Promise<void>
    readStreamChunk?: ReturnType<typeof vi.fn>
    writeInput?: ReturnType<typeof vi.fn>
  } = {}
) {
  const chunks: string[] = []
  const statuses: string[] = []
  const missingSessions: string[] = []
  const errors: string[] = []
  const scheduledPolls: Array<() => void> = []
  const scheduledDelays: number[] = []
  const readStreamChunk = overrides.readStreamChunk ?? vi.fn()
  const writeInput = overrides.writeInput ?? vi.fn().mockResolvedValue(undefined)

  const connection = createTerminalConnection({
    readStreamChunk,
    writeInput,
    schedulePoll: (callback, delayMs) => {
      scheduledPolls.push(callback)
      scheduledDelays.push(delayMs)
      return scheduledPolls.length
    },
    clearScheduledPoll: vi.fn(),
    onChunk: overrides.onChunk ?? ((chunk) => {
      chunks.push(chunk)
    }),
    onStatus: (status) => {
      statuses.push(status)
    },
    onMissingSession: () => {
      missingSessions.push('lost')
    },
    onError: (message) => {
      errors.push(message)
    }
  })

  return {
    chunks,
    connection,
    errors,
    missingSessions,
    readStreamChunk,
    scheduledDelays,
    runNextPoll: async () => {
      const callback = scheduledPolls.shift()
      if (callback) {
        callback()
        await flushPromises()
        await flushPromises()
      }
    },
    scheduledPolls,
    statuses,
    writeInput
  }
}

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
    const failed = markFailed(
      startBooting(createTerminalConnectionState()),
      'read failed'
    )

    expect(failed.status).toBe('failed')
    expect(failed.errorMessage).toBe('read failed')
  })
})

describe('createTerminalConnection', () => {
  it('polls output chunks sequentially and advances cursor', async () => {
    const readStreamChunk = vi
      .fn()
      .mockResolvedValueOnce(createChunk('hello', 5, false))
      .mockResolvedValueOnce(
        createChunk(' world', 11, true, { status: 'closed' })
      )
    const harness = createConnectionHarness({ readStreamChunk })

    harness.connection.start({
      sessionId: 'terminal-session-1',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await flushPromises()
    await flushPromises()

    expect(readStreamChunk).toHaveBeenCalledWith('terminal-session-1', 0)
    expect(harness.chunks).toEqual(['hello'])

    await harness.runNextPoll()

    expect(readStreamChunk).toHaveBeenNthCalledWith(2, 'terminal-session-1', 5)
    expect(harness.chunks).toEqual(['hello', ' world'])
    expect(harness.statuses).toEqual(['booting', 'streaming', 'closed'])
  })

  it('stops polling after stop is called', async () => {
    const harness = createConnectionHarness({
      readStreamChunk: vi.fn().mockResolvedValue(createChunk('hello', 5, false))
    })

    harness.connection.start({
      sessionId: 'terminal-session-1',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await flushPromises()
    await flushPromises()
    harness.connection.stop()
    await harness.runNextPoll()

    expect(harness.readStreamChunk).toHaveBeenCalledTimes(1)
    expect(harness.statuses).toEqual(['booting', 'streaming', 'idle'])
  })

  it('reports missing sessions explicitly', async () => {
    const harness = createConnectionHarness({
      readStreamChunk: vi
        .fn()
        .mockRejectedValue(
          createApiError(
            'codex.session_not_found',
            '终端会话不存在',
            'codex_terminal',
            { session_id: 'terminal-session-1' }
          )
        )
    })

    harness.connection.start({
      sessionId: 'terminal-session-1',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await flushPromises()
    await flushPromises()

    expect(harness.missingSessions).toEqual(['lost'])
    expect(harness.errors).toEqual([])
  })

  it('writes input through the active session', async () => {
    const harness = createConnectionHarness()

    harness.connection.start({
      sessionId: 'terminal-session-9',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await harness.connection.write('pwd\r')

    expect(harness.writeInput).toHaveBeenCalledWith('terminal-session-9', 'pwd\r')
  })

  it('backs off polling after empty chunks and resets on new output', async () => {
    const readStreamChunk = vi
      .fn()
      .mockResolvedValueOnce(createChunk('', 0, false))
      .mockResolvedValueOnce(createChunk('', 0, false))
      .mockResolvedValueOnce(createChunk('ready', 5, false))
    const harness = createConnectionHarness({ readStreamChunk })

    harness.connection.start({
      sessionId: 'terminal-session-1',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await flushPromises()
    await harness.runNextPoll()
    await harness.runNextPoll()

    expect(harness.scheduledDelays).toEqual([600, 1000, 300])
    expect(harness.chunks).toEqual(['ready'])
  })

  it('drains buffered backlog immediately after the terminal finishes writing', async () => {
    let resolveChunk: (() => void) | null = null
    const readStreamChunk = vi
      .fn()
      .mockResolvedValueOnce(
        createChunk('x'.repeat(16384), 16384, false, { hasBacklog: true })
      )
      .mockResolvedValueOnce(createChunk('done', 16388, false))
    const harness = createConnectionHarness({
      onChunk: (chunk) => {
        harness.chunks.push(chunk)
        return new Promise<void>((resolve) => {
          resolveChunk = resolve
        })
      },
      readStreamChunk
    })

    harness.connection.start({
      sessionId: 'terminal-session-1',
      projectPath: '/tmp/project-alpha',
      cursor: 0
    })

    await flushPromises()

    expect(harness.scheduledDelays).toEqual([])

    ;(resolveChunk as (() => void) | null)?.()
    await flushPromises()

    expect(harness.scheduledDelays).toEqual([0])

    await harness.runNextPoll()

    expect(readStreamChunk).toHaveBeenNthCalledWith(2, 'terminal-session-1', 16384)
  })
})
