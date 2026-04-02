import { afterEach, describe, expect, it } from 'vitest'

import { loadStoredCodexSession } from '../lib/codex-session-storage'
import { saveSessionState } from '../views/codex-terminal-workbench-helpers'

afterEach(() => {
  sessionStorage.clear()
})

describe('saveSessionState', () => {
  it('persists the session cursor for polling restore', () => {
    saveSessionState('/tmp/project-alpha', 'terminal-session-1', 42)

    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-1',
      next_cursor: 42
    })
  })
})
