import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createApiError,
  createCurrentProjectState,
  createDirectoryEntries,
  createProjectContextResponse,
  createRemoteOverview,
  createTerminalSession
} from './codex-terminal-view.helpers'
import { loadStoredCodexSession } from '../lib/codex-session-storage'
import CodexTerminalView from '../views/CodexTerminalView.vue'

const {
  getCurrentProject,
  generateProjectContext,
  getCodexTerminalSession,
  createCodexTerminalSession,
  closeCodexTerminalSession,
  getRemoteOverview,
  getRemoteDirectories
} = vi.hoisted(() => ({
  getCurrentProject: vi.fn(),
  generateProjectContext: vi.fn(),
  getCodexTerminalSession: vi.fn(),
  createCodexTerminalSession: vi.fn(),
  closeCodexTerminalSession: vi.fn(),
  getRemoteOverview: vi.fn(),
  getRemoteDirectories: vi.fn()
}))

const connectionHarness = vi.hoisted(() => {
  const instances: Array<{
    deps: {
      onChunk?: (chunk: string) => void
      onMissingSession?: () => void
    }
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    write: ReturnType<typeof vi.fn>
  }> = []

  return {
    factory: vi.fn((deps: {
      onChunk?: (chunk: string) => void
      onMissingSession?: () => void
    }) => {
      const instance = {
        deps,
        start: vi.fn(),
        stop: vi.fn(),
        write: vi.fn().mockResolvedValue(undefined)
      }
      instances.push(instance)
      return {
        start: instance.start,
        stop: instance.stop,
        write: instance.write,
        getCursor: () => 0
      }
    }),
    instances,
    reset: () => {
      instances.length = 0
    }
  }
})

const panelHarness = vi.hoisted(() => ({
  appendOutput: vi.fn(),
  focusTerminal: vi.fn(),
  reset: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getCurrentProject,
    generateProjectContext,
    getCodexTerminalSession,
    createCodexTerminalSession,
    closeCodexTerminalSession,
    getRemoteOverview,
    getRemoteDirectories
  }
})

vi.mock('../components/terminal/use-terminal-connection', () => ({
  createTerminalConnection: connectionHarness.factory
}))

vi.mock('../components/TerminalSessionPanel.vue', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    default: defineComponent({
      name: 'TerminalSessionPanel',
      emits: ['restart', 'submitInput'],
      props: {
        errorMessage: {
          required: true,
          type: String
        },
        session: {
          default: null,
          type: Object
        }
      },
      setup(props, { emit, expose }) {
        expose({
          appendOutput: panelHarness.appendOutput,
          focusTerminal: panelHarness.focusTerminal,
          reset: panelHarness.reset
        })

        return () => h('section', [
          h(
            'p',
            { 'data-testid': 'terminal-working-directory' },
            props.session?.working_directory ?? '尚未获取当前项目目录'
          ),
          props.errorMessage
            ? h('p', { 'data-testid': 'terminal-error' }, props.errorMessage)
            : null,
          h(
            'button',
            {
              'data-testid': 'terminal-restart',
              type: 'button',
              onClick: () => emit('restart')
            },
            '重新创建会话'
          ),
          h(
            'button',
            {
              'data-testid': 'terminal-submit',
              type: 'button',
              onClick: () => emit('submitInput', 'help\r')
            },
            '发送命令'
          )
        ])
      }
    })
  }
})

afterEach(() => {
  getCurrentProject.mockReset()
  generateProjectContext.mockReset()
  getCodexTerminalSession.mockReset()
  createCodexTerminalSession.mockReset()
  closeCodexTerminalSession.mockReset()
  getRemoteOverview.mockReset()
  getRemoteDirectories.mockReset()
  connectionHarness.factory.mockClear()
  connectionHarness.reset()
  panelHarness.appendOutput.mockClear()
  panelHarness.focusTerminal.mockClear()
  panelHarness.reset.mockClear()
  sessionStorage.clear()
})

function lastConnection() {
  const instance = connectionHarness.instances.at(-1)
  if (!instance) {
    throw new Error('terminal connection not created')
  }
  return instance
}

