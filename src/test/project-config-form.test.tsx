import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import {
  createDefaultProjectConfig,
  ProjectConfigForm
} from '../components/config/project-config-form'
import type { ReportletEntry } from '../lib/types/project-config'

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

it(
  'renders project tab by default and switches to style tab',
  async () => {
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
        },
        {
          name: '.gitkeep',
          path: '.gitkeep',
          kind: 'file',
          children: []
        }
      ]
    })
  await act(async () => {
    render(
      <ProjectConfigForm
        services={{
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
            localPath: '/tmp/demo/reportlets/sales/report.cpt',
            remotePath: 'reportlets/sales/report.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          saveConfig: async () => undefined,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
      />
    )
  })

  expect(screen.getByRole('tab', { name: '项目' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '样式' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '数据连接' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: '文件管理' })).toBeInTheDocument()
  expect(screen.getByLabelText('项目目录')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() =>
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument()
  )
  expect(screen.queryByLabelText('同步方式')).not.toBeInTheDocument()
  expect(screen.getByLabelText('本地 FineReport 设计器目录')).toBeInTheDocument()
  expect(
    screen.getByText('请选择 FineReport 安装根目录，也就是包含 lib 目录和设计器 jars 的那一级目录。')
  ).toBeInTheDocument()
  expect(screen.getByLabelText('预览地址')).toBeInTheDocument()
  expect(screen.getByLabelText('预览账号')).toBeInTheDocument()
  expect(screen.getByLabelText('预览密码')).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: '预览方式' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 提供方')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 模型')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Codex API Key')).toBeInTheDocument()
  expect(screen.getByText('真实同步源目录固定为：/tmp/demo/reportlets')).toBeInTheDocument()
  expect(screen.getByLabelText('同步删除')).toBeInTheDocument()
  expect(screen.getByLabelText('文件变更后自动同步')).toBeInTheDocument()
  expect(screen.queryByLabelText('远端运行目录')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '样式' }))

  await waitFor(() => expect(screen.getByRole('tabpanel')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByLabelText('样式说明')).toBeInTheDocument())
  expect(screen.getByLabelText('样式说明')).toBeInTheDocument()
  expect(
    screen.getByText('这里的内容会作为 AI 的项目上下文写入，直接描述版式、配色、字体和输出风格。')
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '数据连接' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '读取远端连接' })).toBeInTheDocument()
  )
  expect(screen.getByText('只读取设计器远端已有数据连接')).toBeInTheDocument()
  expect(screen.getByText('暂无远端连接')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '文件管理' }))

  await waitFor(() => expect(screen.getByText('本地 reportlets')).toBeInTheDocument())
  expect(screen.getByText('远端 reportlets')).toBeInTheDocument()
  expect(screen.getByRole('tree')).toBeInTheDocument()
  expect(screen.getByText('sales')).toBeInTheDocument()
  expect(screen.queryByText('report.cpt')).not.toBeInTheDocument()
  expect(screen.queryByText('.gitkeep')).not.toBeInTheDocument()
  expect(screen.queryByText('目录')).not.toBeInTheDocument()
  expect(screen.queryByText('文件')).not.toBeInTheDocument()
  expect(screen.getByText('点击刷新列表读取远端文件清单')).toBeInTheDocument()

  clickFirstTreeSwitcher('本地 reportlets')

  await waitFor(() =>
    expect(listReportletEntries).toHaveBeenCalledWith('/tmp/demo', 'sales')
  )
  expect(screen.getByText('report.cpt')).toBeInTheDocument()
  },
  10000
)

