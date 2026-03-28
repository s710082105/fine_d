import { clearStoredCodexSession, saveStoredCodexSession } from '../../lib/codex-session-storage'
import type { CodexTerminalStatus, CodexTerminalStreamResponse } from '../../lib/types'
import {
  DEFAULT_STREAM_ERROR, createCallbacks, formatStreamError, isMissingSessionError, parseEventPayload
} from './codex-terminal-stream-controller-helpers'
import type { CodexTerminalCallbacks } from './codex-terminal-stream-controller-helpers'
const POLL_INTERVAL_MS = 300
const TERMINAL_EVENT_NAME = 'terminal'
const TERMINAL_ERROR_EVENT_NAME = 'terminal_error'
const SSE_ERROR_EVENT_NAME = 'error'
export type CodexTerminalTransport = 'idle' | 'sse' | 'polling'
export type CodexTerminalPreferredTransport = 'sse' | 'polling'
export type CodexTerminalEvent = Event | MessageEvent<string>
export interface CodexTerminalEventSource {
  addEventListener(type: string, listener: (event: CodexTerminalEvent) => void): void
  close(): void
}
export interface CodexTerminalStreamControllerDeps {
  buildEventStreamUrl(sessionId: string, cursor: number): string
  createEventSource(url: string): CodexTerminalEventSource
  readStreamChunk(sessionId: string, cursor: number): Promise<CodexTerminalStreamResponse>
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
interface CodexTerminalControllerRuntime {
  readonly deps: CodexTerminalStreamControllerDeps
  readonly state: CodexTerminalStreamState
  activeProjectPath: string | null
  eventSource: CodexTerminalEventSource | null
  pollTimerId: number | null
  callbacks: CodexTerminalCallbacks
}
export function createCodexTerminalStreamController(
  deps: CodexTerminalStreamControllerDeps
): CodexTerminalStreamController {
  const runtime = createRuntime(deps)
  return {
    start: (options) => startController(runtime, options),
    stop: () => stopController(runtime),
    bumpLifecycle: () => bumpLifecycle(runtime),
    getCursor: () => runtime.state.cursor
  }
}

function createRuntime(deps: CodexTerminalStreamControllerDeps): CodexTerminalControllerRuntime {
  return {
    deps,
    state: { sessionId: null, cursor: 0, transport: 'idle', lifecycleId: 0, stopped: true },
    activeProjectPath: null,
    eventSource: null,
    pollTimerId: null,
    callbacks: createCallbacks()
  }
}

function startController(
  runtime: CodexTerminalControllerRuntime,
  options: CodexTerminalStreamStartOptions
): void {
  const lifecycleId = bumpLifecycle(runtime)
  runtime.activeProjectPath = options.projectPath
  runtime.state.sessionId = options.sessionId
  runtime.state.cursor = options.cursor
  runtime.state.transport = options.preferredTransport
  runtime.state.stopped = false
  runtime.callbacks = createCallbacks(options)
  if (options.preferredTransport === 'sse') {
    startSseStream(runtime, options.sessionId, lifecycleId)
    return
  }
  void readPollingChunk(runtime, options.sessionId, lifecycleId)
}

function stopController(runtime: CodexTerminalControllerRuntime): void {
  stopTransport(runtime)
  runtime.state.sessionId = null
  runtime.state.transport = 'idle'
  runtime.state.stopped = true
}

function bumpLifecycle(runtime: CodexTerminalControllerRuntime): number {
  runtime.state.lifecycleId += 1
  stopController(runtime)
  return runtime.state.lifecycleId
}

function startSseStream(
  runtime: CodexTerminalControllerRuntime,
  sessionId: string,
  lifecycleId: number
): void {
  const source = runtime.deps.createEventSource(
    runtime.deps.buildEventStreamUrl(sessionId, runtime.state.cursor)
  )
  runtime.eventSource = source
  source.addEventListener(TERMINAL_EVENT_NAME, (event) => {
    handleSseChunkEvent(runtime, source, sessionId, lifecycleId, event)
  })
  source.addEventListener(TERMINAL_ERROR_EVENT_NAME, (event) => {
    handleSsePayloadError(runtime, source, sessionId, lifecycleId, event)
  })
  source.addEventListener(SSE_ERROR_EVENT_NAME, () => {
    handleSseTransportError(runtime, source, sessionId, lifecycleId)
  })
}

function handleSseChunkEvent(
  runtime: CodexTerminalControllerRuntime,
  source: CodexTerminalEventSource,
  sessionId: string,
  lifecycleId: number,
  event: CodexTerminalEvent
): void {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    closeEventSource(runtime, source)
    return
  }
  try {
    const chunk = parseEventPayload<CodexTerminalStreamResponse>(event)
    acceptChunk(runtime, sessionId, lifecycleId, chunk)
    if (!chunk.completed) {
      return
    }
    closeEventSource(runtime, source)
    runtime.state.transport = 'idle'
  } catch (error) {
    handleStreamError(runtime, sessionId, lifecycleId, error)
  }
}