describe('CodexTerminalView', () => {
  it('creates a terminal session and starts polling connection on mount', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledWith('/tmp/project-alpha')
      expect(lastConnection().start).toHaveBeenCalledWith({
        sessionId: 'terminal-session-1',
        projectPath: '/tmp/project-alpha',
        cursor: 0
      })
    })

    lastConnection().deps.onChunk?.('Welcome to Codex')

    expect(panelHarness.appendOutput).toHaveBeenCalledWith('Welcome to Codex')
    expect(await screen.findByText('项目上下文')).toBeInTheDocument()
    expect(await screen.findByText('qzcs')).toBeInTheDocument()
  })

  it('restores the existing session and starts from the stored cursor', async () => {
    sessionStorage.setItem(
      'finereport.codex.active-session',
      JSON.stringify({
        project_path: '/tmp/project-alpha',
        session_id: 'terminal-session-restored',
        next_cursor: 42
      })
    )
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    getCodexTerminalSession.mockResolvedValue(
      createTerminalSession('terminal-session-restored')
    )
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(getCodexTerminalSession).toHaveBeenCalledWith('terminal-session-restored')
      expect(lastConnection().start).toHaveBeenCalledWith({
        sessionId: 'terminal-session-restored',
        projectPath: '/tmp/project-alpha',
        cursor: 42
      })
    })

    expect(createCodexTerminalSession).not.toHaveBeenCalled()
    expect(generateProjectContext).not.toHaveBeenCalled()
  })

  it('writes terminal and sidebar input through the polling connection', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(lastConnection().start).toHaveBeenCalledTimes(1)
    })

    await fireEvent.click(screen.getByTestId('terminal-submit'))
    await fireEvent.click(screen.getByText('qzcs'))

    expect(lastConnection().write).toHaveBeenCalledWith('help\r')
    expect(lastConnection().write).toHaveBeenCalledWith('qzcs')
    expect(panelHarness.focusTerminal).toHaveBeenCalledTimes(1)
  })

  it('resets terminal state when the polling connection reports a missing session', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(lastConnection().start).toHaveBeenCalledTimes(1)
    })

    lastConnection().deps.onMissingSession?.()

    await waitFor(() => {
      expect(screen.getByTestId('terminal-error')).toHaveTextContent(
        'codex.session_not_found: 终端会话不存在，请重新创建会话'
      )
    })

    expect(screen.getByTestId('terminal-working-directory')).toHaveTextContent(
      '尚未获取当前项目目录'
    )
    expect(loadStoredCodexSession('/tmp/project-alpha')).toBeNull()
    expect(panelHarness.reset).toHaveBeenCalled()
  })

  it('keeps terminal startup active when sidebar overview fails', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    getRemoteOverview.mockRejectedValue(
      createApiError(
        'remote.request_failed',
        '远程请求失败',
        'remote',
        { operation: 'overview' },
        true
      )
    )
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(lastConnection().start).toHaveBeenCalledTimes(1)
    })

    expect(
      await screen.findByText('remote.request_failed: 远程请求失败')
    ).toBeInTheDocument()
  })

  it('restarts by closing the active session and creating a new one', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext
      .mockResolvedValueOnce(createProjectContextResponse())
      .mockResolvedValueOnce(createProjectContextResponse())
    createCodexTerminalSession
      .mockResolvedValueOnce(createTerminalSession('terminal-session-1'))
      .mockResolvedValueOnce(createTerminalSession('terminal-session-2'))
    closeCodexTerminalSession.mockResolvedValue(
      createTerminalSession('terminal-session-1', 'closed')
    )
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(lastConnection().start).toHaveBeenCalledWith({
        sessionId: 'terminal-session-1',
        projectPath: '/tmp/project-alpha',
        cursor: 0
      })
    })

    await fireEvent.click(screen.getByTestId('terminal-restart'))

    await waitFor(() => {
      expect(closeCodexTerminalSession).toHaveBeenCalledWith('terminal-session-1')
      expect(connectionHarness.instances).toHaveLength(1)
      expect(lastConnection().start).toHaveBeenLastCalledWith({
        sessionId: 'terminal-session-2',
        projectPath: '/tmp/project-alpha',
        cursor: 0
      })
    })
  })
})
