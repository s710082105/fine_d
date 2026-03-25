import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CodexTerminalView from '../views/CodexTerminalView.vue'
import { ApiError } from '../lib/api'

const {
  getCurrentProject,
  createCodexTerminalSession,
  streamCodexTerminalSession,
  writeCodexTerminalInput,
  closeCodexTerminalSession
} = vi.hoisted(() => ({
  getCurrentProject: vi.fn(),
  createCodexTerminalSession: vi.fn(),
  streamCodexTerminalSession: vi.fn(),
  writeCodexTerminalInput: vi.fn(),
  closeCodexTerminalSession: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getCurrentProject,
    createCodexTerminalSession,
    streamCodexTerminalSession,
    writeCodexTerminalInput,
    closeCodexTerminalSession
  }
})

afterEach(() => {
  getCurrentProject.mockReset()
  createCodexTerminalSession.mockReset()
  streamCodexTerminalSession.mockReset()
  writeCodexTerminalInput.mockReset()
  closeCodexTerminalSession.mockReset()
})

describe('CodexTerminalView', () => {
  it('creates a terminal session when the page mounts', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: null
    })
    createCodexTerminalSession.mockResolvedValue({
      session_id: 'terminal-session-1',
      status: 'running',
      working_directory: '/tmp/project-alpha'
    })
    streamCodexTerminalSession.mockResolvedValue({
      session_id: 'terminal-session-1',
      status: 'running',
      output: 'Welcome to Codex',
      next_cursor: 16,
      completed: true
    })

    render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledWith('/tmp/project-alpha')
    })

    expect(await screen.findByText('/tmp/project-alpha')).toBeInTheDocument()
    expect(await screen.findByText('Welcome to Codex')).toBeInTheDocument()
  })

  it('shows backend startup errors without fallback terminal UI', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: null
    })
    createCodexTerminalSession.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'codex.command_missing',
          message: '未找到 codex 可执行文件',
          detail: { command: 'codex' },
          source: 'codex_terminal',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(CodexTerminalView)

    await waitFor(() => {
      expect(
        screen.getByText('codex.command_missing: 未找到 codex 可执行文件')
      ).toBeInTheDocument()
    })
  })

  it('writes terminal input through the terminal panel', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: null
    })
    createCodexTerminalSession.mockResolvedValue({
      session_id: 'terminal-session-1',
      status: 'running',
      working_directory: '/tmp/project-alpha'
    })
    streamCodexTerminalSession.mockResolvedValue({
      session_id: 'terminal-session-1',
      status: 'running',
      output: '',
      next_cursor: 0,
      completed: true
    })
    writeCodexTerminalInput.mockResolvedValue({ accepted: true })

    render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    const input = await screen.findByLabelText('终端输入')
    await fireEvent.update(input, 'help')
    await fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', 'help\n')
    })
  })
})
