import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createApiError,
  createCurrentProjectState,
  createDirectoryEntries,
  createProjectContextResponse,
  createRemoteOverview,
  createTerminalSession,
  createTerminalStream
} from './codex-terminal-view.helpers'
import { loadStoredCodexSession } from '../lib/codex-session-storage'
import CodexTerminalView from '../views/CodexTerminalView.vue'
import type { TerminalAdapter } from '../components/terminal/xterm-adapter'

interface Deferred<T> {
  readonly promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
}

const {
  getCurrentProject,
  generateProjectContext,
  getCodexTerminalSession,
  createCodexTerminalSession,
  streamCodexTerminalSession,
  writeCodexTerminalInput,
  closeCodexTerminalSession,
  getRemoteOverview,
  getRemoteDirectories
} = vi.hoisted(() => ({
  getCurrentProject: vi.fn(),
  generateProjectContext: vi.fn(),
  getCodexTerminalSession: vi.fn(),
  createCodexTerminalSession: vi.fn(),
  streamCodexTerminalSession: vi.fn(),
  writeCodexTerminalInput: vi.fn(),
  closeCodexTerminalSession: vi.fn(),
  getRemoteOverview: vi.fn(),
  getRemoteDirectories: vi.fn()
}))

const adapterHarness = vi.hoisted(() => {
  const writes: string[] = []
  let bindings: { onInput: (payload: string) => void } | undefined
  const clear = vi.fn()
  const focus = vi.fn()

  const adapter: TerminalAdapter = {
    write: (content) => {
      writes.push(content)
    },
    clear,
    destroy: vi.fn(),
    focus,
    fit: () => undefined
  }

  const factory = vi.fn((_host: HTMLElement, nextBindings: { onInput: (payload: string) => void }) => {
    bindings = nextBindings
    return adapter
  })

  return {
    bindings: () => {
      if (!bindings) {
        throw new Error('terminal adapter bindings not ready')
      }
      return bindings
    },
    clear,
    factory,
    focus,
    reset: () => {
      bindings = undefined
    },
    writes
  }
})

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getCurrentProject,
    generateProjectContext,
    getCodexTerminalSession,
    createCodexTerminalSession,
    streamCodexTerminalSession,
    writeCodexTerminalInput,
    closeCodexTerminalSession,
    getRemoteOverview,
    getRemoteDirectories
  }
})

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: adapterHarness.factory
}))

