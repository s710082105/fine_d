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

function createState(
  status: TerminalConnectionStatus,
  errorMessage = ''
): TerminalConnectionState {
  return {
    status,
    errorMessage
  }
}

export function createTerminalConnectionState(): TerminalConnectionState {
  return createState('idle')
}

export function startBooting(
  _current = createTerminalConnectionState()
): TerminalConnectionState {
  return createState('booting')
}

export function markStreaming(
  _current = createTerminalConnectionState()
): TerminalConnectionState {
  return createState('streaming')
}

export function markClosed(
  _current = createTerminalConnectionState()
): TerminalConnectionState {
  return createState('closed')
}

export function markFailed(
  _current: TerminalConnectionState,
  errorMessage: string
): TerminalConnectionState {
  return createState('failed', errorMessage)
}
