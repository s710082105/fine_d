import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProjectWorkbenchView from '../views/ProjectWorkbenchView.vue'
import { ApiError } from '../lib/api'

const {
  getCurrentProject,
  selectProject,
  selectProjectWithDialog,
  saveRemoteProfile,
  testRemoteProfile,
  getRemoteOverview,
  getRemoteDirectories
} = vi.hoisted(() => ({
  getCurrentProject: vi.fn(),
  selectProject: vi.fn(),
  selectProjectWithDialog: vi.fn(),
  saveRemoteProfile: vi.fn(),
  testRemoteProfile: vi.fn(),
  getRemoteOverview: vi.fn(),
  getRemoteDirectories: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getCurrentProject,
    selectProject,
    selectProjectWithDialog,
    saveRemoteProfile,
    testRemoteProfile,
    getRemoteOverview,
    getRemoteDirectories
  }
})

afterEach(() => {
  getCurrentProject.mockReset()
  selectProject.mockReset()
  selectProjectWithDialog.mockReset()
  saveRemoteProfile.mockReset()
  testRemoteProfile.mockReset()
  getRemoteOverview.mockReset()
  getRemoteDirectories.mockReset()
})

describe('ProjectWorkbenchView', () => {
  it('loads current project and remote overview on mount', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })
    getRemoteOverview.mockResolvedValue({
      data_connections: [{ name: 'qzcs', database_type: 'MYSQL' }],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })
    getRemoteDirectories.mockResolvedValue([
      { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
    ])

    render(ProjectWorkbenchView)

    await waitFor(() => {
      expect(getCurrentProject).toHaveBeenCalledTimes(1)
      expect(getRemoteOverview).toHaveBeenCalledTimes(1)
      expect(getRemoteDirectories).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('/tmp/project-alpha')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('/Applications/FineReport')).toBeInTheDocument()
    expect(await screen.findByText('reportlets')).toBeInTheDocument()
    expect(await screen.findByText('qzcs')).toBeInTheDocument()
    expect(await screen.findByText('MYSQL')).toBeInTheDocument()
  })

  it('keeps project workbench stable when shared sidebar items are clicked', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })
    getRemoteOverview.mockResolvedValue({
      data_connections: [{ name: 'qzcs', database_type: 'MYSQL' }],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })
    getRemoteDirectories.mockResolvedValue([
      { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
    ])

    render(ProjectWorkbenchView)

    await fireEvent.click(await screen.findByText('qzcs'))
    await fireEvent.click(await screen.findByText('reportlets'))

    expect(await screen.findByText('/tmp/project-alpha')).toBeInTheDocument()
    expect(screen.queryByText('请求失败')).not.toBeInTheDocument()
  })

  it('keeps the directory tree available when remote overview fails', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })
    getRemoteOverview.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'remote.request_failed',
          message: '远程请求失败',
          detail: { operation: 'data_connections' },
          source: 'remote',
          retryable: true
        },
        'API request failed: 400 Bad Request'
      )
    )
    getRemoteDirectories.mockResolvedValue([
      { name: 'reportlets', path: '/reportlets', is_directory: true, lock: null }
    ])

    const view = render(ProjectWorkbenchView)

    expect(await screen.findByText('reportlets')).toBeInTheDocument()
    expect(
      await screen.findByText('remote.request_failed: 远程请求失败')
    ).toBeInTheDocument()
  })

  it('selects project through directory dialog and refreshes the form', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: null,
      remote_profile: null
    })
    getRemoteOverview.mockResolvedValue({
      data_connections: [],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })
    getRemoteDirectories.mockResolvedValue([])
    selectProjectWithDialog.mockResolvedValue({
      current_project: {
        path: '/tmp/project-beta',
        name: 'project-beta'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })

    const view = render(ProjectWorkbenchView)

    await fireEvent.click(await screen.findByRole('button', { name: '选择目录' }))

    await waitFor(() => {
      expect(selectProjectWithDialog).toHaveBeenCalledTimes(1)
    })

    expect(
      await screen.findByDisplayValue('http://localhost:8075/webroot/decision')
    ).toBeInTheDocument()
    expect(await screen.findByDisplayValue('/Applications/FineReport')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('admin')).toHaveLength(2)
    expect(await screen.findByText('/tmp/project-beta')).toBeInTheDocument()
  })

  it('selects project from manual path input', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: null,
      remote_profile: null
    })
    getRemoteOverview.mockResolvedValue({
      data_connections: [],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })
    getRemoteDirectories.mockResolvedValue([])
    selectProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-gamma',
        name: 'project-gamma'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })

    render(ProjectWorkbenchView)

    await waitFor(() => {
      expect(getCurrentProject).toHaveBeenCalledTimes(1)
    })

    await fireEvent.update(
      await screen.findByPlaceholderText('/Users/name/workspace/project'),
      '/tmp/project-gamma'
    )
    await fireEvent.click(screen.getByRole('button', { name: '应用路径' }))

    await waitFor(() => {
      expect(selectProject).toHaveBeenCalledWith('/tmp/project-gamma')
    })

    expect(await screen.findByText('/tmp/project-gamma')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('/Applications/FineReport')).toBeInTheDocument()
  })

  it('saves designer root together with remote profile', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: {
        path: '/tmp/project-alpha',
        name: 'project-alpha'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })
    saveRemoteProfile.mockResolvedValue({
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      }
    })

    const view = render(ProjectWorkbenchView)

    expect(await screen.findByDisplayValue('/Applications/FineReport')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: '保存参数' }))

    await waitFor(() => {
      expect(saveRemoteProfile).toHaveBeenCalledWith({
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin',
        designer_root: '/Applications/FineReport'
      })
    })
  })

  it('shows explicit backend errors', async () => {
    getCurrentProject.mockRejectedValue(
      new ApiError(
        400,
        {
          code: 'project.current_invalid',
          message: '当前项目目录已失效',
          detail: { path: '/tmp/project-alpha' },
          source: 'project',
          retryable: false
        },
        'API request failed: 400 Bad Request'
      )
    )

    render(ProjectWorkbenchView)

    await waitFor(() => {
      expect(
        screen.getByText('project.current_invalid: 当前项目目录已失效')
      ).toBeInTheDocument()
    })
  })
})
