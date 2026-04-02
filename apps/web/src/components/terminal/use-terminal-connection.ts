import { clearStoredCodexSession, saveStoredCodexSession } from '../../lib/codex-session-storage'
import type { CodexTerminalStreamResponse } from '../../lib/types'
import type { TerminalConnectionStatus } from './terminal-connection-state'

const POLL_INTERVAL_MS = 300
const BACKLOG_POLL_INTERVAL_MS = 0
const IDLE_POLL_INTERVAL_STEPS = [600, 1000, 1500] as const
const MISSING_SESSION_CODE = 'codex.session_not_found'

export interface TerminalConnectionStartOptions {
  readonly sessionId: string
  readonly projectPath: string
  readonly cursor: number
}

export interface TerminalConnectionDeps {
  readStreamChunk(
    sessionId: string,
    cursor: number
  ): Promise<CodexTerminalStreamResponse>
  writeInput(sessionId: string, data: string): Promise<unknown>
  schedulePoll(callback: () => void, delayMs: number): number
  clearScheduledPoll(timerId: number): void
  onChunk(chunk: string): void | Promise<void>
  onStatus(status: TerminalConnectionStatus): void
  onMissingSession(): void
  onError(message: string): void
}

export interface TerminalConnection {
  start(options: TerminalConnectionStartOptions): void
  stop(): void
  write(data: string): Promise<void>
  getCursor(): number
}

interface TerminalConnectionRuntime {
  sessionId: string | null
  projectPath: string
  cursor: number
  idlePollCount: number
  pollTimerId: number | null
  stopped: boolean
}

export function createTerminalConnection(
  deps: TerminalConnectionDeps
): TerminalConnection {
  const runtime = createRuntime()

  async function readNext(): Promise<void> {
    if (!hasActiveSession(runtime)) {
      return
    }
    const sessionId = runtime.sessionId
    try {
      const chunk = await deps.readStreamChunk(sessionId, runtime.cursor)
      if (!isActiveSession(runtime, sessionId)) {
        return
      }
      await acceptChunk(deps, runtime, chunk)
      if (!isActiveSession(runtime, sessionId)) {
        return
      }
      if (chunk.completed) {
        return
      }
      runtime.pollTimerId = deps.schedulePoll(() => {
        void readNext()
      }, nextPollDelay(runtime, chunk))
    } catch (error) {
      handleReadError(deps, runtime, sessionId, error)
    }
  }

  return {
    start(options) {
      stopConnection(deps, runtime)
      runtime.sessionId = options.sessionId
      runtime.projectPath = options.projectPath
      runtime.cursor = options.cursor
      runtime.idlePollCount = 0
      runtime.stopped = false
      persistCursor(runtime)
      deps.onStatus('booting')
      void readNext()
    },
    stop() {
      stopConnection(deps, runtime)
      deps.onStatus('idle')
    },
    async write(data) {
      if (!hasActiveSession(runtime)) {
        return
      }
      try {
        await deps.writeInput(runtime.sessionId, data)
      } catch (error) {
        deps.onStatus('failed')
        deps.onError(formatConnectionError(error))
        throw error
      }
    },
    getCursor() {
      return runtime.cursor
    }
  }
}

function createRuntime(): TerminalConnectionRuntime {
  return {
    sessionId: null,
    projectPath: '',
    cursor: 0,
    idlePollCount: 0,
    pollTimerId: null,
    stopped: true
  }
}

async function acceptChunk(
  deps: TerminalConnectionDeps,
  runtime: TerminalConnectionRuntime,
  chunk: CodexTerminalStreamResponse
): Promise<void> {
  runtime.cursor = chunk.next_cursor
  runtime.idlePollCount = chunk.output ? 0 : runtime.idlePollCount + 1
  persistCursor(runtime)
  if (chunk.output) {
    await deps.onChunk(chunk.output)
  }
  deps.onStatus(chunk.status === 'running' ? 'streaming' : chunk.status)
}

function handleReadError(
  deps: TerminalConnectionDeps,
  runtime: TerminalConnectionRuntime,
  sessionId: string,
  error: unknown
): void {
  if (!isActiveSession(runtime, sessionId)) {
    return
  }
  if (isMissingSessionError(error)) {
    const projectPath = runtime.projectPath
    stopConnection(deps, runtime)
    clearStoredCodexSession(projectPath, sessionId)
    deps.onMissingSession()
    return
  }
  stopConnection(deps, runtime)
  deps.onStatus('failed')
  deps.onError(formatConnectionError(error))
}

function stopConnection(
  deps: TerminalConnectionDeps,
  runtime: TerminalConnectionRuntime
): void {
  if (runtime.pollTimerId !== null) {
    deps.clearScheduledPoll(runtime.pollTimerId)
    runtime.pollTimerId = null
  }
  runtime.sessionId = null
  runtime.projectPath = ''
  runtime.idlePollCount = 0
  runtime.stopped = true
}

function nextPollDelay(
  runtime: TerminalConnectionRuntime,
  chunk: CodexTerminalStreamResponse
): number {
  if (chunk.has_backlog) {
    return BACKLOG_POLL_INTERVAL_MS
  }
  if (runtime.idlePollCount === 0) {
    return POLL_INTERVAL_MS
  }
  const index = Math.min(
    runtime.idlePollCount - 1,
    IDLE_POLL_INTERVAL_STEPS.length - 1
  )
  return IDLE_POLL_INTERVAL_STEPS[index] ?? POLL_INTERVAL_MS
}

function persistCursor(runtime: TerminalConnectionRuntime): void {
  if (!hasActiveSession(runtime) || !runtime.projectPath) {
    return
  }
  saveStoredCodexSession({
    project_path: runtime.projectPath,
    session_id: runtime.sessionId,
    next_cursor: runtime.cursor
  })
}

function hasActiveSession(runtime: TerminalConnectionRuntime): runtime is TerminalConnectionRuntime & {
  sessionId: string
} {
  return !runtime.stopped && typeof runtime.sessionId === 'string'
}

function isActiveSession(
  runtime: TerminalConnectionRuntime,
  sessionId: string
): boolean {
  return hasActiveSession(runtime) && runtime.sessionId === sessionId
}

function isMissingSessionError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === MISSING_SESSION_CODE
}

function formatConnectionError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return `${error.code}: ${error.message}`
  }
  return error instanceof Error ? error.message : '终端输出读取失败'
}
