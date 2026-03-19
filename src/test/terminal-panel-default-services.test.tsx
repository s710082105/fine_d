import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, vi } from 'vitest'
import { createDefaultProjectConfig } from '../components/config/project-config-form'

const mockCheckCodexInstallation = vi.fn(async () => true)
const mockSubscribe = vi.fn(() => () => undefined)
const resolveTauriTerminalServices = vi.fn(() => ({
  checkCodexInstallation: mockCheckCodexInstallation,
  createSession: vi.fn(async () => {
    throw new Error('not used in this test')
  }),
  writeInput: vi.fn(async () => undefined),
  resize: vi.fn(async () => undefined),
  closeSession: vi.fn(async () => undefined),
  subscribe: mockSubscribe
}))

vi.mock('../components/terminal/terminal-services', () => ({
  resolveTauriTerminalServices
}))

vi.mock('../components/terminal/xterm-adapter', () => ({
  createTerminalAdapter: vi.fn(() => ({
    write: () => undefined,
    clear: () => undefined,
    destroy: () => undefined,
    focus: () => undefined,
    fit: () => ({ rows: 24, columns: 80 })
  }))
}))

function buildConfig() {
  const config = createDefaultProjectConfig()
  config.workspace.name = 'demo'
  config.workspace.root_dir = '/tmp/demo'
  return config
}

beforeEach(() => {
  mockCheckCodexInstallation.mockClear()
  mockSubscribe.mockClear()
  resolveTauriTerminalServices.mockClear()
})

it('reuses default terminal services across rerenders', async () => {
  const { TerminalPanel } = await import('../components/terminal/terminal-panel')
  const { rerender } = render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
    />
  )

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeEnabled()
  )
  rerender(
    <TerminalPanel
      projectId="default"
      projectName="demo-next"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
    />
  )

  expect(resolveTauriTerminalServices).toHaveBeenCalledTimes(1)
  expect(mockCheckCodexInstallation).toHaveBeenCalledTimes(1)
  expect(mockSubscribe).toHaveBeenCalledTimes(1)
})

it('shows an explicit error when terminal subscription setup fails', async () => {
  const { TerminalPanel } = await import('../components/terminal/terminal-panel')
  const services = {
    checkCodexInstallation: async () => true,
    createSession: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    writeInput: vi.fn(async () => undefined),
    resize: vi.fn(async () => undefined),
    closeSession: vi.fn(async () => undefined),
    subscribe: async () => {
      throw new Error('subscribe failed')
    }
  }

  render(
    <TerminalPanel
      projectId="default"
      projectName="demo"
      config={buildConfig()}
      configVersion="v1"
      isConfigStale={false}
      services={services}
    />
  )

  await waitFor(() =>
    expect(screen.getByText('subscribe failed')).toBeInTheDocument()
  )
  expect(screen.getByText('出错')).toBeInTheDocument()
})
