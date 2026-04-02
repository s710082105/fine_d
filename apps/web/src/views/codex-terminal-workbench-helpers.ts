import { ApiError } from '../lib/api'
import { saveStoredCodexSession } from '../lib/codex-session-storage'
import type { ProjectContextResponse, ProjectCurrentStateResponse } from '../lib/types'

export const MISSING_SESSION_MESSAGE =
  'codex.session_not_found: 终端会话不存在，请重新创建会话'

export function buildErrorMessage(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof ApiError) {
    if (error.code === 'codex.session_not_found') {
      return MISSING_SESSION_MESSAGE
    }
    return error.code ? `${error.code}: ${error.message}` : error.message
  }
  return error instanceof Error ? error.message : fallbackMessage
}

export function toProjectContextResponse(
  state: ProjectCurrentStateResponse
): ProjectContextResponse | null {
  if (!state.current_project || !state.context_state) {
    return null
  }
  return {
    project_root: state.current_project.path,
    generated_at: state.context_state.generated_at,
    agents_status: state.context_state.agents_status,
    managed_files: []
  }
}

export function saveSessionState(
  projectPath: string,
  sessionId: string,
  cursor: number
): void {
  if (!projectPath) {
    return
  }
  saveStoredCodexSession({
    project_path: projectPath,
    session_id: sessionId,
    next_cursor: cursor
  })
}