function handleSsePayloadError(
  runtime: CodexTerminalControllerRuntime,
  source: CodexTerminalEventSource,
  sessionId: string,
  lifecycleId: number,
  event: CodexTerminalEvent
): void {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    closeEventSource(runtime, source)
    return
  }
  try {
    handleStreamError(runtime, sessionId, lifecycleId, parseEventPayload<unknown>(event))
  } catch (error) {
    handleStreamError(runtime, sessionId, lifecycleId, error)
  }
}

function handleSseTransportError(
  runtime: CodexTerminalControllerRuntime,
  source: CodexTerminalEventSource,
  sessionId: string,
  lifecycleId: number
): void {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    closeEventSource(runtime, source)
    return
  }
  handleStreamError(runtime, sessionId, lifecycleId, new Error(DEFAULT_STREAM_ERROR))
}

async function readPollingChunk(
  runtime: CodexTerminalControllerRuntime,
  sessionId: string,
  lifecycleId: number
): Promise<void> {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    return
  }
  try {
    const chunk = await runtime.deps.readStreamChunk(sessionId, runtime.state.cursor)
    if (!isActive(runtime, sessionId, lifecycleId)) {
      return
    }
    acceptChunk(runtime, sessionId, lifecycleId, chunk)
    if (!isActive(runtime, sessionId, lifecycleId)) {
      return
    }
    if (chunk.completed) {
      runtime.state.transport = 'idle'
      return
    }
    runtime.pollTimerId = runtime.deps.schedulePoll(() => {
      void readPollingChunk(runtime, sessionId, lifecycleId)
    }, POLL_INTERVAL_MS)
  } catch (error) {
    handleStreamError(runtime, sessionId, lifecycleId, error)
  }
}

function acceptChunk(
  runtime: CodexTerminalControllerRuntime,
  sessionId: string,
  lifecycleId: number,
  chunk: CodexTerminalStreamResponse
): void {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    return
  }
  runtime.state.cursor = chunk.next_cursor
  if (chunk.output) {
    runtime.callbacks.onChunk(chunk.output)
  }
  runtime.callbacks.onStatus(chunk.status)
  saveActiveSession(runtime, sessionId)
}

function handleStreamError(
  runtime: CodexTerminalControllerRuntime,
  sessionId: string,
  lifecycleId: number,
  error: unknown
): void {
  if (!isActive(runtime, sessionId, lifecycleId)) {
    return
  }
  if (isMissingSessionError(error)) {
    const activeSessionId = runtime.state.sessionId
    stopController(runtime)
    if (runtime.activeProjectPath && activeSessionId) {
      clearStoredCodexSession(runtime.activeProjectPath, activeSessionId)
    }
    runtime.callbacks.onMissingSession()
    return
  }
  stopController(runtime)
  runtime.callbacks.onError(formatStreamError(error))
}

function saveActiveSession(runtime: CodexTerminalControllerRuntime, sessionId: string): void {
  if (!runtime.activeProjectPath) {
    return
  }
  saveStoredCodexSession({
    project_path: runtime.activeProjectPath,
    session_id: sessionId,
    next_cursor: runtime.state.cursor
  })
}

function isActive(
  runtime: CodexTerminalControllerRuntime,
  sessionId: string,
  lifecycleId: number
): boolean {
  return !runtime.state.stopped
    && runtime.state.lifecycleId === lifecycleId
    && runtime.state.sessionId === sessionId
}

function stopTransport(runtime: CodexTerminalControllerRuntime): void {
  if (runtime.pollTimerId !== null) {
    runtime.deps.clearScheduledPoll(runtime.pollTimerId)
    runtime.pollTimerId = null
  }
  if (runtime.eventSource) {
    runtime.eventSource.close()
    runtime.eventSource = null
  }
}

function closeEventSource(
  runtime: CodexTerminalControllerRuntime,
  source: CodexTerminalEventSource
): void {
  if (runtime.eventSource !== source) {
    return
  }
  source.close()
  runtime.eventSource = null
}
