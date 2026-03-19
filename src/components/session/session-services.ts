import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type {
  RefreshSessionContextRequest,
  SendSessionMessageRequest,
  SendSessionMessageResponse,
  SessionStreamEvent,
  StartSessionRequest,
  StartSessionResponse
} from '../../lib/types/session'

type CodexInstallStatus = {
  installed: boolean
}

export type ChatPanelServices = {
  checkCodexInstallation: () => Promise<boolean>
  startSession: (request: StartSessionRequest) => Promise<StartSessionResponse>
  sendSessionMessage: (
    request: SendSessionMessageRequest
  ) => Promise<SendSessionMessageResponse>
  subscribe: (
    callback: (event: SessionStreamEvent) => void
  ) => Promise<() => void> | (() => void)
  refreshContext: (request: RefreshSessionContextRequest) => Promise<void>
  interruptSession: (sessionId: string) => Promise<void>
}

const SESSION_EVENT_TOPIC = 'session://event'

export function resolveTauriServices(): ChatPanelServices {
  return {
    checkCodexInstallation: async () => {
      const result = await invoke<CodexInstallStatus>('check_codex_installation')
      return result.installed
    },
    startSession: (request) => invoke<StartSessionResponse>('start_session', { request }),
    sendSessionMessage: (request) =>
      invoke<SendSessionMessageResponse>('send_session_message_command', { request }),
    subscribe: async (callback) => {
      return listen<SessionStreamEvent>(SESSION_EVENT_TOPIC, (event) => callback(event.payload))
    },
    refreshContext: async (request) =>
      invoke<void>('refresh_session_context_command', { request }),
    interruptSession: async (sessionId) =>
      invoke<void>('interrupt_session_command', { request: { session_id: sessionId } })
  }
}
