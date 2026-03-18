import type {
  RefreshSessionContextRequest,
  SessionStreamEvent,
  StartSessionRequest,
  StartSessionResponse
} from '../../lib/types/session'

type InvokeFn = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type ListenFn = <T>(
  event: string,
  callback: (event: { payload: T }) => void
) => Promise<() => void>

export type ChatPanelServices = {
  startSession: (request: StartSessionRequest) => Promise<StartSessionResponse>
  subscribe: (
    callback: (event: SessionStreamEvent) => void
  ) => Promise<() => void> | (() => void)
  refreshContext: (request: RefreshSessionContextRequest) => Promise<void>
  interruptSession: (sessionId: string) => Promise<void>
}

const SESSION_EVENT_TOPIC = 'session://event'

export function resolveTauriServices(): ChatPanelServices {
  const candidate = (
    window as { __TAURI__?: { core?: { invoke?: InvokeFn }; event?: { listen?: ListenFn } } }
  ).__TAURI__
  if (!candidate?.core?.invoke || !candidate?.event?.listen) {
    throw new Error('Tauri session APIs are unavailable in this runtime')
  }

  const invoke = candidate.core.invoke as InvokeFn
  const listen = candidate.event.listen as ListenFn

  return {
    startSession: (request) => invoke<StartSessionResponse>('start_session', { request }),
    subscribe: async (callback) => {
      return listen<SessionStreamEvent>(SESSION_EVENT_TOPIC, (event) => callback(event.payload))
    },
    refreshContext: async (request) =>
      invoke<void>('refresh_session_context_command', { request }),
    interruptSession: async (sessionId) =>
      invoke<void>('interrupt_session_command', { request: { session_id: sessionId } })
  }
}
