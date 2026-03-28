import {
  clearStoredCodexSession,
  saveStoredCodexSession
} from '../../lib/codex-session-storage'
import type {
  CodexTerminalStatus,
  CodexTerminalStreamResponse
} from '../../lib/types'
const POLL_INTERVAL_MS = 300
const TERMINAL_EVENT_NAME = 'terminal'
const TERMINAL_ERROR_EVENT_NAME = 'terminal_error'
const MISSING_SESSION_CODE = 'codex.session_not_found'
const DEFAULT_STREAM_ERROR = '终端输出读取失败'
export type CodexTerminalTransport = 'idle' | 'sse' | 'polling'
export type CodexTerminalPreferredTransport = 'sse' | 'polling'
export interface CodexTerminalEventSource {
  addEventListener(
    type: string,
    listener: (event: MessageEvent<string>) => void
  ): void
  close(): void
}
export interface CodexTerminalStreamControllerDeps {
  buildEventStreamUrl(sessionId: string, cursor: number): string
  createEventSource(url: string): CodexTerminalEventSource
  readStreamChunk(
    sessionId: string,
    cursor: number
  ): Promise<CodexTerminalStreamResponse>
  schedulePoll(callback: () => void, delayMs: number): number
  clearScheduledPoll(timerId: number): void
}
export interface CodexTerminalStreamStartOptions {
  readonly projectPath: string
  readonly sessionId: string
  readonly cursor: number
  readonly preferredTransport: CodexTerminalPreferredTransport
  readonly onChunk: (output: string) => void
  readonly onStatus?: (status: CodexTerminalStatus) => void
  readonly onError?: (message: string) => void
  readonly onMissingSession?: () => void
}
export interface CodexTerminalStreamController {
  start(options: CodexTerminalStreamStartOptions): void
  stop(): void
  bumpLifecycle(): number
  getCursor(): number
}
interface CodexTerminalStreamState {
  sessionId: string | null
  cursor: number
  transport: CodexTerminalTransport
  lifecycleId: number
  stopped: boolean
}

interface CodexTerminalCallbacks {
  onChunk(output: string): void
  onStatus(status: CodexTerminalStatus): void
  onError(message: string): void
  onMissingSession(): void
}

