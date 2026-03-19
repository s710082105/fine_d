import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import { TerminalPanel } from '../components/terminal/terminal-panel'
import type { TerminalAdapter, TerminalAdapterFactory } from '../components/terminal/xterm-adapter'
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

function createServices() {
  let listener: ((event: TerminalStreamEvent) => void) | undefined
  let sessionCounter = 0
  const createSession = vi.fn(async () => {
    sessionCounter += 1
    return {
      sessionId: `terminal-${sessionCounter}`,
      process: {
        sessionId: `terminal-${sessionCounter}`,
        pid: 40 + sessionCounter,
        command: 'codex',
        args: [],
        workingDir: '/tmp/demo',
        startedAt: '1710806400'
      },
      createdAt: '1710806400'
    }
  })
  const closeSession = vi.fn(async () => undefined)

  return {
    checkCodexInstallation: async () => true,
    closeSession,
    createSession,
    emit: async (event: TerminalStreamEvent) => {
      await act(async () => listener?.(event))
    },
    resize: vi.fn(async () => undefined),
    subscribe: (callback: (event: TerminalStreamEvent) => void) => {
      listener = callback
      return () => undefined
    },
    writeInput: vi.fn(async () => undefined)
  } as TerminalServices & {
    closeSession: typeof closeSession
    createSession: typeof createSession
    emit: (event: TerminalStreamEvent) => Promise<void>
  }
}

function createDeferredServices() {
  const services = createServices()
  let resolveSession:
    | ((value: Awaited<ReturnType<typeof services.createSession>>) => void)
    | undefined

  services.createSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSession = resolve
      })
  )

  return {
    ...services,
    resolveSession: () => {
      if (!resolveSession) {
        throw new Error('createSession has not started')
      }
      resolveSession({
        sessionId: 'terminal-1',
        process: {
          sessionId: 'terminal-1',
          pid: 41,
          command: 'codex',
          args: [],
          workingDir: '/tmp/demo',
          startedAt: '1710806400'
        },
        createdAt: '1710806400'
      })
    }
  }
}

function createAdapterHarness() {
  const adapter: TerminalAdapter = {
    clear: () => undefined,
    destroy: () => undefined,
    fit: () => ({ rows: 28, columns: 96 }),
    focus: () => undefined,
    refresh: () => ({ rows: 28, columns: 96 }),
    write: () => undefined
  }

  const factory: TerminalAdapterFactory = vi.fn(() => adapter)
  return { factory }
}

it('prevents starting a second terminal while one is already active', async () => {
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

  expect(screen.getByRole('button', { name: '启动 Codex' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: '启动 Codex' }))
  expect(services.createSession).toHaveBeenCalledTimes(1)
})

it('closes a late session result after the user cancels during startup', async () => {
  const services = createDeferredServices()
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
  fireEvent.click(screen.getByRole('button', { name: '关闭终端' }))
  await act(async () => services.resolveSession())

  await waitFor(() =>
    expect(services.closeSession).toHaveBeenCalledWith({ session_id: 'terminal-1' })
  )
  expect(screen.getByText('已退出')).toBeInTheDocument()
  expect(screen.queryByText('PID 41')).not.toBeInTheDocument()
})

it('shows an explicit error when late-session cleanup fails', async () => {
  const services = createDeferredServices()
  const adapterHarness = createAdapterHarness()
  services.closeSession.mockRejectedValueOnce(new Error('cleanup failed'))

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
  fireEvent.click(screen.getByRole('button', { name: '关闭终端' }))
  await act(async () => services.resolveSession())

  await waitFor(() =>
    expect(
      screen.getByText('已取消启动，但关闭晚到终端失败：cleanup failed')
    ).toBeInTheDocument()
  )
  expect(screen.getByText('出错')).toBeInTheDocument()
})

it('logs cleanup failure after the panel unmounts during startup', async () => {
  const services = createDeferredServices()
  const adapterHarness = createAdapterHarness()
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  services.closeSession.mockRejectedValueOnce(new Error('cleanup failed'))

  const view = render(
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
  view.unmount()
  await act(async () => services.resolveSession())

  expect(consoleError).toHaveBeenCalledWith(
    '已取消启动，但关闭晚到终端失败：cleanup failed',
    expect.any(Error)
  )
  consoleError.mockRestore()
})

it('logs cleanup failure when an active session cannot close on unmount', async () => {
  const services = createServices()
  const adapterHarness = createAdapterHarness()
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  services.closeSession.mockRejectedValueOnce(new Error('cleanup failed'))

  const view = render(
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
  view.unmount()

  await waitFor(() =>
    expect(consoleError).toHaveBeenCalledWith(
      '组件卸载时关闭终端失败：cleanup failed',
      expect.any(Error)
    )
  )
  consoleError.mockRestore()
})