it('loads config from project directory and saves back to project config file', async () => {
  const loaded = createDefaultProjectConfig()
  loaded.workspace.name = 'demo-project'
  loaded.sync.protocol = 'fine'
  loaded.sync.designer_root = '/Applications/FineReport'
  loaded.sync.remote_runtime_dir = 'reportlets'
  loaded.style.instructions = '表格使用蓝灰配色，标题左对齐，金额保留两位小数。'
  loaded.preview.account = 'preview-user'
  loaded.preview.password = 'preview-pass'
  loaded.ai.provider = 'openai'
  loaded.ai.model = 'gpt-5'
  loaded.ai.api_key = 'sk-demo'
  const loadConfig = vi.fn(async (projectDir: string) => ({
    exists: projectDir === '/tmp/existing',
    config: loaded
  }))
  const listDesignerConnections = vi.fn(async () => [{ name: 'test' }, { name: 'FRDemo' }])
  const listReportletEntries = vi
    .fn<(projectDir: string, relativePath?: string) => Promise<ReportletEntry[]>>()
    .mockImplementation(async (_projectDir, relativePath) => {
      if (relativePath === 'sales') {
        return [
          {
            name: 'remote.cpt',
            path: 'sales/remote.cpt',
            kind: 'file',
            children: []
          }
        ]
      }
      return []
    })
  const listRemoteReportletEntries = vi.fn<
    (request: {
      designerRoot: string
      url: string
      username: string
      password: string
      path: string
    }) => Promise<ReportletEntry[]>
  >(async (request) =>
    request.path === 'reportlets/sales'
      ? [
          {
            name: 'remote.cpt',
            path: 'reportlets/sales/remote.cpt',
            kind: 'file' as const,
            children: []
          }
        ]
      : [
          {
            name: 'sales',
            path: 'reportlets/sales',
            kind: 'directory' as const,
            children: []
          }
        ]
  )
  const pullRemoteReportletFile = vi.fn(async () => ({
    ok: true,
    command: 'prepare-edit',
    localPath: '/tmp/existing/reportlets/sales/remote.cpt',
    remotePath: 'reportlets/sales/remote.cpt',
    message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
  }))
  const saveConfig = vi.fn(async () => undefined)
  const testRemoteSyncConnection = vi.fn(async () => ({ ok: true, message: '远程设计连接成功' }))
  const browseDirectory = vi
    .fn<() => Promise<string | null>>()
    .mockResolvedValueOnce('/tmp/existing')

  await act(async () => {
    render(
      <ProjectConfigForm
        services={{
          browseDirectory,
          loadConfig,
          listReportletEntries,
          listRemoteReportletEntries,
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile,
          saveConfig,
          listDesignerConnections,
          testRemoteSyncConnection
        }}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() => expect(loadConfig).toHaveBeenCalledWith('/tmp/existing'))
  expect(listReportletEntries).toHaveBeenCalledWith('/tmp/existing', undefined)
  expect(browseDirectory).toHaveBeenCalledTimes(1)
  expect(screen.getByDisplayValue('demo-project')).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: '预览方式' })
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 提供方')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 模型')).not.toBeInTheDocument()
  expect(screen.getByDisplayValue('/Applications/FineReport')).toBeInTheDocument()
  expect(
    screen.getByText('请选择 FineReport 安装根目录，也就是包含 lib 目录和设计器 jars 的那一级目录。')
  ).toBeInTheDocument()
  expect(screen.getByDisplayValue('preview-user')).toBeInTheDocument()
  expect(screen.getByDisplayValue('sk-demo')).toBeInTheDocument()
  expect(screen.queryByLabelText('远端运行目录')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '选择远端目录' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '测试远程连接' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '测试远程连接' }))

  await waitFor(() =>
    expect(testRemoteSyncConnection).toHaveBeenCalledWith({
      designerRoot: '/Applications/FineReport',
      url: 'http://127.0.0.1:8075/webroot/decision',
      username: 'preview-user',
      password: 'preview-pass',
      path: 'reportlets'
    })
  )
  expect(screen.getByText('远程设计连接成功')).toBeInTheDocument()

  // 切换到数据连接页签验证远端连接读取
  fireEvent.click(screen.getByRole('tab', { name: '数据连接' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '读取远端连接' })).toBeInTheDocument()
  )
  fireEvent.click(screen.getByRole('button', { name: '读取远端连接' }))
  await waitFor(() =>
    expect(listDesignerConnections).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:8075/webroot/decision',
      username: 'preview-user',
      password: 'preview-pass'
    })
  )
  expect(screen.getByText('test')).toBeInTheDocument()
  expect(screen.getByText('FRDemo')).toBeInTheDocument()

  // 切换回项目页签再保存
  fireEvent.click(screen.getByRole('tab', { name: '项目' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '保存配置' })).toBeInTheDocument()
  )

  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

  await waitFor(() =>
    expect(saveConfig).toHaveBeenCalledWith(
      '/tmp/existing',
      expect.objectContaining({
        workspace: expect.objectContaining({ root_dir: '/tmp/existing' }),
        preview: expect.objectContaining({
          account: 'preview-user',
          password: 'preview-pass'
        }),
        sync: expect.objectContaining({
          designer_root: '/Applications/FineReport',
          remote_runtime_dir: 'reportlets'
        }),
        ai: expect.objectContaining({
          provider: 'openai',
          model: 'gpt-5',
          api_key: 'sk-demo'
        })
      })
    )
  )

  fireEvent.click(screen.getByRole('tab', { name: '文件管理' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '刷新列表' })).toBeInTheDocument()
  )
  expect(screen.queryByRole('button', { name: '保存配置' })).not.toBeInTheDocument()
  expect(screen.getByText('本地 reportlets 目录为空')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '刷新列表' }))

  await waitFor(() =>
    expect(listRemoteReportletEntries).toHaveBeenCalledWith({
      designerRoot: '/Applications/FineReport',
      url: 'http://127.0.0.1:8075/webroot/decision',
      username: 'preview-user',
      password: 'preview-pass',
      path: 'reportlets'
    })
  )
  expect(screen.queryByText('remote.cpt')).not.toBeInTheDocument()

  clickFirstTreeSwitcher('远端 reportlets')

  await waitFor(() =>
    expect(listRemoteReportletEntries).toHaveBeenCalledWith({
      designerRoot: '/Applications/FineReport',
      url: 'http://127.0.0.1:8075/webroot/decision',
      username: 'preview-user',
      password: 'preview-pass',
      path: 'reportlets/sales'
    })
  )
  expect(screen.getByText('remote.cpt')).toBeInTheDocument()

  fireEvent.click(screen.getByText('remote.cpt'))
  fireEvent.click(screen.getByRole('button', { name: '拉取选中文件' }))

  await waitFor(() =>
    expect(pullRemoteReportletFile).toHaveBeenCalledWith(
      '/tmp/existing',
      'reportlets/sales/remote.cpt'
    )
  )
  await waitFor(() =>
    expect(listReportletEntries).toHaveBeenLastCalledWith('/tmp/existing', undefined)
  )
})