export function createCodexTerminalStreamController(
  deps: CodexTerminalStreamControllerDeps
): CodexTerminalStreamController {
  const state: CodexTerminalStreamState = {
    sessionId: null,
    cursor: 0,
    transport: 'idle',
    lifecycleId: 0,
    stopped: true
  }
  let activeProjectPath: string | null = null
  let eventSource: CodexTerminalEventSource | null = null
  let pollTimerId: number | null = null
  let callbacks = createCallbacks()

  function start(options: CodexTerminalStreamStartOptions): void {
    const lifecycleId = bumpLifecycle()
    activeProjectPath = options.projectPath
    state.sessionId = options.sessionId
    state.cursor = options.cursor
    state.transport = options.preferredTransport
    state.stopped = false
    callbacks = createCallbacks(options)
    if (options.preferredTransport === 'sse') {
      startSse(options.sessionId, lifecycleId)
      return
    }
    void readPollingChunk(options.sessionId, lifecycleId)
  }

  function stop(): void {
    stopTransport()
    state.sessionId = null
    state.transport = 'idle'
    state.stopped = true
  }

  function bumpLifecycle(): number {
    state.lifecycleId += 1
    stop()
    return state.lifecycleId
  }

  function getCursor(): number {
    return state.cursor
  }

  function startSse(sessionId: string, lifecycleId: number): void {
    const source = deps.createEventSource(
      deps.buildEventStreamUrl(sessionId, state.cursor)
    )
    eventSource = source
    source.addEventListener(TERMINAL_EVENT_NAME, (event) => {
      if (!isActive(sessionId, lifecycleId)) {
        closeEventSource(source)
        return
      }
      try {
        const chunk = parseEventPayload<CodexTerminalStreamResponse>(event)
        acceptChunk(sessionId, lifecycleId, chunk)
        if (chunk.completed) {
          closeEventSource(source)
          state.transport = 'idle'
        }
      } catch (error) {
        handleStreamError(sessionId, lifecycleId, error)
      }
    })
    source.addEventListener(TERMINAL_ERROR_EVENT_NAME, (event) => {
      if (!isActive(sessionId, lifecycleId)) {
        closeEventSource(source)
        return
      }
      try {
        handleStreamError(
          sessionId,
          lifecycleId,
          parseEventPayload<unknown>(event)
        )
      } catch (error) {
        handleStreamError(sessionId, lifecycleId, error)
      }
    })
  }

  async function readPollingChunk(
    sessionId: string,
    lifecycleId: number
  ): Promise<void> {
    if (!isActive(sessionId, lifecycleId)) {
      return
    }
    try {
      const chunk = await deps.readStreamChunk(sessionId, state.cursor)
      if (!isActive(sessionId, lifecycleId)) {
        return
      }
      acceptChunk(sessionId, lifecycleId, chunk)
      if (chunk.completed) {
        state.transport = 'idle'
        return
      }
      pollTimerId = deps.schedulePoll(() => {
        void readPollingChunk(sessionId, lifecycleId)
      }, POLL_INTERVAL_MS)
    } catch (error) {
      handleStreamError(sessionId, lifecycleId, error)
    }
  }

  function acceptChunk(
    sessionId: string,
    lifecycleId: number,
    chunk: CodexTerminalStreamResponse
  ): void {
    if (!isActive(sessionId, lifecycleId)) {
      return
    }
    state.cursor = chunk.next_cursor
    if (chunk.output) {
      callbacks.onChunk(chunk.output)
    }
    callbacks.onStatus(chunk.status)
    saveActiveSession(sessionId)
  }

  function handleStreamError(
    sessionId: string,
    lifecycleId: number,
    error: unknown
  ): void {
    if (!isActive(sessionId, lifecycleId)) {
      return
    }
    if (isMissingSessionError(error)) {
      const activeSessionId = state.sessionId
      stop()
      if (activeProjectPath && activeSessionId) {
        clearStoredCodexSession(activeProjectPath, activeSessionId)
      }
      callbacks.onMissingSession()
      return
    }
    stop()
    callbacks.onError(formatStreamError(error))
  }

  function saveActiveSession(sessionId: string): void {
    if (!activeProjectPath) {
      return
    }
    saveStoredCodexSession({
      project_path: activeProjectPath,
      session_id: sessionId,
      next_cursor: state.cursor
    })
  }

  function isActive(sessionId: string, lifecycleId: number): boolean {
    return (
      !state.stopped &&
      state.lifecycleId === lifecycleId &&
      state.sessionId === sessionId
    )
  }

  function stopTransport(): void {
    if (pollTimerId !== null) {
      deps.clearScheduledPoll(pollTimerId)
      pollTimerId = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  function closeEventSource(source: CodexTerminalEventSource): void {
    if (eventSource !== source) {
      return
    }
    source.close()
    eventSource = null
  }

  return {
    start,
    stop,
    bumpLifecycle,
    getCursor
  }
}

function createCallbacks(
  options: Partial<CodexTerminalStreamStartOptions> = {}
): CodexTerminalCallbacks {
  return {
    onChunk: options.onChunk ?? (() => undefined),
    onStatus: options.onStatus ?? (() => undefined),
    onError: options.onError ?? (() => undefined),
    onMissingSession: options.onMissingSession ?? (() => undefined)
  }
}

function parseEventPayload<T>(event: MessageEvent<string>): T {
  return JSON.parse(event.data) as T
}

function isMissingSessionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === MISSING_SESSION_CODE
  )
}

function formatStreamError(error: unknown): string {
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
  if (error instanceof Error) {
    return error.message
  }
  return DEFAULT_STREAM_ERROR
}
