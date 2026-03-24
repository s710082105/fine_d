import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import type { TerminalAdapter, TerminalAdapterFactory } from '../components/terminal/xterm-adapter'
import { TerminalPanel } from '../components/terminal/terminal-panel'
import {
  buildCreateTerminalSessionRequest,
  getTerminalErrorMessage,
  getTerminalStatusLabel
} from '../components/terminal/terminal-state'
import type { TerminalServices } from '../components/terminal/terminal-services'
import type { TerminalStreamEvent } from '../lib/types/terminal'

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: vi.fn(() => ({
    write: () => undefined,
    clear: () => undefined,
    destroy: () => undefined,
    focus: () => undefined,
    fit: () => ({ rows: 24, columns: 80 }),
    refresh: () => ({ rows: 24, columns: 80 })
  }))
}))

function buildConfig() {
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'
  return config
}

function createServices(overrides: Partial<TerminalServices> = {}) {
  let listener: ((event: TerminalStreamEvent) => void) | undefined
  const createSession = vi.fn(async () => ({
    sessionId: 'terminal-1',
    process: {
      sessionId: 'terminal-1',
      pid: 42,
      command: 'codex',
      args: [],
      workingDir: '/tmp/demo',
      startedAt: '1710806400'
    },
    createdAt: '1710806400'
  }))
  const writeInput = vi.fn(async () => undefined)
  const resize = vi.fn(async () => undefined)
  const closeSession = vi.fn(async () => undefined)

  const services = {
    checkCodexInstallation: async () => true,
    createSession,
    writeInput,
    resize,
    closeSession,
    subscribe: (callback: (event: TerminalStreamEvent) => void) => {
      listener = callback
      return () => undefined
    },
    emit: async (event: TerminalStreamEvent) => {
      await act(async () => listener?.(event))
    },
    ...overrides
  }
  return services as TerminalServices & {
    emit: (event: TerminalStreamEvent) => Promise<void>
    createSession: typeof createSession
    writeInput: typeof writeInput
    resize: typeof resize
    closeSession: typeof closeSession
  }
}

function createAdapterHarness() {
  const writes: string[] = []
  const clear = vi.fn()
  const destroy = vi.fn()
  const focus = vi.fn()
  const refresh = vi.fn(() => ({ rows: 28, columns: 96 }))
  let bindings:
    | {
        onInput: (payload: string) => void
        onResize: (size: { rows: number; columns: number }) => void
      }
    | undefined

  const adapter: TerminalAdapter = {
    write: (content) => {
      writes.push(content)
    },
    clear,
    destroy,
    focus,
    fit: () => ({ rows: 28, columns: 96 }),
    refresh
  }

  const factory: TerminalAdapterFactory = vi.fn((_host, nextBindings) => {
    bindings = nextBindings
    return adapter
  })

  return {
    adapter,
    bindings: () => {
      if (!bindings) {
        throw new Error('adapter bindings not ready')
      }
      return bindings
    },
    clear,
    destroy,
    factory,
    focus,
    refresh,
    writes
  }
}

function renderPanel(overrides: Partial<Parameters<typeof TerminalPanel>[0]> = {}) {
  const services = createServices()
  const adapterHarness = createAdapterHarness()
  const renderResult = render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
      {...overrides}
    />
  )

  return { ...renderResult, adapterHarness, services }
}

it('shows terminal status, idle tip, and header controls', async () => {
  const { container } = renderPanel()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeEnabled()
  )

  expect(screen.getByText('终端状态')).toBeInTheDocument()
  expect(screen.getByText('demo · v1')).toBeInTheDocument()
  expect(screen.getByText('等待手动启动 Codex')).toBeInTheDocument()
  const header = container.querySelector('.terminal-panel__header')

  if (!header) {
    throw new Error('missing terminal header')
  }

  const headerElement = header as HTMLElement

  expect(within(headerElement).getByRole('button', { name: '启动 Codex' })).toBeInTheDocument()
  expect(within(headerElement).getByRole('button', { name: '重启终端' })).toBeInTheDocument()
  expect(within(headerElement).getByRole('button', { name: '关闭终端' })).toBeInTheDocument()
  expect(container.querySelector('.terminal-panel__actions')).toBeNull()
})

