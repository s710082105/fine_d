import type { ProjectConfig } from './project-config'

export type SessionEventType = 'status' | 'stdout' | 'stderr' | 'process_exit'
export type SessionStatus = 'idle' | 'running' | 'error' | 'completed'

export interface CodexLaunchConfig {
  command: string
  args: string[]
  working_dir: string
}

export interface StartSessionRequest {
  project_id: string
  config_version: string
  first_message: string
  enabled_skills: string[]
  config: ProjectConfig
  codex: CodexLaunchConfig
}

export interface SessionProcessMetadata {
  session_id: string
  pid: number
  command: string
  args: string[]
  working_dir: string
  started_at: string
}

export interface StartSessionResponse {
  session_id: string
  session_dir: string
  process: SessionProcessMetadata
}

export interface SessionStreamEvent {
  session_id: string
  event_type: SessionEventType
  message: string
  timestamp: string
}