it('shows saving state while saving project config', async () => {
  const loaded = createDefaultProjectConfig()
  loaded.workspace.name = 'demo-project'
  loaded.sync.designer_root = '/Applications/FineReport'
  loaded.preview.account = 'preview-user'
  loaded.preview.password = 'preview-pass'

  let resolveSave: (() => void) | undefined
  const saveConfig = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveSave = resolve
      })
  )

  await act(async () => {
    render(
      <ProjectConfigForm
        services={{
          browseDirectory: async () => '/tmp/existing',
          loadConfig: async () => ({ exists: true, config: loaded }),
          listReportletEntries: async () => [],
          listRemoteReportletEntries: async () => [],
          listRemoteDirectories: async () => [],
          pullRemoteReportletFile: async () => ({
            ok: true,
            command: 'prepare-edit',
            localPath: '/tmp/existing/reportlets/demo.cpt',
            remotePath: 'reportlets/demo.cpt',
            message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
          }),
          saveConfig,
          listDesignerConnections: async () => [],
          testRemoteSyncConnection: async () => ({ ok: true, message: '远程设计连接成功' })
        }}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))
  await waitFor(() => expect(screen.getByDisplayValue('demo-project')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: '保存配置' }))

  expect(saveConfig).toHaveBeenCalledTimes(1)
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /保存/ })).toBeDisabled()
  )
  expect(screen.getByText('正在保存项目配置...')).toBeInTheDocument()

  await act(async () => resolveSave?.())

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '保存配置' })).toBeEnabled()
  )
})