it('starts a terminal session, renders streamed output, and forwards keyboard input', async () => {
  const services = createServices()
  const adapterHarness = createAdapterHarness()

  render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeEnabled()
  )
  fireEvent.click(screen.getByRole('button', { name: '启动 Codex' }))
  await waitFor(() => expect(services.createSession).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(services.resize).toHaveBeenCalledWith({
      session_id: 'terminal-1',
      rows: 28,
      columns: 96
    })
  )

  await services.emit({
    sessionId: 'terminal-1',
    eventType: 'output',
    message: 'Codex ready\r\n',
    timestamp: '1710806401'
  })

  expect(screen.getByText('运行中')).toBeInTheDocument()
  expect(adapterHarness.writes.join('')).toContain('Codex ready')

  adapterHarness.bindings().onInput('ls\n')
  await waitFor(() =>
    expect(services.writeInput).toHaveBeenCalledWith({
      session_id: 'terminal-1',
      payload: 'ls\n'
    })
  )
})

it('shows install guidance when codex is unavailable', async () => {
  const { services } = renderPanel({
    services: createServices({
      checkCodexInstallation: async () => false
    })
  })

  await waitFor(() =>
    expect(screen.getByText('请使用 npm i -g @openai/codex 安装')).toBeInTheDocument()
  )
  expect(screen.getByRole('button', { name: '启动 Codex' })).toBeDisabled()
  expect(services.createSession).not.toHaveBeenCalled()
})

it('disables terminal startup when project directory is missing', async () => {
  const config = createDefaultProjectConfig()
  const services = createServices()

  renderPanel({
    config,
    services
  })

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeDisabled()
  )
  expect(services.createSession).not.toHaveBeenCalled()
})

it('builds create requests from the current project config', () => {
  const config = buildConfig()
  const request = buildCreateTerminalSessionRequest('project-a', 'v2', config)

  expect(request.project_id).toBe('project-a')
  expect(request.config_version).toBe('v2')
  expect(request.workspace_dir).toBe('/tmp/demo')
  expect(request.shell).toBe('system')
})

it('throws when create request has no workspace root', () => {
  const config = createDefaultProjectConfig()

  expect(() =>
    buildCreateTerminalSessionRequest('project-a', 'v2', config)
  ).toThrow('项目目录未配置，不能创建终端会话')
})

it('maps terminal statuses and surfaces error messages', () => {
  expect(getTerminalStatusLabel('running')).toBe('运行中')
  expect(() => getTerminalStatusLabel('paused' as never)).toThrow('未知终端状态: paused')

  const event: TerminalStreamEvent = {
    sessionId: 'session-1',
    eventType: 'error',
    message: '权限不足',
    timestamp: '0'
  }
  expect(getTerminalErrorMessage(event)).toBe('权限不足')
})

it('resets panel state after project context changes', async () => {
  const services = createServices()
  const adapterHarness = createAdapterHarness()
  const { rerender } = render(
    <TerminalPanel
      projectId="project-a"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: '关闭终端' }))
  expect(screen.getByText('已退出')).toBeInTheDocument()

  rerender(
    <TerminalPanel
      projectId="project-b"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  expect(screen.getByText('空闲')).toBeInTheDocument()
  expect(screen.getByText('等待手动启动 Codex')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeEnabled()
  )
})

it('refreshes the terminal viewport after layout-affecting state changes', async () => {
  const services = createServices()
  const adapterHarness = createAdapterHarness()
  const { rerender } = render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  await waitFor(() => expect(adapterHarness.refresh).toHaveBeenCalled())
  const initialRefreshCount = adapterHarness.refresh.mock.calls.length

  rerender(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  await waitFor(() =>
    expect(adapterHarness.refresh.mock.calls.length).toBeGreaterThan(initialRefreshCount)
  )
})
