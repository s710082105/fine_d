import type { CodexTerminalStatus } from '../../lib/types'

export const DEFAULT_STREAM_ERROR = '终端输出读取失败'
const MISSING_SESSION_CODE = 'codex.session_not_found'

export interface CodexTerminalCallbacks {
  onChunk(output: string): void
  onStatus(status: CodexTerminalStatus): void
  onError(message: string): void
  onMissingSession(): void
}

export interface CodexTerminalCallbackOptions {
  readonly onChunk?: (output: string) => void
  readonly onStatus?: (status: CodexTerminalStatus) => void
  readonly onError?: (message: string) => void
  readonly onMissingSession?: () => void
}

export function createCallbacks(
  options: CodexTerminalCallbackOptions = {}
): CodexTerminalCallbacks {
  return {
    onChunk: options.onChunk ?? (() => undefined),
    onStatus: options.onStatus ?? (() => undefined),
    onError: options.onError ?? (() => undefined),
    onMissingSession: options.onMissingSession ?? (() => undefined)
  }
}

export function parseEventPayload<T>(event: Event | MessageEvent<string>): T {
  return JSON.parse((event as MessageEvent<string>).data) as T
}

export function isMissingSessionError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === MISSING_SESSION_CODE
}

export function formatStreamError(error: unknown): string {
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
  return error instanceof Error ? error.message : DEFAULT_STREAM_ERROR
}
