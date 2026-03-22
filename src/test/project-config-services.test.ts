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
