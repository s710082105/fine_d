const STORAGE_KEY = 'finereport.codex.active-session'

export interface StoredCodexSessionState {
  readonly project_path: string
  readonly session_id: string
  readonly next_cursor: number
}

export function loadStoredCodexSession(
  projectPath: string
): StoredCodexSessionState | null {
  const payload = readStorage()
  if (!payload || payload.project_path !== projectPath) {
    return null
  }
  return payload
}

export function saveStoredCodexSession(
  value: StoredCodexSessionState
): void {
  writeStorage(value)
}

export function clearStoredCodexSession(projectPath?: string): void {
  const payload = readStorage()
  if (!payload) {
    return
  }
  if (projectPath && payload.project_path !== projectPath) {
    return
  }
  sessionStorage.removeItem(STORAGE_KEY)
}

function readStorage(): StoredCodexSessionState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }
    const payload = JSON.parse(raw) as Partial<StoredCodexSessionState>
    if (
      typeof payload.project_path !== 'string' ||
      typeof payload.session_id !== 'string' ||
      typeof payload.next_cursor !== 'number'
    ) {
      return null
    }
    return {
      project_path: payload.project_path,
      session_id: payload.session_id,
      next_cursor: payload.next_cursor
    }
  } catch {
    return null
  }
}

function writeStorage(value: StoredCodexSessionState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    return
  }
}
