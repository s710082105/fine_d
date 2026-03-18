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
  sessionId: string
  pid: number
  command: string
  args: string[]
  workingDir: string
  startedAt: string
}

export interface StartSessionResponse {
  sessionId: string
  sessionDir: string
  process: SessionProcessMetadata
}

export interface SessionStreamEvent {
  sessionId: string
  eventType: SessionEventType
  message: string
  timestamp: string
}
