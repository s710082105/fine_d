import type { ProjectConfig } from './project-config'

export type SessionEventType =
  | 'status'
  | 'stdout'
  | 'stderr'
  | 'process_exit'
  | 'tool'
  | 'sync'
export type SessionStatus = 'idle' | 'running' | 'error' | 'completed'
export type TimelineItem =
  | { id: string; type: 'user'; content: string; timestamp: string }
  | { id: string; type: 'assistant'; content: string; timestamp: string; streaming: boolean }
  | { id: string; type: 'status'; message: string; timestamp: string }
  | { id: string; type: 'error'; message: string; timestamp: string }
  | { id: string; type: 'tool'; name: string; status: string; summary?: string; timestamp: string }
  | {
      id: string
      type: 'sync'
      action: 'create' | 'update' | 'delete'
      protocol: 'sftp' | 'ftp'
      status: string
      path: string
      timestamp: string
    }

export interface SessionMeta {
  sessionId: string
  projectId: string
  title: string
  status: SessionStatus
  configVersion: string
}

export interface SessionActivityItem {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  detail: string
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

export interface SessionStreamEvent {
  sessionId: string
  eventType: SessionEventType
  message: string
  timestamp: string
  toolName?: string
  toolStatus?: string
  toolSummary?: string
  syncAction?: 'create' | 'update' | 'delete'
  syncProtocol?: 'sftp' | 'ftp'
  syncStatus?: string
  syncPath?: string
}
