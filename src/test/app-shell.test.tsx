import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AppShell } from '../App'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import type { TerminalServices } from '../components/terminal/terminal-services'
import type { TerminalAdapterFactory } from '../components/terminal/xterm-adapter'

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

const terminalAdapterFactory: TerminalAdapterFactory = vi.fn(() => ({
  write: () => undefined,
  clear: () => undefined,
  destroy: () => undefined,
  focus: () => undefined,
  fit: () => ({ rows: 24, columns: 80 }),
  refresh: () => ({ rows: 24, columns: 80 })
}))

function createTerminalServices(): TerminalServices {
  return {
    checkCodexInstallation: async () => true,
    createSession: async () => ({
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
    }),
    writeInput: async () => undefined,
    resize: async () => undefined,
    closeSession: async () => undefined,
    subscribe: () => () => undefined
  }
}

it('renders config and terminal regions', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          saveConfig: async () => undefined
        }}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })
  expect(screen.getByText('项目配置')).toBeInTheDocument()
  expect(screen.getByLabelText('项目目录')).toBeInTheDocument()
  expect(screen.getByText('终端状态')).toBeInTheDocument()
  expect(screen.getByText('等待手动启动 Codex')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '启动 Codex' })).toBeDisabled()
  expect(screen.queryByText('输入区')).not.toBeInTheDocument()
})

it('shows terminal stale notice when config changes', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          saveConfig: async () => undefined
        }}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() => expect(screen.getByLabelText('项目名称')).toBeInTheDocument())

  fireEvent.change(screen.getByLabelText('项目名称'), {
    target: { value: 'qa-demo' }
  })

  expect(screen.getByText('配置已变更，保存后请重新启动 Codex')).toBeInTheDocument()
})

it('resets terminal status after project context changes', async () => {
  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          saveConfig: async () => undefined
        }}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '关闭终端' }))
  expect(screen.getByText('已退出')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() => expect(screen.getByText('空闲')).toBeInTheDocument())
  expect(screen.getByText('default · v2-draft')).toBeInTheDocument()
  expect(screen.getByText('终端状态').closest('section')).toHaveAttribute(
    'data-project-id',
    '/tmp/demo'
  )
})
