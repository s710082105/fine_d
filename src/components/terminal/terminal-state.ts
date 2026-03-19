import type { ProjectConfig } from '../../lib/types/project-config'
import type {
  CreateTerminalSessionRequest,
  TerminalStatus,
  TerminalStreamEvent
} from '../../lib/types/terminal'
import { resolveProjectSourceDir } from '../../lib/types/project-config'

const STATUS_LABELS: Record<TerminalStatus, string> = {
  idle: '空闲',
  starting: '启动中',
  running: '运行中',
  exited: '已退出',
  error: '出错'
}

function requireWorkspaceRoot(config: ProjectConfig): string {
  const workspaceRoot = config.workspace.root_dir.trim()

  if (workspaceRoot.length === 0) {
    throw new Error('项目目录未配置，不能创建终端会话')
  }

  return workspaceRoot
}

export function buildCreateTerminalSessionRequest(
  projectId: string,
  configVersion: string,
  config: ProjectConfig
): CreateTerminalSessionRequest {
  const workspaceRoot = requireWorkspaceRoot(config)

  return {
    project_id: projectId,
    config_version: configVersion,
    workspace_dir: workspaceRoot,
    shell: 'bash',
    env: {
      REPORTLET_SOURCE_DIR: resolveProjectSourceDir(workspaceRoot)
    },
    config
  }
}

export function getTerminalStatusLabel(status: TerminalStatus | string | undefined): string {
  if (!status || !(status in STATUS_LABELS)) {
    throw new Error(`未知终端状态: ${status ?? 'undefined'}`)
  }

  return STATUS_LABELS[status as TerminalStatus]
}

export function getTerminalErrorMessage(
  event?: TerminalStreamEvent | Error | null
): string | undefined {
  if (!event) {
    return undefined
  }

  if ('eventType' in event) {
    return event.eventType === 'error' ? event.message : undefined
  }

  return event instanceof Error ? event.message : undefined
}

export function resolveTerminalStatus(
  currentStatus: TerminalStatus,
  event: TerminalStreamEvent
): TerminalStatus {
  if (event.eventType === 'error') {
    return 'error'
  }
  if (event.eventType === 'exited') {
    return 'exited'
  }
  if (event.eventType === 'started' || event.eventType === 'output') {
    return 'running'
  }
  return currentStatus
}