afterEach(() => {
  getCurrentProject.mockReset()
  generateProjectContext.mockReset()
  getCodexTerminalSession.mockReset()
  createCodexTerminalSession.mockReset()
  streamCodexTerminalSession.mockReset()
  writeCodexTerminalInput.mockReset()
  closeCodexTerminalSession.mockReset()
  getRemoteOverview.mockReset()
  getRemoteDirectories.mockReset()
  adapterHarness.factory.mockClear()
  adapterHarness.clear.mockClear()
  adapterHarness.focus.mockClear()
  adapterHarness.reset()
  adapterHarness.writes.length = 0
  sessionStorage.clear()
})

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe('CodexTerminalView', () => {
  it('creates a terminal session when the page mounts', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue({
      ...createProjectContextResponse(),
      managed_files: ['AGENTS.md', '.codex/project-context.md']
    })
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(
      createTerminalStream('Welcome to Codex')
    )
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(generateProjectContext).toHaveBeenCalledWith(false)
      expect(createCodexTerminalSession).toHaveBeenCalledWith('/tmp/project-alpha')
    })

    expect(
      generateProjectContext.mock.invocationCallOrder[0]
    ).toBeLessThan(createCodexTerminalSession.mock.invocationCallOrder[0])
    expect((await screen.findAllByText('/tmp/project-alpha')).length).toBeGreaterThan(0)
    expect(await screen.findByText('项目上下文')).toBeInTheDocument()
    expect(await screen.findByText('已生成')).toBeInTheDocument()
    expect(await screen.findByText('远程目录')).toBeInTheDocument()
    expect(await screen.findByText('qzcs')).toBeInTheDocument()
    expect(await screen.findByText('MYSQL')).toBeInTheDocument()
    await waitFor(() => {
      expect(adapterHarness.writes).toEqual(['Welcome to Codex'])
    })
  })

  it('restores the existing session on reload instead of creating a new one', async () => {
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
    streamCodexTerminalSession.mockResolvedValue(
      createTerminalStream('next output', {
        sessionId: 'terminal-session-restored',
        nextCursor: 53
      })
    )
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await waitFor(() => {
      expect(getCodexTerminalSession).toHaveBeenCalledWith('terminal-session-restored')
      expect(streamCodexTerminalSession).toHaveBeenCalledWith(
        'terminal-session-restored',
        42
      )
    })
    expect(createCodexTerminalSession).not.toHaveBeenCalled()
    expect(generateProjectContext).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(adapterHarness.writes).toEqual(['next output'])
    })
    expect(loadStoredCodexSession('/tmp/project-alpha')).toEqual({
      project_path: '/tmp/project-alpha',
      session_id: 'terminal-session-restored',
      next_cursor: 53
    })
  })

  it('does not create a terminal session when context generation fails', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockRejectedValue(
      createApiError(
        'project.remote_profile_invalid',
        '远程参数不合法',
        'project_context',
        { field: 'designer_root' }
      )
    )

    render(CodexTerminalView)

    await waitFor(() => {
      expect(
        screen.getByText('project.remote_profile_invalid: 远程参数不合法')
      ).toBeInTheDocument()
    })
    expect(createCodexTerminalSession).not.toHaveBeenCalled()
  })

  it('writes raw terminal input through the terminal adapter', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream(''))
    writeCodexTerminalInput.mockResolvedValue({ accepted: true })
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    adapterHarness.bindings().onInput('help\r')

    await waitFor(() => {
      expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', 'help\r')
    })
  })

  it('inserts selected connection name into the active terminal session without executing and keeps terminal usable', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream(''))
    writeCodexTerminalInput.mockResolvedValue({ accepted: true })
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await screen.findByText('qzcs')
    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    writeCodexTerminalInput.mockClear()
    adapterHarness.focus.mockClear()

    await fireEvent.click(screen.getByText('qzcs'))

    await waitFor(() => {
      expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', 'qzcs')
    })
    expect(writeCodexTerminalInput).not.toHaveBeenCalledWith('terminal-session-1', 'qzcs\r')
    expect(adapterHarness.focus).toHaveBeenCalledTimes(1)

    adapterHarness.bindings().onInput('pwd')

    await waitFor(() => {
      expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', 'pwd')
    })
  })

  it('inserts selected remote path into the active terminal session without appending enter', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream(''))
    writeCodexTerminalInput.mockResolvedValue({ accepted: true })
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    render(CodexTerminalView)

    await screen.findByText('reportlets')
    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    writeCodexTerminalInput.mockClear()

    await fireEvent.click(
      await screen.findByRole('button', { name: 'reportlets' })
    )

    await waitFor(() => {
      expect(writeCodexTerminalInput).toHaveBeenCalledWith('terminal-session-1', '/reportlets')
    })
    expect(writeCodexTerminalInput).not.toHaveBeenCalledWith('terminal-session-1', '/reportlets\r')
  })

  it('resets the terminal when backend session is missing', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockRejectedValue(
      createApiError(
        'codex.session_not_found',
        '终端会话不存在',
        'codex_terminal',
        { session_id: 'terminal-session-1' }
      )
    )
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(streamCodexTerminalSession).toHaveBeenCalled()
    })

    expect(
      await screen.findByText('codex.session_not_found: 终端会话不存在，请重新创建会话')
    ).toBeInTheDocument()
    expect(await screen.findByText('尚未获取当前项目目录')).toBeInTheDocument()
    expect(loadStoredCodexSession('/tmp/project-alpha')).toBeNull()
    expect(adapterHarness.clear).toHaveBeenCalled()
  })

  it('keeps the real terminal active when left sidebar remote data fails', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream('Welcome to Codex'))
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

    expect(
      await screen.findByText('remote.request_failed: 远程请求失败')
    ).toBeInTheDocument()
    expect((await screen.findAllByText('/tmp/project-alpha')).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(adapterHarness.writes.join('')).toContain('Welcome to Codex')
    })
  })

  it('cancels stale boot flow before it can create or keep an orphan session', async () => {
    const deferredSession = createDeferred<ReturnType<typeof createTerminalSession>>()

    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext
      .mockResolvedValueOnce(createProjectContextResponse())
      .mockResolvedValueOnce(createProjectContextResponse())
    createCodexTerminalSession
      .mockImplementationOnce(() => deferredSession.promise)
      .mockResolvedValueOnce(createTerminalSession('terminal-session-2'))
    closeCodexTerminalSession.mockResolvedValue(
      createTerminalSession('terminal-session-stale', 'closed')
    )
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream('Welcome to Codex'))
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    await fireEvent.click(
      await screen.findByRole('button', { name: '重新创建会话' })
    )

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(2)
    })

    deferredSession.resolve(createTerminalSession('terminal-session-stale'))

    await waitFor(() => {
      expect(closeCodexTerminalSession).toHaveBeenCalledWith('terminal-session-stale')
    })
    expect((await screen.findAllByText('/tmp/project-alpha')).length).toBeGreaterThan(0)
  })

  it('ignores stale stream callbacks after restarting into a new session', async () => {
    const deferredStream = createDeferred<ReturnType<typeof createTerminalStream>>()

    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext
      .mockResolvedValueOnce(createProjectContextResponse())
      .mockResolvedValueOnce(createProjectContextResponse())
    createCodexTerminalSession
      .mockResolvedValueOnce(createTerminalSession('terminal-session-1'))
      .mockResolvedValueOnce(createTerminalSession('terminal-session-2'))
    streamCodexTerminalSession
      .mockImplementationOnce(() => deferredStream.promise)
      .mockResolvedValueOnce(
        createTerminalStream('fresh output', {
          sessionId: 'terminal-session-2',
          nextCursor: 12
        })
      )
    closeCodexTerminalSession.mockResolvedValue(
      createTerminalSession('terminal-session-1', 'closed')
    )
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(streamCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    await fireEvent.click(
      await screen.findByRole('button', { name: '重新创建会话' })
    )

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(2)
      expect(streamCodexTerminalSession).toHaveBeenCalledTimes(2)
    })

    deferredStream.resolve(
      createTerminalStream('stale output', {
        sessionId: 'terminal-session-1',
        nextCursor: 24
      })
    )

    await waitFor(() => {
      expect(adapterHarness.writes).toEqual(['fresh output'])
    })
    expect(closeCodexTerminalSession).toHaveBeenCalledWith('terminal-session-1')
  })

  it('ignores stale boot failure after a newer boot has succeeded', async () => {
    const deferredContext = createDeferred<ReturnType<typeof createProjectContextResponse>>()

    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext
      .mockImplementationOnce(() => deferredContext.promise)
      .mockResolvedValueOnce(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream('Welcome to Codex'))
    getRemoteOverview.mockResolvedValue({
      ...createRemoteOverview(),
      data_connections: []
    })
    getRemoteDirectories.mockResolvedValue([])

    render(CodexTerminalView)

    await waitFor(() => {
      expect(generateProjectContext).toHaveBeenCalledTimes(1)
    })

    await fireEvent.click(
      await screen.findByRole('button', { name: '重新创建会话' })
    )

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    deferredContext.reject(
      createApiError(
        'project.remote_profile_invalid',
        '远程参数不合法',
        'project_context',
        { field: 'designer_root' }
      )
    )

    await waitFor(() => {
      expect(adapterHarness.writes.join('')).toContain('Welcome to Codex')
    })
    expect(
      screen.queryByText('project.remote_profile_invalid: 远程参数不合法')
    ).not.toBeInTheDocument()
  })

  it('keeps the current session alive when the page unmounts', async () => {
    getCurrentProject.mockResolvedValue(createCurrentProjectState())
    generateProjectContext.mockResolvedValue(createProjectContextResponse())
    createCodexTerminalSession.mockResolvedValue(createTerminalSession())
    streamCodexTerminalSession.mockResolvedValue(createTerminalStream('Welcome to Codex'))
    getRemoteOverview.mockResolvedValue(createRemoteOverview())
    getRemoteDirectories.mockResolvedValue(createDirectoryEntries())

    const view = render(CodexTerminalView)

    await waitFor(() => {
      expect(createCodexTerminalSession).toHaveBeenCalledTimes(1)
    })

    view.unmount()

    expect(closeCodexTerminalSession).not.toHaveBeenCalled()
  })
})
