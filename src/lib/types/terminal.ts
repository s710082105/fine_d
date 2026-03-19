import type { ProjectConfig } from './project-config'

export type TerminalStatus = 'idle' | 'starting' | 'running' | 'exited' | 'error'

export type TerminalStreamEventType = 'started' | 'output' | 'exited' | 'error'

export interface TerminalProcessMetadata {
  sessionId: string
  pid: number
  command: string
  args: string[]
  workingDir: string
  startedAt: string
}

export interface CreateTerminalSessionRequest {
  project_id: string
  config_version: string
  workspace_dir: string
  shell: string
  env?: Record<string, string>
  config: ProjectConfig
}

export interface CreateTerminalSessionResponse {
  sessionId: string
  process: TerminalProcessMetadata
  createdAt: string
}

export interface WriteTerminalInputRequest {
  session_id: string
  payload: string
}

export interface ResizeTerminalRequest {
  session_id: string
  columns: number
  rows: number
}

export interface CloseTerminalSessionRequest {
  session_id: string
}

export interface TerminalStreamEvent {
  sessionId: string
  eventType: TerminalStreamEventType
  message: string
  timestamp: string
}
