import type { ProjectConfig } from '../../lib/types/project-config'
import type {
  RefreshSessionContextRequest,
  SendSessionMessageRequest,
  SessionMeta,
  SessionStatus,
  SessionStreamEvent,
  StartSessionRequest
} from '../../lib/types/session'

const SESSION_TITLE = 'Draft Session'

export function buildMeta(
  projectId: string,
  configVersion: string,
  sessionId = '',
  status: SessionStatus = 'idle'
): SessionMeta {
  return {
    sessionId,
    projectId,
    title: SESSION_TITLE,
    status,
    configVersion
  }
}

export function localizeSessionStatus(status: SessionStatus): string {
  if (status === 'idle') return '未开始'
  if (status === 'running') return '运行中'
  if (status === 'completed') return '已完成'
  return '异常'
}

export function buildStartRequest(
  projectId: string,
  configVersion: string,
  enabledSkills: string[],
  config: ProjectConfig,
  message: string
): StartSessionRequest {
  return {
    project_id: projectId,
    config_version: configVersion,
    first_message: message,
    enabled_skills: enabledSkills,
    config,
    codex: {
      command: 'codex',
      args: [],
      working_dir: config.workspace.root_dir
    }
  }
}

export function buildRefreshRequest(
  projectId: string,
  sessionId: string,
  configVersion: string,
  enabledSkills: string[],
  config: ProjectConfig
): RefreshSessionContextRequest {
  return {
    project_id: projectId,
    session_id: sessionId,
    config_version: configVersion,
    enabled_skills: enabledSkills,
    config
  }
}

export function buildSendRequest(
  projectId: string,
  sessionId: string,
  configVersion: string,
  config: ProjectConfig,
  message: string,
  codexSessionId: string
): SendSessionMessageRequest {
  return {
    project_id: projectId,
    session_id: sessionId,
    config_version: configVersion,
    message,
    codex_session_id: codexSessionId,
    config,
    codex: {
      command: 'codex',
      args: [],
      working_dir: config.workspace.root_dir
    }
  }
}

export function appendRawOutput(current: string, event: SessionStreamEvent): string {
  return appendRawLine(current, formatRawOutputLine(event))
}

export function appendRawLine(current: string, line: string): string {
  return current.length === 0 ? line : `${current}\n${line}`
}

export function resolveStatus(
  current: SessionStatus,
  event: SessionStreamEvent
): SessionStatus {
  if (event.eventType === 'stderr') return 'error'
  if (event.eventType === 'process_exit') {
    return event.message.includes('exit status: 0') ? 'completed' : 'error'
  }
  if (
    event.eventType === 'status' &&
    (event.message.includes('session started') || event.message.includes('session resumed'))
  ) {
    return 'running'
  }
  return current
}

export function extractCodexSessionId(event: SessionStreamEvent): string | null {
  if (event.codexSessionId) return event.codexSessionId
  if (event.eventType !== 'stdout') return null
  const match = /^session id:\s*(\S+)/i.exec(event.message.trim())
  return match?.[1] ?? null
}

export function validateDraft(config: ProjectConfig, draft: string): string | null {
  if (draft.trim().length === 0) return '消息不能为空'
  if (config.workspace.root_dir.trim().length === 0) return '项目目录不能为空'
  if (!isAbsolutePath(config.workspace.root_dir)) {
    return '项目目录必须是绝对路径'
  }
  return null
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatRawOutputLine(event: SessionStreamEvent): string {
  if (event.eventType === 'stdout') return event.message
  if (event.eventType === 'stderr') return `[stderr] ${event.message}`
  if (event.eventType === 'tool') {
    return `[tool:${event.toolName ?? 'unknown'}] ${event.toolSummary ?? event.message}`
  }
  if (event.eventType === 'sync') {
    return `[sync:${event.syncAction ?? 'update'}:${event.syncProtocol ?? 'local'}] ${
      event.syncPath ?? event.message
    }`
  }
  return `[${event.eventType}] ${event.message}`
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\\/.test(path)
}
