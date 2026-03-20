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
  const writeInput = vi.fn(async () => undefined)
  const resize = vi.fn(async () => undefined)
  const closeSession = vi.fn(async () => undefined)

  return {
    checkCodexInstallation: async () => true,
    closeSession,
    createSession,
    emit: async (event: TerminalStreamEvent) => {
      await act(async () => listener?.(event))
    },
    resize,
    subscribe: (callback: (event: TerminalStreamEvent) => void) => {
      listener = callback
      return () => undefined
    },
    writeInput
  } as TerminalServices & {
    closeSession: typeof closeSession
    createSession: typeof createSession
    emit: (event: TerminalStreamEvent) => Promise<void>
    resize: typeof resize
    writeInput: typeof writeInput
  }
}

function createAdapterHarness() {
  const writes: string[] = []
  const destroy = vi.fn()
  let bindings:
    | {
        onInput: (payload: string) => void
        onResize: (size: { rows: number; columns: number }) => void
      }
    | undefined

  const adapter: TerminalAdapter = {
    clear: () => undefined,
    destroy,
    fit: () => ({ rows: 28, columns: 96 }),
    focus: () => undefined,
    refresh: () => ({ rows: 28, columns: 96 }),
    write: (content) => {
      writes.push(content)
    }
  }

  const factory: TerminalAdapterFactory = vi.fn((_host, nextBindings) => {
    bindings = nextBindings
    return adapter
  })

  return {
    bindings: () => {
      if (!bindings) {
        throw new Error('adapter bindings not ready')
      }
      return bindings
    },
    destroy,
    factory,
    writes
  }
}

it('ignores terminal events from unrelated sessions while idle', async () => {
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

  await waitFor(() => expect(screen.getByText('空闲')).toBeInTheDocument())
  await services.emit({
    sessionId: 'foreign-session',
    eventType: 'output',
    message: 'foreign output',
    timestamp: '1710806401'
  })

  expect(adapterHarness.writes).toEqual([])
  expect(screen.getByText('空闲')).toBeInTheDocument()
})

it('clears the active session after the terminal exits naturally', async () => {
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
  await services.emit({
    sessionId: 'terminal-1',
    eventType: 'exited',
    message: 'exit status: 0',
    timestamp: '1710806402'
  })

  adapterHarness.bindings().onInput('ls\n')

  expect(screen.getByText('已退出')).toBeInTheDocument()
  expect(screen.queryByText('PID 41')).not.toBeInTheDocument()
  expect(services.writeInput).not.toHaveBeenCalled()
})

it('does not recreate the adapter when config changes without project switch', async () => {
  const services = createServices()
  const adapterHarness = createAdapterHarness()
  const initialConfig = buildConfig()
  const nextConfig = {
    ...initialConfig,
    style: { ...initialConfig.style, instructions: '改成强调财务字段的展示风格。' }
  }
  const view = render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={initialConfig}
      configVersion="v1"
      isConfigStale={false}
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  await waitFor(() => expect(adapterHarness.factory).toHaveBeenCalledTimes(1))
  view.rerender(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={nextConfig}
      configVersion="v1"
      isConfigStale
      services={services}
      createAdapter={adapterHarness.factory}
    />
  )

  expect(adapterHarness.factory).toHaveBeenCalledTimes(1)
  expect(adapterHarness.destroy).not.toHaveBeenCalled()
})
