import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProjectWorkbenchView from '../views/ProjectWorkbenchView.vue'
import { ApiError } from '../lib/api'

const {
  getCurrentProject,
  selectProjectWithDialog,
  saveRemoteProfile,
  testRemoteProfile,
  getRemoteOverview
} = vi.hoisted(() => ({
  getCurrentProject: vi.fn(),
  selectProjectWithDialog: vi.fn(),
  saveRemoteProfile: vi.fn(),
  testRemoteProfile: vi.fn(),
  getRemoteOverview: vi.fn()
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getCurrentProject,
    selectProjectWithDialog,
    saveRemoteProfile,
    testRemoteProfile,
    getRemoteOverview
  }
})

afterEach(() => {
  getCurrentProject.mockReset()
  selectProjectWithDialog.mockReset()
  saveRemoteProfile.mockReset()
  testRemoteProfile.mockReset()
  getRemoteOverview.mockReset()
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
        password: 'admin'
      }
    })
    getRemoteOverview.mockResolvedValue({
      directory_entries: [
        { path: 'reportlets/demo', is_directory: true, lock: null }
      ],
      data_connections: [{ name: 'qzcs' }],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })

    render(ProjectWorkbenchView)

    await waitFor(() => {
      expect(getCurrentProject).toHaveBeenCalledTimes(1)
      expect(getRemoteOverview).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByText('/tmp/project-alpha')).toBeInTheDocument()
    expect(await screen.findByText('reportlets/demo')).toBeInTheDocument()
    expect(await screen.findByText('qzcs')).toBeInTheDocument()
  })

  it('selects project through directory dialog and refreshes the form', async () => {
    getCurrentProject.mockResolvedValue({
      current_project: null,
      remote_profile: null
    })
    getRemoteOverview.mockResolvedValue({
      directory_entries: [],
      data_connections: [],
      last_loaded_at: '2026-03-25T12:00:00Z'
    })
    selectProjectWithDialog.mockResolvedValue({
      current_project: {
        path: '/tmp/project-beta',
        name: 'project-beta'
      },
      remote_profile: {
        base_url: 'http://localhost:8075/webroot/decision',
        username: 'admin',
        password: 'admin'
      }
    })

    render(ProjectWorkbenchView)

    await fireEvent.click(await screen.findByRole('button', { name: '选择目录' }))

    await waitFor(() => {
      expect(selectProjectWithDialog).toHaveBeenCalledTimes(1)
    })

    expect(
      await screen.findByDisplayValue('http://localhost:8075/webroot/decision')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('用户名')).toHaveValue('admin')
    expect(screen.getByLabelText('密码')).toHaveValue('admin')
    expect(await screen.findByText('/tmp/project-beta')).toBeInTheDocument()
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
