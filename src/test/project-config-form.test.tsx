import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import {
  createDefaultProjectConfig,
  ProjectConfigForm
} from '../components/config/project-config-form'

it('renders project tab by default and switches to style tab', async () => {
  await act(async () => {
    render(
      <ProjectConfigForm
        services={{
          browseDirectory: async () => '/tmp/demo',
          loadConfig: async () => ({
            exists: false,
            config: createDefaultProjectConfig()
          }),
          listReportletEntries: async () => [
            {
              name: 'sales',
              path: 'sales',
              kind: 'directory',
              children: [
                {
                  name: 'report.cpt',
                  path: 'sales/report.cpt',
                  kind: 'file',
                  children: []
                }
              ]
            },
            {
              name: '.gitkeep',
              path: '.gitkeep',
              kind: 'file',
              children: []
            }
          ],
          listRemoteDirectories: async () => [],
          saveConfig: async () => undefined
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
  expect(screen.getByRole('combobox', { name: '同步协议' })).toBeInTheDocument()
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
  expect(screen.getByRole('combobox', { name: '同步协议' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '样式' }))

  await waitFor(() => expect(screen.getByRole('tabpanel')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByLabelText('样式说明')).toBeInTheDocument())
  expect(screen.getByLabelText('样式说明')).toBeInTheDocument()
  expect(
    screen.getByText('这里的内容会作为 AI 的项目上下文写入，直接描述版式、配色、字体和输出风格。')
  ).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '数据连接' }))

  await waitFor(() =>
    expect(screen.getByRole('button', { name: '新增数据连接' })).toBeInTheDocument()
  )
  expect(screen.getByLabelText('数据连接名称 1')).toBeInTheDocument()
  expect(screen.getByLabelText('DSN 1')).toBeInTheDocument()
  expect(screen.getByLabelText('用户名 1')).toBeInTheDocument()
  expect(screen.getByLabelText('密码 1')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '新增数据连接' }))

  expect(screen.getByLabelText('数据连接名称 2')).toBeInTheDocument()
  expect(screen.getByLabelText('DSN 2')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('tab', { name: '文件管理' }))

  await waitFor(() => expect(screen.getByText('reportlets 目录')).toBeInTheDocument())
  expect(screen.getByRole('tree')).toBeInTheDocument()
  expect(screen.getAllByRole('treeitem')).toHaveLength(2)
  expect(screen.getByText('sales')).toBeInTheDocument()
  expect(screen.getByText('report.cpt')).toBeInTheDocument()
  expect(screen.queryByText('.gitkeep')).not.toBeInTheDocument()
})

it('loads config from project directory and saves back to project config file', async () => {
  const loaded = createDefaultProjectConfig()
  loaded.workspace.name = 'demo-project'
  loaded.sync.protocol = 'sftp'
  loaded.sync.host = '127.0.0.1'
  loaded.sync.port = 22
  loaded.sync.username = 'deploy'
  loaded.sync.password = 'deploy-pass'
  loaded.sync.remote_runtime_dir = '/srv/runtime'
  loaded.style.instructions = '表格使用蓝灰配色，标题左对齐，金额保留两位小数。'
  loaded.preview.account = 'preview-user'
  loaded.preview.password = 'preview-pass'
  loaded.ai.provider = 'openai'
  loaded.ai.model = 'gpt-5'
  loaded.ai.api_key = 'sk-demo'
  loaded.data_connections = [
    {
      connection_name: 'FR Demo',
      dsn: 'mysql://127.0.0.1:3306/demo',
      username: 'report',
      password: 'secret'
    }
  ]
  const loadConfig = vi.fn(async (projectDir: string) => ({
    exists: projectDir === '/tmp/existing',
    config: loaded
  }))
  const listReportletEntries = vi.fn(async () => [])
  const listRemoteDirectories = vi.fn(async () => [
    {
      name: 'reportlets',
      path: '/srv/runtime/reportlets',
      children: []
    }
  ])
  const saveConfig = vi.fn(async () => undefined)
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
          listRemoteDirectories,
          saveConfig
        }}
      />
    )
  })

  fireEvent.click(screen.getByRole('button', { name: '选择项目目录' }))

  await waitFor(() => expect(loadConfig).toHaveBeenCalledWith('/tmp/existing'))
  expect(listReportletEntries).toHaveBeenCalledWith('/tmp/existing')
  expect(browseDirectory).toHaveBeenCalledTimes(1)
  expect(screen.getByDisplayValue('demo-project')).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: '预览方式' })
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 提供方')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Codex 模型')).not.toBeInTheDocument()
  expect(screen.getByDisplayValue('preview-user')).toBeInTheDocument()
  expect(screen.getByDisplayValue('sk-demo')).toBeInTheDocument()
  expect(screen.getByDisplayValue('deploy')).toBeInTheDocument()
  expect(screen.getByDisplayValue('deploy-pass')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '选择远程目录' })).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '选择远程目录' }))

  await waitFor(() =>
    expect(listRemoteDirectories).toHaveBeenCalledWith({
      protocol: 'sftp',
      host: '127.0.0.1',
      port: 22,
      username: 'deploy',
      password: 'deploy-pass',
      path: '/srv/runtime'
    })
  )
  fireEvent.click(screen.getByText('/srv/runtime/reportlets'))
  fireEvent.click(screen.getByRole('button', { name: '使用当前目录' }))

  await waitFor(() =>
    expect(screen.getByDisplayValue('/srv/runtime/reportlets')).toBeInTheDocument()
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
          host: '127.0.0.1',
          username: 'deploy',
          password: 'deploy-pass',
          remote_runtime_dir: '/srv/runtime/reportlets'
        }),
        ai: expect.objectContaining({
          provider: 'openai',
          model: 'gpt-5',
          api_key: 'sk-demo'
        }),
        data_connections: [
          expect.objectContaining({
            connection_name: 'FR Demo',
            dsn: 'mysql://127.0.0.1:3306/demo',
            username: 'report',
            password: 'secret'
          })
        ]
      })
    )
  )
})
