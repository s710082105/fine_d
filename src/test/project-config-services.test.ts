import '@testing-library/jest-dom/vitest'
import { beforeEach, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke
}))

beforeEach(() => {
  invoke.mockReset()
})

it('uses camelCase designerRoot when testing remote sync connection', async () => {
  invoke.mockResolvedValue({ ok: true, message: '远程设计连接成功' })
  const { tauriServices } = await import('../components/config/project-config-services')

  await tauriServices.testRemoteSyncConnection({
    designerRoot: '/Applications/FineReport',
    url: 'http://127.0.0.1:8075/webroot/decision',
    username: 'admin',
    password: 'admin',
    path: 'reportlets'
  })

  expect(invoke).toHaveBeenCalledWith('test_remote_sync_connection', {
    request: {
      designerRoot: '/Applications/FineReport',
      url: 'http://127.0.0.1:8075/webroot/decision',
      username: 'admin',
      password: 'admin',
      path: 'reportlets'
    }
  })
})

it('invokes remote pull command with projectDir and relativePath', async () => {
  invoke.mockResolvedValue({
    ok: true,
    command: 'prepare-edit',
    localPath: '/tmp/demo/reportlets/sales/report.cpt',
    remotePath: 'reportlets/sales/report.cpt',
    message: '远端检查通过，已拉取远端最新内容到本地，可继续修改模板。'
  })
  const { tauriServices } = await import('../components/config/project-config-services')

  await tauriServices.pullRemoteReportletFile(
    '/tmp/demo',
    'reportlets/sales/report.cpt'
  )

  expect(invoke).toHaveBeenCalledWith('pull_remote_reportlet_file', {
    projectDir: '/tmp/demo',
    relativePath: 'reportlets/sales/report.cpt'
  })
})

it('passes relativePath when listing local reportlet directory entries', async () => {
  invoke.mockResolvedValue([])
  const { tauriServices } = await import('../components/config/project-config-services')

  await tauriServices.listReportletEntries('/tmp/demo', 'sales')

  expect(invoke).toHaveBeenCalledWith('list_reportlet_entries', {
    projectDir: '/tmp/demo',
    relativePath: 'sales'
  })
})
