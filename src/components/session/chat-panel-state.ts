import type { ProjectConfig } from '../../lib/types/project-config'
import type {
  RefreshSessionContextRequest,
  SessionActivityItem,
  SessionMeta,
  SessionStatus,
  SessionStreamEvent,
  StartSessionRequest,
  TimelineItem
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

export function buildActivities(): SessionActivityItem[] {
  return [
    { id: 'context', label: '生成上下文', status: 'pending', detail: '等待会话启动' },
    { id: 'launch', label: '启动会话', status: 'pending', detail: '等待调用 Rust 命令' },
    { id: 'command', label: '执行命令', status: 'pending', detail: '等待 Codex 输出' },
    { id: 'write_file', label: '写入文件', status: 'pending', detail: '等待工具写入事件' },
    { id: 'sync', label: '自动同步到真实运行目录', status: 'pending', detail: '等待同步事件' },
    { id: 'verify', label: '校验结果', status: 'pending', detail: '等待会话结束' }
  ]
}

export function nowTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
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

export function createUserItem(message: string): TimelineItem {
  return {
    id: `user-${Date.now()}`,
    type: 'user',
    content: message,
    timestamp: nowTimestamp()
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

export function applyStreamEvent(
  items: TimelineItem[],
  event: SessionStreamEvent
): TimelineItem[] {
  if (event.eventType === 'stdout') return appendAssistantItem(items, event)
  if (event.eventType === 'tool') return [...items, createToolItem(event)]
  if (event.eventType === 'sync') return [...items, createSyncItem(event)]
  return [...items, createStatusItem(event)]
}

export function resolveStatus(
  current: SessionStatus,
  event: SessionStreamEvent
): SessionStatus {
  if (event.eventType === 'stderr') return 'error'
  if (event.eventType === 'process_exit') {
    return event.message.includes('exit status: 0') ? 'completed' : 'error'
  }
  if (event.eventType === 'status' && event.message.includes('session started')) {
    return 'running'
  }
  return current
}

export function updateActivities(
  items: SessionActivityItem[],
  event: SessionStreamEvent
): SessionActivityItem[] {
  return items.map((item) => {
    if (event.message.includes('initializing session context') && item.id === 'context') {
      return { ...item, status: 'completed', detail: event.message }
    }
    if (event.message.includes('starting codex process') && item.id === 'launch') {
      return { ...item, status: 'completed', detail: event.message }
    }
    if (event.eventType === 'stdout' && item.id === 'command') {
      return { ...item, status: 'completed', detail: '已收到 Codex 输出' }
    }
    if (event.eventType === 'tool' && item.id === 'write_file') {
      return { ...item, status: 'completed', detail: event.toolSummary ?? event.message }
    }
    if (event.eventType === 'sync' && item.id === 'sync') {
      return { ...item, status: 'completed', detail: event.syncPath ?? event.message }
    }
    if (event.eventType === 'process_exit' && item.id === 'verify') {
      const status = event.message.includes('exit status: 0') ? 'completed' : 'error'
      return { ...item, status, detail: event.message }
    }
    if (event.eventType === 'stderr' && item.id === 'verify') {
      return { ...item, status: 'error', detail: event.message }
    }
    return item
  })
}

export function validateDraft(config: ProjectConfig, draft: string): string | null {
  if (draft.trim().length === 0) return '消息不能为空'
  if (config.workspace.root_dir.trim().length === 0) return 'Workspace Root Dir is required'
  if (!isAbsolutePath(config.workspace.root_dir)) {
    return 'Workspace Root Dir 必须是绝对路径'
  }
  return null
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createStatusItem(event: SessionStreamEvent): TimelineItem {
  return {
    id: `${event.eventType}-${event.timestamp}-${Math.random()}`,
    type: event.eventType === 'stderr' ? 'error' : 'status',
    message: event.message,
    timestamp: event.timestamp
  }
}

function createToolItem(event: SessionStreamEvent): TimelineItem {
  return {
    id: `tool-${event.timestamp}-${Math.random()}`,
    type: 'tool',
    name: event.toolName ?? 'unknown',
    status: event.toolStatus ?? 'pending',
    summary: event.toolSummary,
    timestamp: event.timestamp
  }
}

function createSyncItem(event: SessionStreamEvent): TimelineItem {
  return {
    id: `sync-${event.timestamp}-${Math.random()}`,
    type: 'sync',
    action: event.syncAction ?? 'update',
    protocol: event.syncProtocol ?? 'sftp',
    status: event.syncStatus ?? 'pending',
    path: event.syncPath ?? event.message,
    timestamp: event.timestamp
  }
}

function appendAssistantItem(
  items: TimelineItem[],
  event: SessionStreamEvent
): TimelineItem[] {
  const lastItem = items.at(-1)
  if (lastItem?.type !== 'assistant') {
    return [
      ...items,
      {
        id: `assistant-${event.timestamp}-${Math.random()}`,
        type: 'assistant',
        content: event.message,
        timestamp: event.timestamp,
        streaming: true
      }
    ]
  }
  return [
    ...items.slice(0, -1),
    {
      ...lastItem,
      content: `${lastItem.content}\n${event.message}`,
      streaming: true
    }
  ]
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\\/.test(path)
}
