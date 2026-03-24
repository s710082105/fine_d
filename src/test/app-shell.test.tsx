import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AppShell } from '../App'
import type { EnvironmentServices } from '../components/startup/startup-gate'
import { createDefaultProjectConfig } from '../components/config/project-config-form'
import type { ReportletEntry } from '../lib/types/project-config'
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

function clickFirstTreeSwitcher(title: string) {
  const panel = screen.getByText(title).closest('section')
  if (!panel) {
    throw new Error(`panel not found for ${title}`)
  }
  const switcher = panel.querySelector<HTMLElement>('.ant-tree-switcher')
  if (!switcher) {
    throw new Error(`switcher not found for ${title}`)
  }
  fireEvent.click(switcher)
}

function createEnvironmentServices(
  ready = true,
  overrides: Partial<Awaited<ReturnType<EnvironmentServices['checkRuntimePrerequisites']>>> = {}
): EnvironmentServices {
  return {
    checkRuntimePrerequisites: async () => ({
      ready,
      items: [],
      ...overrides
    })
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
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile: async () => ({
            ok: true,
            command: 'push-local',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '本地文件已上传到远端。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        environmentServices={createEnvironmentServices()}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })
  expect(screen.getByText('项目配置')).toBeInTheDocument()
  expect(screen.getByTestId('pane-left-scroll')).toBeInTheDocument()
  expect(screen.getByTestId('pane-right-fixed')).toBeInTheDocument()
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
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile: async () => ({
            ok: true,
            command: 'push-local',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '本地文件已上传到远端。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        environmentServices={createEnvironmentServices()}
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
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile: async () => ({
            ok: true,
            command: 'push-local',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '本地文件已上传到远端。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        environmentServices={createEnvironmentServices()}
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

it('inserts local file path into active terminal session', async () => {
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
  const terminalServices = createTerminalServices()
  terminalServices.createSession = createSession
  terminalServices.writeInput = writeInput
  const listReportletEntries = vi
    .fn<(projectDir: string, relativePath?: string) => Promise<ReportletEntry[]>>()
    .mockImplementation(async (_projectDir, relativePath) => {
      if (relativePath === 'sales') {
        return [
          {
            name: 'report summary.cpt',
            path: 'sales/report summary.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
      return [
        {
          name: 'sales',
          path: 'sales',
          kind: 'directory',
          children: []
        }
      ]
    })

  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries,
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile: async () => ({
            ok: true,
            command: 'push-local',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '本地文件已上传到远端。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        environmentServices={createEnvironmentServices()}
        terminalServices={terminalServices}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))
  await waitFor(() => expect(screen.getByLabelText('项目名称')).toBeInTheDocument())

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '启动 Codex' })).toBeEnabled()
  )
  fireEvent.click(screen.getByRole('button', { name: '启动 Codex' }))
  await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1))

  fireEvent.click(screen.getByRole('tab', { name: '文件管理' }))
  await waitFor(() => expect(screen.getByText('本地 reportlets')).toBeInTheDocument())

  clickFirstTreeSwitcher('本地 reportlets')
  await waitFor(() =>
    expect(listReportletEntries).toHaveBeenCalledWith('/tmp/demo', 'sales')
  )

  fireEvent.click(screen.getByRole('button', { name: '插入 report summary.cpt' }))

  await waitFor(() =>
    expect(writeInput).toHaveBeenCalledWith({
      session_id: 'terminal-1',
      payload: "'reportlets/sales/report summary.cpt'"
    })
  )
})

it('uploads selected local file from file management', async () => {
  const pushLocalReportletFile = vi.fn(async () => ({
    ok: true,
    command: 'push-local',
    localPath: '/tmp/demo/reportlets/sales/report.cpt',
    remotePath: 'reportlets/sales/report.cpt',
    message: '本地文件已上传到远端。'
  }))
  const listReportletEntries = vi
    .fn<(projectDir: string, relativePath?: string) => Promise<ReportletEntry[]>>()
    .mockImplementation(async (_projectDir, relativePath) => {
      if (relativePath === 'sales') {
        return [
          {
            name: 'report.cpt',
            path: 'sales/report.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
      return [
        {
          name: 'sales',
          path: 'sales',
          kind: 'directory',
          children: []
        }
      ]
    })

  await act(async () => {
    render(
      <AppShell
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries,
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile,
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        environmentServices={createEnvironmentServices()}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))
  await waitFor(() => expect(screen.getByLabelText('项目名称')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('tab', { name: '文件管理' }))
  await waitFor(() => expect(screen.getByText('本地 reportlets')).toBeInTheDocument())

  clickFirstTreeSwitcher('本地 reportlets')
  await waitFor(() =>
    expect(listReportletEntries).toHaveBeenCalledWith('/tmp/demo', 'sales')
  )

  fireEvent.click(screen.getByRole('button', { name: '上传 report.cpt' }))

  await waitFor(() =>
    expect(pushLocalReportletFile).toHaveBeenCalledWith(
      '/tmp/demo',
      'reportlets/sales/report.cpt'
    )
  )
})

it('blocks the app when startup prerequisites fail', async () => {
  await act(async () => {
    render(
      <AppShell
        environmentServices={createEnvironmentServices(false, {
          items: [
            {
              key: 'git',
              label: 'Git',
              status: 'blocked',
              blocking: true,
              message: '未检测到 git',
              fixHint: '请执行 Windows 安装脚本完成环境安装',
              detectedVersion: '',
              scriptPath: 'scripts/install-runtime-windows.cmd'
            }
          ]
        })}
        projectConfigServices={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [],
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          pushLocalReportletFile: async () => ({
            ok: true,
            command: 'push-local',
            localPath: '/tmp/demo/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '本地文件已上传到远端。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
        terminalServices={createTerminalServices()}
        terminalAdapterFactory={terminalAdapterFactory}
      />
    )
  })

  expect(screen.getByText('基础环境未安装完成')).toBeInTheDocument()
  expect(screen.getByText('未检测到 git')).toBeInTheDocument()
  expect(screen.getByText('请执行 Windows 安装脚本完成环境安装')).toBeInTheDocument()
  expect(screen.getByText('scripts/install-runtime-windows.cmd')).toBeInTheDocument()
  expect(screen.queryByText('项目配置')).not.toBeInTheDocument()
  expect(screen.queryByText('终端状态')).not.toBeInTheDocument()
})
