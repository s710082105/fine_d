import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  CloseTerminalSessionRequest,
  CreateTerminalSessionRequest,
  CreateTerminalSessionResponse,
  ResizeTerminalRequest,
  TerminalStreamEvent,
  WriteTerminalInputRequest
} from '../../lib/types/terminal'

type CodexInstallStatus = {
  installed: boolean
}

const TERMINAL_EVENT_TOPIC = 'terminal://event'

export interface TerminalServices {
  checkCodexInstallation: () => Promise<boolean>
  createSession: (request: CreateTerminalSessionRequest) => Promise<CreateTerminalSessionResponse>
  writeInput: (request: WriteTerminalInputRequest) => Promise<void>
  resize: (request: ResizeTerminalRequest) => Promise<void>
  closeSession: (request: CloseTerminalSessionRequest) => Promise<void>
  subscribe: (
    callback: (event: TerminalStreamEvent) => void
  ) => Promise<() => void> | (() => void)
}

export function resolveTauriTerminalServices(): TerminalServices {
  return {
    checkCodexInstallation: async () => {
      const result = await invoke<CodexInstallStatus>('check_codex_installation')
      return result.installed
    },
    createSession: (request) =>
      invoke<CreateTerminalSessionResponse>('create_terminal_session', { request }),
    writeInput: async (request) => invoke<void>('write_terminal_input', { request }),
    resize: async (request) => invoke<void>('resize_terminal', { request }),
    closeSession: async (request) => invoke<void>('close_terminal_session', { request }),
    subscribe: async (callback) =>
      listen<TerminalStreamEvent>(TERMINAL_EVENT_TOPIC, (event) => callback(event.payload))
  }
}
