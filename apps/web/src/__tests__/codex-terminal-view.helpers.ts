import { ApiError } from '../lib/api'

const PROJECT_PATH = '/tmp/project-alpha'
const GENERATED_AT = '2026-03-26T08:00:00Z'
const SESSION_ID = 'terminal-session-1'

export function createCurrentProjectState() {
  return {
    current_project: {
      path: PROJECT_PATH,
      name: 'project-alpha'
    },
    remote_profile: null
  }
}

export function createProjectContextResponse() {
  return {
    project_root: PROJECT_PATH,
    generated_at: GENERATED_AT,
    agents_status: 'created' as const,
    managed_files: ['AGENTS.md']
  }
}

export function createTerminalSession(
  sessionId = SESSION_ID,
  status: 'running' | 'closed' | 'failed' = 'running'
) {
  return {
    session_id: sessionId,
    status,
    working_directory: PROJECT_PATH
  }
}

interface TerminalStreamOptions {
  readonly sessionId?: string
  readonly nextCursor?: number
  readonly completed?: boolean
  readonly status?: 'running' | 'closed' | 'failed'
}

export function createTerminalStream(
  output: string,
  options: TerminalStreamOptions = {}
) {
  return {
    session_id: options.sessionId ?? SESSION_ID,
    status: options.status ?? 'running',
    output,
    next_cursor: options.nextCursor ?? output.length,
    completed: options.completed ?? true
  }
}

export function createRemoteOverview() {
  return {
    data_connections: [{ name: 'qzcs', database_type: 'MYSQL' }],
    directory_entries: [],
    last_loaded_at: GENERATED_AT
  }
}

export function createDirectoryEntries() {
  return [
    { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
  ]
}

export function createApiError(
  code: string,
  message: string,
  source: string,
  detail: Record<string, unknown>,
  retryable = false
) {
  return new ApiError(
    400,
    {
      code,
      message,
      detail,
      source,
      retryable
    },
    'API request failed: 400 Bad Request'
  )
}
