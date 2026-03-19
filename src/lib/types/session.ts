import type { ProjectConfig } from './project-config'

export type SessionEventType =
  | 'status'
  | 'stdout'
  | 'stderr'
  | 'process_exit'
  | 'tool'
  | 'sync'
export type SessionStatus = 'idle' | 'running' | 'error' | 'completed'

export interface SessionMeta {
  sessionId: string
  projectId: string
  title: string
  status: SessionStatus
  configVersion: string
}

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

export interface SendSessionMessageRequest {
  project_id: string
  session_id: string
  config_version: string
  message: string
  codex_session_id: string
  config: ProjectConfig
  codex: CodexLaunchConfig
}

export interface RefreshSessionContextRequest {
  project_id: string
  session_id: string
  config_version: string
  enabled_skills: string[]
  config: ProjectConfig
}

export interface InterruptSessionRequest {
  session_id: string
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

export interface SendSessionMessageResponse {
  sessionId: string
  process: SessionProcessMetadata
}

export interface SessionStreamEvent {
  sessionId: string
  eventType: SessionEventType
  message: string
  timestamp: string
  codexSessionId?: string
  toolName?: string
  toolStatus?: string
  toolSummary?: string
  syncAction?: 'create' | 'update' | 'delete'
  syncProtocol?: 'sftp' | 'ftp'
  syncStatus?: string
  syncPath?: string
}
